# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
#
# GitHub Actions OIDC（計画書3-3）:
# 長期キーを発行せず、OIDCフェデレーションで一時認証情報を取得する。
# デプロイ（terraform apply / イメージpush）はこのロール経由でのみ実行する。
#
# 注意: 既定ポリシーは AdministratorAccess（var.deploy_role_policy_arn）。
# 専用devアカウントでの利用を前提とし、stg/prod 展開前に最小権限化すること。

resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
    "1c58a3a8518e8759bf075b76b750d4f2df264fcd",
  ]
}

data "aws_iam_policy_document" "github_deploy_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:*"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name                 = "${local.prefix}-github-deploy"
  assume_role_policy   = data.aws_iam_policy_document.github_deploy_assume.json
  max_session_duration = 3600

  tags = { Name = "${local.prefix}-github-deploy" }
}

resource "aws_iam_role_policy_attachment" "github_deploy" {
  role       = aws_iam_role.github_deploy.name
  policy_arn = var.deploy_role_policy_arn
}
