# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
#
# コンテナレジストリ（設計書2-2/2-4/2-5）:
# Lambda（コンテナイメージ）・Fargate 共用。push時に脆弱性スキャン。

locals {
  ecr_repositories = [
    "mobilys-be",             # Django API（Lambda Web Adapter）/ ジョブワーカー
    "mobilys-otp",            # OTP ルータ / グラフ生成（Fargate）
    "mobilys-gtfs-validator", # GTFS バリデータ（Lambda / Fargate 共用）
  ]
}

resource "aws_ecr_repository" "main" {
  for_each = toset(local.ecr_repositories)

  name                 = "${var.project}/${var.env}/${each.value}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = { Name = each.value }
}

resource "aws_ecr_lifecycle_policy" "main" {
  for_each   = aws_ecr_repository.main
  repository = each.value.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "直近20イメージのみ保持"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 20
        }
        action = { type = "expire" }
      }
    ]
  })
}
