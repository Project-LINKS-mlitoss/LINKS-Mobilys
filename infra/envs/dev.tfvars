# dev 環境設定
env               = "dev"
region            = "ap-northeast-1"
github_repository = "masao-ctrl/LINKS-Mobilys"

# コスト最適化: アイドル時は 0 ACU（自動一時停止）
db_min_acu             = 0
db_max_acu             = 4
db_deletion_protection = false
db_skip_final_snapshot = true
