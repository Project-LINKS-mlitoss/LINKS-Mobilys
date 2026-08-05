# Terraform state バックエンド設定（dev / アカウント 656827484543）
# 使用方法: terraform init -backend-config=backend.hcl
# state用バケットは bootstrap.sh が自動作成する。

bucket       = "mobilys-terraform-state-656827484543"
key          = "dev/terraform.tfstate"
region       = "ap-northeast-1"
encrypt      = true
use_lockfile = true
