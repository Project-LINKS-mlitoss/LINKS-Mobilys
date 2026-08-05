# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
#
# Aurora Serverless v2（PostgreSQL 15互換 / PostGIS / pg_cron）— 設計書2-3
# 現行 docker-compose.yml の postgres 起動パラメータをパラメータグループへ移植。
# 認証情報は manage_master_user_password により Secrets Manager 管理。

resource "aws_db_subnet_group" "main" {
  name       = "${local.prefix}-db"
  subnet_ids = aws_subnet.private[*].id

  tags = { Name = "${local.prefix}-db-subnet-group" }
}

resource "aws_security_group" "db" {
  name        = "${local.prefix}-db"
  description = "Aurora PostgreSQL"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from application tier"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  # egress なし = アウトバウンド全拒否（DBから外向き通信は不要）

  tags = { Name = "${local.prefix}-db-sg" }
}

resource "aws_rds_cluster_parameter_group" "main" {
  name   = "${local.prefix}-aurora-pg15"
  family = "aurora-postgresql15"

  # docker-compose.yml の command 指定パラメータを移植
  parameter {
    name         = "shared_preload_libraries"
    value        = "pg_cron,pg_stat_statements"
    apply_method = "pending-reboot"
  }

  # cron.database_name は静的パラメータのため pending-reboot 必須
  parameter {
    name         = "cron.database_name"
    value        = "mobilys"
    apply_method = "pending-reboot"
  }

  parameter {
    name  = "pg_stat_statements.track"
    value = "all"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  tags = { Name = "${local.prefix}-aurora-pg15-params" }
}

resource "aws_rds_cluster" "main" {
  cluster_identifier = "${local.prefix}-aurora"
  engine             = "aurora-postgresql"
  engine_mode        = "provisioned"
  engine_version     = var.db_engine_version
  database_name      = "mobilys"

  master_username             = "mobilys_admin"
  manage_master_user_password = true

  db_subnet_group_name            = aws_db_subnet_group.main.name
  vpc_security_group_ids          = [aws_security_group.db.id]
  db_cluster_parameter_group_name = aws_rds_cluster_parameter_group.main.name

  serverlessv2_scaling_configuration {
    min_capacity = var.db_min_acu
    max_capacity = var.db_max_acu
  }

  storage_encrypted         = true
  backup_retention_period   = 7
  copy_tags_to_snapshot     = true
  deletion_protection       = var.db_deletion_protection
  skip_final_snapshot       = var.db_skip_final_snapshot
  final_snapshot_identifier = var.db_skip_final_snapshot ? null : "${local.prefix}-aurora-final"

  # RDS Proxy（Phase 2）からのIAM認証接続に備え有効化
  iam_database_authentication_enabled = true

  enabled_cloudwatch_logs_exports = ["postgresql"]

  tags = { Name = "${local.prefix}-aurora" }
}

resource "aws_rds_cluster_instance" "main" {
  identifier         = "${local.prefix}-aurora-1"
  cluster_identifier = aws_rds_cluster.main.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.main.engine
  engine_version     = aws_rds_cluster.main.engine_version

  auto_minor_version_upgrade   = true
  performance_insights_enabled = true # 7日保持は無料枠

  tags = { Name = "${local.prefix}-aurora-1" }
}
