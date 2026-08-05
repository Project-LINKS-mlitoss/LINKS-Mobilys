# AI駆動開発ハーネス（.claude/）

本ディレクトリは、LINKS Mobilys のAI駆動開発（[doc/AI_DRIVEN_DEV_PLAN.md](../doc/AI_DRIVEN_DEV_PLAN.md)）で使用する Claude Code 用ハーネス一式です。

## 出所（プロベナンス）

- 取得元: [affaan-m/ECC](https://github.com/affaan-m/ECC)（"the agent harness operating system"）
- 取得時コミット: `f1fec0e53934737d3b3b8388b0fd1651e8b62f4f`
- ライセンス: MIT（[LICENSE-ECC](./LICENSE-ECC) を同梱）
- 取得日: 2026-08-05

ECC全体（スキル283種・エージェント67種等）から、本プロジェクトの技術スタック（Django / DRF / React / FastAPI / PostgreSQL+PostGIS / Docker / AWSサーバレス移行）に適合するサブセットのみを選定して取り込んでいます。

## 収録内容

| ディレクトリ | 内容 | 用途 |
| --- | --- | --- |
| `agents/` | サブエージェント定義 12種（planner, code-reviewer, security-reviewer, django/python/react/fastapi/database-reviewer, tdd-guide, build-error-resolver, silent-failure-hunter, performance-optimizer） | レビュー・計画・デバッグの専門エージェント |
| `commands/` | スラッシュコマンド 10種（/plan, /code-review, /security-scan, /python-review, /react-review, /fastapi-review, /test-coverage, /build-fix, /review-pr, /quality-gate） | 定型ワークフローの呼び出し |
| `skills/` | スキル 24種（django-patterns / django-security / django-tdd / python-testing / react-patterns / postgres-patterns / docker-patterns / database-migrations / deployment-patterns / security-review / tdd-workflow / verification-loop ほか） | 分野別のベストプラクティス知識 |
| `rules/` | コーディングルール（common / python / react / web） | CLAUDE.md から参照される規約 |

## 採用ポリシー（重要）

- **実行コードを伴わないMarkdownアセットのみ**を取り込んでいます。取り込み時に全ファイルに対して不審なパターン（外部への送信、fetch-and-execute、インジェクション的記述）のスキャンを実施済みです。
- **ECCのフック（hooks/）は意図的に取り込んでいません。** ECCのフックはツール実行のたびに第三者のNodeランタイム（EccプラグインのJSスクリプト群）を実行する構造であり、[AI駆動開発計画書](../doc/AI_DRIVEN_DEV_PLAN.md) 3-3/3-4 のガードレール（第三者コードのレビューなし実行の禁止）に基づき、導入する場合は個別レビューのうえ `settings.json` に明示的に設定してください。フル機能が必要な場合は各開発者が公式配布経路（プラグイン `ecc@ecc` / npm `ecc-universal`）から自身の判断でインストールしてください。
- 本ディレクトリへの変更は通常のPRフロー（人間レビュー必須）に従います。
- 上流ECCの更新を取り込む場合は、取得時コミットを本READMEに記録し、差分を再スキャンしてください。
