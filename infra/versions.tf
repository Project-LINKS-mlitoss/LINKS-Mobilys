# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT

terraform {
  # S3ネイティブロック（use_lockfile）を使うため 1.10 以上
  required_version = ">= 1.10.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.60.0, < 7.0.0"
    }
  }

  backend "s3" {
    # 値は backend.hcl で注入する（infra/README.md 参照）
  }
}
