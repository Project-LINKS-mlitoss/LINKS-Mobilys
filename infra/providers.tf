# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project     = var.project
      Environment = var.env
      ManagedBy   = "terraform"
      Repository  = var.github_repository
    }
  }
}

data "aws_caller_identity" "current" {}

locals {
  prefix     = "${var.project}-${var.env}"
  account_id = data.aws_caller_identity.current.account_id
}
