# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT

variable "project" {
  description = "プロジェクト名（リソース名プレフィックス）"
  type        = string
  default     = "mobilys"
}

variable "env" {
  description = "環境名（dev / stg / prod）"
  type        = string
}

variable "region" {
  description = "AWSリージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "github_repository" {
  description = "GitHub Actions OIDC を許可するリポジトリ（owner/repo）"
  type        = string
}

variable "vpc_cidr" {
  description = "VPCのCIDR"
  type        = string
  default     = "10.60.0.0/16"
}

variable "db_engine_version" {
  description = "Aurora PostgreSQL エンジンバージョン（0 ACU停止には15.7以上が必要）"
  type        = string
  default     = "15.12"
}

variable "db_min_acu" {
  description = "Aurora Serverless v2 最小ACU（0でアイドル時自動停止）"
  type        = number
  default     = 0
}

variable "db_max_acu" {
  description = "Aurora Serverless v2 最大ACU"
  type        = number
  default     = 4
}

variable "db_deletion_protection" {
  description = "DBクラスタの削除保護（prodではtrue必須）"
  type        = bool
  default     = false
}

variable "db_skip_final_snapshot" {
  description = "削除時の最終スナップショットをスキップ（devのみtrue可）"
  type        = bool
  default     = true
}

variable "upload_cors_origins" {
  description = "アップロード用S3バケットのCORS許可オリジン（CloudFrontドメイン確定後に絞り込むこと）"
  type        = list(string)
  default     = ["*"]
}

variable "deploy_role_policy_arn" {
  description = <<-EOT
    GitHub Actions デプロイロールに付与するポリシーARN。
    既定は AdministratorAccess（専用devアカウントでの利用が前提）。
    stg/prod 展開前に最小権限ポリシーへ置き換えること（計画書3-3）。
  EOT
  type        = string
  default     = "arn:aws:iam::aws:policy/AdministratorAccess"
}
