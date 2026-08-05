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
# 前提: AWS CLI がインストール済みで、アカウント 656827484543 の認証情報が
#       設定されていること（AWS CloudShell 可）。
#       Terraform は未インストールなら公式サイトから自動ダウンロードする
#       （SHA256検証付き、infra/.tfbin/ に配置。PATHは変更しない）。

set -euo pipefail

EXPECTED_ACCOUNT_ID="656827484543"
REGION="ap-northeast-1"
STATE_BUCKET="mobilys-terraform-state-${EXPECTED_ACCOUNT_ID}"
TF_VERSION="1.10.5"
ACTION="${1:-plan}"

cd "$(dirname "$0")"

# --- 0. Terraform の確保（無ければ自動ダウンロード） ---
TF_BIN=""
if command -v terraform >/dev/null 2>&1; then
  INSTALLED=$(terraform version | head -1 | sed 's/^Terraform v//')
  MIN_REQUIRED="1.10.0"
  if [ "$(printf '%s\n%s\n' "$MIN_REQUIRED" "$INSTALLED" | sort -V | head -1)" = "$MIN_REQUIRED" ]; then
    TF_BIN="terraform"
    echo "OK: Terraform v${INSTALLED}（インストール済み）を使用"
  else
    echo "注意: インストール済みTerraform v${INSTALLED} は要件(>=${MIN_REQUIRED})未満のため、v${TF_VERSION}をダウンロードします"
  fi
fi

if [ -z "$TF_BIN" ]; then
  if [ -x ".tfbin/terraform" ]; then
    TF_BIN=".tfbin/terraform"
    echo "OK: ダウンロード済みの $(.tfbin/terraform version | head -1) を使用"
  else
    case "$(uname -s)" in
      Linux)  TF_OS="linux" ;;
      Darwin) TF_OS="darwin" ;;
      *) echo "ERROR: 未対応OS: $(uname -s)。https://developer.hashicorp.com/terraform/install から手動インストールしてください。" >&2; exit 1 ;;
    esac
    case "$(uname -m)" in
      x86_64|amd64)  TF_ARCH="amd64" ;;
      aarch64|arm64) TF_ARCH="arm64" ;;
      *) echo "ERROR: 未対応アーキテクチャ: $(uname -m)" >&2; exit 1 ;;
    esac

    ZIP="terraform_${TF_VERSION}_${TF_OS}_${TF_ARCH}.zip"
    BASE_URL="https://releases.hashicorp.com/terraform/${TF_VERSION}"
    echo "Terraform v${TF_VERSION} (${TF_OS}/${TF_ARCH}) をダウンロードします..."

    mkdir -p .tfbin
    curl -fsSL -o ".tfbin/${ZIP}" "${BASE_URL}/${ZIP}"
    curl -fsSL -o ".tfbin/SHA256SUMS" "${BASE_URL}/terraform_${TF_VERSION}_SHA256SUMS"

    # チェックサム検証（改ざん防止）
    EXPECTED_SUM=$(grep " ${ZIP}\$" .tfbin/SHA256SUMS | awk '{print $1}')
    if command -v sha256sum >/dev/null 2>&1; then
      ACTUAL_SUM=$(sha256sum ".tfbin/${ZIP}" | awk '{print $1}')
    else
      ACTUAL_SUM=$(shasum -a 256 ".tfbin/${ZIP}" | awk '{print $1}')
    fi
    if [ -z "$EXPECTED_SUM" ] || [ "$EXPECTED_SUM" != "$ACTUAL_SUM" ]; then
      echo "ERROR: Terraformのチェックサム検証に失敗しました。ダウンロードをやり直してください。" >&2
      rm -rf .tfbin
      exit 1
    fi

    (cd .tfbin && unzip -o -q "${ZIP}" terraform && rm -f "${ZIP}" SHA256SUMS)
    chmod +x .tfbin/terraform
    TF_BIN=".tfbin/terraform"
    echo "OK: $(.tfbin/terraform version | head -1) を infra/.tfbin/ に配置しました"
  fi
fi

# --- 1. 誤アカウント実行の防止 ---
ACTUAL_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
if [ "$ACTUAL_ACCOUNT_ID" != "$EXPECTED_ACCOUNT_ID" ]; then
  echo "ERROR: 接続中のAWSアカウント($ACTUAL_ACCOUNT_ID)が想定($EXPECTED_ACCOUNT_ID)と異なります。" >&2
  echo "       認証情報(プロファイル)を確認してください。" >&2
  exit 1
fi
echo "OK: アカウント $ACTUAL_ACCOUNT_ID / リージョン $REGION"

# --- 2. state用バケット（存在しなければ作成） ---
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

# --- 3. Terraform init / plan ---
"$TF_BIN" init -backend-config=backend.hcl -input=false
"$TF_BIN" plan -var-file=envs/dev.tfvars -input=false -out=tfplan

# --- 4. apply（引数で明示された場合のみ。対話確認あり） ---
if [ "$ACTION" = "apply" ]; then
  echo ""
  read -r -p "上記planを適用します。よろしいですか？ [yes/NO]: " CONFIRM
  if [ "$CONFIRM" = "yes" ]; then
    "$TF_BIN" apply -input=false tfplan
    echo ""
    echo "=== 完了。主要な出力 ==="
    "$TF_BIN" output
    echo ""
    echo "次の手順:"
    echo "  1. GitHub Settings → Environments で 'dev' を作成し approver を設定（apply承認ゲート）"
    echo "  2. (任意) GitHubリポジトリ変数の設定 — 既定値はワークフローに埋め込み済みのため省略可"
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
