# infra/ — AWS サーバレス環境の IaC（Terraform）

[サーバレスアーキテクチャ設計書](../doc/SERVERLESS_ARCHITECTURE.md) の Phase 1（基盤構築）を実装する Terraform 構成です。EC2 単一インスタンス構成（devMan.md 第3章）の置き換え先となる基盤を定義します。

## 現在のスコープ（Phase 1 / dev）

| リソース | 内容 | 設計書 |
| --- | --- | --- |
| VPC | 2AZ・パブリック/プライベートサブネット・NAT GW×1・S3エンドポイント | 2-6 |
| Aurora Serverless v2 | PostgreSQL 15互換・PostGIS/pg_cron/pg_stat_statements・0 ACU自動停止・認証情報はSecrets Manager管理 | 2-3 |
| S3 + CloudFront | FE静的配信（OAC・HTTPS強制・SPAフォールバック） | 2-1 |
| S3（uploads/artifacts） | アップロード（30日で自動削除・CORS）・生成物（バージョニング） | 2-6 |
| ECR ×3 | be / otp / gtfs-validator（push時スキャン） | 2-2〜2-5 |
| SQS + DLQ | 非同期ジョブキュー | 2-2 |
| Secrets Manager | `mobilys/{env}/env`（値は運用者が設定、Terraform管理外） | 2-6 |
| GitHub OIDC | Actions からのキーレスデプロイ用ロール | 計画書3-3 |

Phase 2以降（Lambda本体・Fargate/EFS・RDS Proxy・WAF）は本構成に追記していきます。

## 前提

- Terraform >= 1.10
- 専用のdev用AWSアカウント推奨（デプロイロールの既定ポリシーが AdministratorAccess のため。`variables.tf` の `deploy_role_policy_arn` 参照。stg/prod 前に最小権限化すること）

## 初回ブートストラップ（AWS権限を持つ運用者が1回だけ実施）

```bash
# 1. state用バケット作成（例）
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws s3 mb "s3://mobilys-terraform-state-${ACCOUNT_ID}" --region ap-northeast-1
aws s3api put-bucket-versioning \
  --bucket "mobilys-terraform-state-${ACCOUNT_ID}" \
  --versioning-configuration Status=Enabled
aws s3api put-public-access-block \
  --bucket "mobilys-terraform-state-${ACCOUNT_ID}" \
  --public-access-block-configuration \
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# 2. バックエンド設定
cd infra
cp backend.hcl.example backend.hcl   # バケット名を実値に変更

# 3. 初回 apply（以降はGitHub Actions経由）
terraform init -backend-config=backend.hcl
terraform plan -var-file=envs/dev.tfvars
terraform apply -var-file=envs/dev.tfvars
```

## 初回 apply 後の GitHub 設定

出力 `github_deploy_role_arn` を使い、リポジトリの **Settings → Secrets and variables → Actions → Variables** に以下を設定すると、以後のデプロイは GitHub Actions（`deploy-dev.yml`）から実行できます。

| Variable | 値 |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | `terraform output github_deploy_role_arn` の値 |
| `AWS_REGION` | `ap-northeast-1` |
| `TF_STATE_BUCKET` | state用バケット名 |

あわせて **Settings → Environments** で `dev` 環境を作成し、必要に応じて approver を設定してください（apply前の人間承認。計画書3-1）。

## 運用ルール（計画書3-3）

- `terraform apply` は原則 GitHub Actions（OIDC）経由。手動applyは緊急時のみとし、実施後は必ずコードと差分がないことを確認する
- AIエージェントは `plan` / `validate` / レビューまで。`apply` の実行判断は人間が行う
- 変更はすべてPR経由（`deploy-dev.yml` がPR時に fmt/validate/checkov を実行）

## シークレットの設定（apply後）

アプリ用シークレット `mobilys/dev/env` の値は Terraform 管理外です。運用者が設定します:

```bash
aws secretsmanager put-secret-value \
  --secret-id mobilys/dev/env \
  --secret-string '{"SECRET_KEY":"...","ESTAT_API_KEY":"...","MLIT_API_KEY":"..."}'
```

DBマスター認証情報は Aurora が自動管理します（出力 `aurora_master_secret_arn`）。

## コストに関する注意（dev）

- 常時課金は NAT Gateway（約$0.062/h + 転送）が主。Aurora は 0 ACU 停止で最小化
- 使わない期間が長い場合は `terraform destroy -var-file=envs/dev.tfvars` で全撤去し、必要時に再applyできる（stateがあるため再現可能）
