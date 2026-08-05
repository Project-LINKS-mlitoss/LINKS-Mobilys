# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
#
# アプリケーション用シークレット（設計書2-6）:
# 既存 mobilys-be/scripts/load_env_from_aws.sh の命名規約 `mobilys/{env}/env` を踏襲。
# 値（ESTAT_API_KEY / MLIT_API_KEY / SECRET_KEY 等）は Terraform 管理外とし、
# 運用者が AWS CLI / コンソールから設定する（コードやstateに残さない）。
# DBの認証情報は aws_rds_cluster.manage_master_user_password が別途管理する。

resource "aws_secretsmanager_secret" "app_env" {
  name        = "${var.project}/${var.env}/env"
  description = "LINKS Mobilys application environment variables (${var.env})"

  tags = { Name = "${var.project}/${var.env}/env" }
}

resource "aws_secretsmanager_secret_version" "app_env_placeholder" {
  secret_id     = aws_secretsmanager_secret.app_env.id
  secret_string = jsonencode({})

  lifecycle {
    # 実際の値は運用者が設定するため、Terraformは初期プレースホルダのみ管理
    ignore_changes = [secret_string]
  }
}
