#!/usr/bin/env bash
# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
#
# dev環境の初回ブートストラップ（冪等・再実行可能）
#
# 実行方法:
#   cd infra && ./bootstrap.sh          # plan まで（内容確認用）
#   cd infra && ./bootstrap.sh apply    # apply まで実行（適用前に対話確認あり）
#
# 前提: AWS CLI と Terraform >= 1.10 がインストール済みで、
#       アカウント 656827484543 の認証情報が設定されていること。

set -euo pipefail

EXPECTED_ACCOUNT_ID="656827484543"
REGION="ap-northeast-1"
STATE_BUCKET="mobilys-terraform-state-${EXPECTED_ACCOUNT_ID}"
ACTION="${1:-plan}"

cd "$(dirname "$0")"

# --- 0. 誤アカウント実行の防止 ---
ACTUAL_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
if [ "$ACTUAL_ACCOUNT_ID" != "$EXPECTED_ACCOUNT_ID" ]; then
  echo "ERROR: 接続中のAWSアカウント($ACTUAL_ACCOUNT_ID)が想定($EXPECTED_ACCOUNT_ID)と異なります。" >&2
  echo "       認証情報(プロファイル)を確認してください。" >&2
  exit 1
fi
echo "OK: アカウント $ACTUAL_ACCOUNT_ID / リージョン $REGION"

# --- 1. state用バケット（存在しなければ作成） ---
if aws s3api head-bucket --bucket "$STATE_BUCKET" 2>/dev/null; then
  echo "OK: stateバケット $STATE_BUCKET は作成済み"
else
  echo "stateバケット $STATE_BUCKET を作成します..."
  aws s3api create-bucket \
    --bucket "$STATE_BUCKET" \
    --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION"
  aws s3api put-bucket-versioning \
    --bucket "$STATE_BUCKET" \
    --versioning-configuration Status=Enabled
  aws s3api put-bucket-encryption \
    --bucket "$STATE_BUCKET" \
    --server-side-encryption-configuration \
    '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"}}]}'
  aws s3api put-public-access-block \
    --bucket "$STATE_BUCKET" \
    --public-access-block-configuration \
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
  echo "OK: stateバケットを作成しました"
fi

# --- 2. Terraform init / plan ---
terraform init -backend-config=backend.hcl -input=false
terraform plan -var-file=envs/dev.tfvars -input=false -out=tfplan

# --- 3. apply（引数で明示された場合のみ。対話確認あり） ---
if [ "$ACTION" = "apply" ]; then
  echo ""
  read -r -p "上記planを適用します。よろしいですか？ [yes/NO]: " CONFIRM
  if [ "$CONFIRM" = "yes" ]; then
    terraform apply -input=false tfplan
    echo ""
    echo "=== 完了。主要な出力 ==="
    terraform output
    echo ""
    echo "次の手順:"
    echo "  1. (任意) GitHubリポジトリ変数の設定 — 既定値はワークフローに埋め込み済みのため省略可"
    echo "  2. GitHub Settings → Environments で 'dev' を作成し approver を設定（apply承認ゲート）"
    echo "  3. アプリ用シークレットの設定:"
    echo "     aws secretsmanager put-secret-value --secret-id mobilys/dev/env \\"
    echo "       --secret-string '{\"SECRET_KEY\":\"...\",\"ESTAT_API_KEY\":\"...\",\"MLIT_API_KEY\":\"...\"}'"
  else
    echo "applyを中止しました（planは tfplan に保存済み）"
  fi
else
  echo ""
  echo "planのみ実行しました。適用するには: ./bootstrap.sh apply"
fi
