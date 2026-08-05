# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
#
# 非同期ジョブキュー（設計書2-2）:
# 長時間処理（GTFSインポート・シミュレーション・データ変換等）の受け渡し。
# 3回失敗でDLQへ。DLQ滞留はCloudWatchアラーム対象（Phase 4）。

resource "aws_sqs_queue" "jobs_dlq" {
  name                      = "${local.prefix}-jobs-dlq"
  message_retention_seconds = 1209600 # 14日
  sqs_managed_sse_enabled   = true

  tags = { Name = "${local.prefix}-jobs-dlq" }
}

resource "aws_sqs_queue" "jobs" {
  name                       = "${local.prefix}-jobs"
  visibility_timeout_seconds = 960    # ワーカー最大実行時間（15分）+ 余裕
  message_retention_seconds  = 345600 # 4日
  sqs_managed_sse_enabled    = true

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.jobs_dlq.arn
    maxReceiveCount     = 3
  })

  tags = { Name = "${local.prefix}-jobs" }
}
