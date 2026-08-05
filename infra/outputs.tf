# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "cloudfront_domain_name" {
  description = "フロントエンド配信URL（https://<この値>/）"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "frontend_bucket" {
  description = "フロントエンド静的資産バケット"
  value       = aws_s3_bucket.frontend.id
}

output "uploads_bucket" {
  description = "ユーザアップロード用バケット"
  value       = aws_s3_bucket.uploads.id
}

output "artifacts_bucket" {
  description = "生成物用バケット"
  value       = aws_s3_bucket.artifacts.id
}

output "ecr_repository_urls" {
  description = "ECRリポジトリURL"
  value       = { for k, r in aws_ecr_repository.main : k => r.repository_url }
}

output "aurora_endpoint" {
  description = "Aurora クラスタエンドポイント"
  value       = aws_rds_cluster.main.endpoint
}

output "aurora_master_secret_arn" {
  description = "DBマスター認証情報のSecrets Manager ARN"
  value       = aws_rds_cluster.main.master_user_secret[0].secret_arn
}

output "app_env_secret_arn" {
  description = "アプリ環境変数シークレットのARN（mobilys/{env}/env）"
  value       = aws_secretsmanager_secret.app_env.arn
}

output "jobs_queue_url" {
  description = "ジョブキューURL"
  value       = aws_sqs_queue.jobs.url
}

output "github_deploy_role_arn" {
  description = "GitHub Actions用デプロイロールARN（リポジトリ変数 AWS_DEPLOY_ROLE_ARN に設定）"
  value       = aws_iam_role.github_deploy.arn
}
