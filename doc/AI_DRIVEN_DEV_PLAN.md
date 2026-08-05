# 安全なAI駆動開発 実行計画書（LINKS Mobilys）

## 1. 本書について

本書は、地域公共交通計画策定支援ツール「LINKS Mobilys」の開発・改修を **AI駆動開発（AIコーディングエージェントを活用した開発）で安全に進めるための計画** を定めるものです。

あわせて、現行の環境構築マニュアル（[doc/devMan.md](./devMan.md) 第3章）が前提とする **AWS EC2 単一インスタンス構成を、AWS Lambda（Lambda で困難なコンポーネントは AWS Fargate）を中心としたサーバレス構成へ移行する方針** を含みます。サーバレス構成の詳細設計は [サーバレスアーキテクチャ設計書（SERVERLESS_ARCHITECTURE.md）](./SERVERLESS_ARCHITECTURE.md) を参照してください。

### 参照資料

| 資料 | 内容 |
| --- | --- |
| [LINKS-Mobilys リポジトリ](https://github.com/Project-LINKS-mlitoss/LINKS-Mobilys) | ソースコード・環境構築マニュアル |
| [LINKS Mobilys 利用マニュアル（commmmons_doc_008_ver01.pdf）](https://www.mlit.go.jp/commmmons/document/008/commmmons_doc_008_ver01.pdf) | 機能・操作手順・動作環境 |
| [乗降実績データ標準仕様書（鉄道・バス）](https://www.mlit.go.jp/commmmons/document/005/) | 取り扱うデータの仕様 |

## 2. 現状アーキテクチャの整理

### 2-1 コンポーネント構成

| コンポーネント | 技術 | 役割 | 特性 |
| --- | --- | --- | --- |
| mobilys-fe | React 19 / Vite / MUI / Leaflet（nginx 配信） | SPA フロントエンド | ビルド後は静的ファイルのみ |
| mobilys-be | Django 5.2 / DRF / SimpleJWT / gunicorn | REST API・分析処理 | geopandas・osmnx 等の重量級地理空間ライブラリを使用。`gunicorn --timeout 900` が示す通り **最長15分級の同期処理** が存在 |
| db | PostgreSQL 15 + PostGIS 3.3（`pg_cron`・`pg_stat_statements` 有効） | 地理空間データベース | ステートフル |
| mobilys-otp | FastAPI + OpenTripPlanner 1.5（Java 11） | 到達圏分析の経路探索 | **`/var/run/docker.sock` をマウントし、GTFS ごとに OTP ルータコンテナを動的起動**（`mobilys-otp/app/infra/docker.py`）。nginx の設定ファイルを動的生成してルーティング |
| mobilys-gtfs-validator | FastAPI + MobilityData GTFS Validator（Java CLI） | GTFS 検証 | Java ヒープ 4G・タイムアウト900秒・最大300MBファイルのバッチ的処理 |

### 2-2 現行 EC2 構成の課題

devMan.md 第3章の構成（t3.xlarge 単一インスタンス・全コンテナ同居）には以下の課題があり、AI駆動開発で改修を積み重ねる前提としてはリスクが高い状態です。

1. **常時起動コスト**: 利用がない時間帯もインスタンス費用が発生する。
2. **単一障害点**: 1台にすべてが同居し、可用性・スケーラビリティがない。
3. **セキュリティ**:
   - Web UI・API・OTP が HTTP（平文）でポート直接公開（3000/8000/8080）。
   - `docker-compose.yml` に DB パスワード `admin` がハードコード。既定管理者の ID/パスワードが `.env` 依存。
   - OTP オーケストレータが `docker.sock` を保持（コンテナエスケープ時にホスト全権掌握が可能）。
   - バリデータの CORS が `allow_origins=["*"]`。
4. **運用**: OS・Docker のパッチ適用、ディスク管理などの手動運用が必要。

これらは後述のサーバレス移行（第5章・別紙設計書）と、AI駆動開発の「セキュリティ改善バックログ」（3-6）で解消します。

## 3. 安全なAI駆動開発のガードレール

### 3-1 基本原則

| # | 原則 | 内容 |
| --- | --- | --- |
| 1 | **人間による最終承認** | AI が生成したコード・IaC・設定変更は、必ず人間のレビュアーが承認してからマージ・デプロイする。AI に本番環境への直接アクセス権を与えない。 |
| 2 | **最小権限** | AI エージェントには読み取り専用を既定とし、書き込みは作業ブランチ＋Pull Request 経由に限定する。クラウド認証情報は開発環境のものだけを、必要な期間だけ付与する。 |
| 3 | **秘密情報の分離** | API キー（`ESTAT_API_KEY`・`MLIT_API_KEY`）、DB 認証情報、`SECRET_KEY` 等をリポジトリ・プロンプト・チャットログに含めない。AWS Secrets Manager で管理する（既存の `mobilys-be/scripts/load_env_from_aws.sh` の方式を全コンポーネントへ拡張）。 |
| 4 | **検証の自動化** | 「AI が書いたコードを人間が全行読む」だけに頼らず、CI の品質・セキュリティゲート（3-4）を通過しない変更はマージ不可とする。 |
| 5 | **透明性・追跡可能性** | AI が関与したコミット・PR はそれと分かるように明示（例: `Co-Authored-By` トレーラー、PR ラベル `ai-generated`）し、レビュー観点を変えられるようにする。 |
| 6 | **小さく変更し、段階的に出す** | 1 PR = 1 目的。巨大な自動生成差分を禁止し、dev → stg → prod の段階リリースとロールバック手順を常備する。 |

### 3-2 リポジトリ運用ルール

- **ブランチ戦略**: `main` は保護ブランチとし、直接 push を禁止。作業は `feature/*`（AI 作業は `claude/*` 等のプレフィックス）で行い、PR でマージする。
- **ブランチ保護設定**（GitHub）:
  - PR レビュー承認 1 名以上を必須（AI 生成 PR は人間の承認のみ有効）。
  - CI の必須ステータスチェック（3-4 のゲート）通過をマージ条件にする。
  - force push・ブランチ削除の禁止。
- **CODEOWNERS**: `mobilys-be/`・`mobilys-otp/`・`infra/`（IaC）等、影響の大きいディレクトリに所有者を定義し、該当変更のレビューを強制する。
- **AI 用コンテキストファイルの整備**: リポジトリ直下に `CLAUDE.md`（または `AGENTS.md`）を置き、ビルド・テストコマンド、変更してはならないファイル（例: `example/data` のサンプルデータ、`LICENSE`、`NOTICE`）、コーディング規約を明記する。AI の誤操作を仕組みで防ぐ最初の防壁となる。

### 3-3 AI エージェントの実行環境

- **サンドボックス実行**: AI エージェントはローカル開発マシンまたは使い捨てコンテナ／クラウドサンドボックス内で実行し、本番ネットワークへ到達できない環境で作業させる。
- **クラウド権限**: AI が AWS を操作する場合（IaC の plan 等）は、開発アカウントの読み取り専用ロール＋`plan`/`diff` までとし、`apply`/`deploy` は人間承認後の CI/CD パイプライン（OIDC 認証）だけが実行できるようにする。
- **プロンプトインジェクション対策**: 本ツールは GTFS フィード・CSV・外部 API（GTFS データリポジトリ、e-Stat、国土交通データプラットフォーム）など **外部由来データ** を扱う。AI エージェントにこれらのデータ内容を処理させる際は、データ内の文字列を「指示」として解釈しないよう、(1) データ処理と権限行使を同一セッションで行わない、(2) 外部データを扱うタスクではツール権限を読み取り専用に絞る、を徹底する。
- **セッションログの保存**: AI エージェントの作業ログ（実行コマンド・変更ファイル）を保存し、事後監査できるようにする。

### 3-4 CI/CD 品質・セキュリティゲート

GitHub Actions で以下を必須チェック化します（すべて OSS／GitHub 標準機能で構成可能）。

| ゲート | 対象 | ツール例 |
| --- | --- | --- |
| Lint / フォーマット | Python（be, otp, validator） | ruff |
| | JavaScript/React（fe） | ESLint（既存 `eslint.config.js`）+ Prettier |
| 単体・結合テスト | be（`simulation/tests` 等を拡充） | pytest + coverage（初期閾値を設定し漸増） |
| | fe | Vitest / React Testing Library |
| SAST（静的解析） | Python / JS | Semgrep, Bandit |
| シークレットスキャン | 全リポジトリ | gitleaks（CI）+ GitHub Secret Scanning / Push Protection |
| 依存関係脆弱性（SCA） | requirements.txt / package-lock.json | pip-audit, npm audit, Dependabot（自動 PR） |
| コンテナイメージスキャン | 各 Dockerfile / ECR イメージ | Trivy |
| IaC スキャン | infra/（CDK/Terraform） | Checkov または cdk-nag |
| GTFS リグレッション | GTFS 処理・変換ロジック | `example/data`（`joko-jisseki.csv`・`joko-syukei.csv`・`od.csv`）をゴールデンデータとした出力一致テスト |

**AI 駆動開発における位置づけ**: AI は大量の変更を高速に生成できるため、レビュー負荷が人間側のボトルネックになる。上表のゲートを「機械で落とせるものは機械で落とす」一次フィルタとし、人間レビューは設計判断・データ取扱い・セキュリティ境界の確認に集中させる。

### 3-5 テスト戦略（AI に変更させる前の安全網）

AI 駆動開発の安全性はリグレッションテストの充実度に比例します。改修に着手する **前** に以下を整備します。

1. **特性テスト（characterization test）の整備**: 既存挙動を固定するテストを主要 API（GTFS 取込、乗降分析、OD 分析、シミュレーション）に対して作成する。`example/data` のサンプルデータと `tmp/ic_card_dummy.csv` 等のダミーデータを入力とし、現行出力をスナップショットとして保存・比較する。
2. **シミュレーション計算の数値検証**: 費用便益分析等の計算ロジック（`mobilys-be/simulation/services`）は、マニュアル記載の計算例を検証ケース化し、AI による変更で数値が意図せず変わらないことを保証する。
3. **docker compose によるスモークテスト**: PR ごとに `docker compose build` と主要エンドポイントのヘルスチェック（be `/api`、validator `/healthz`、otp）を CI 上で実行する。

### 3-6 セキュリティ改善バックログ（AI 駆動開発の初期タスク）

現状コードで確認した改善項目です。**AI に依頼する最初の実務タスク群として適切**（影響範囲が明確・テストで検証可能）であり、Phase 0〜1 で消化します。

| 優先度 | 項目 | 該当箇所 |
| --- | --- | --- |
| 高 | DB 認証情報のハードコード排除（Secrets Manager / 環境変数注入へ） | `docker-compose.yml`（`POSTGRES_PASSWORD: admin`） |
| 高 | 既定管理者アカウントの初回強制変更・強パスワード生成 | `mobilys-be`（`DEFAULT_ADMIN_USERNAME/PASSWORD`） |
| 高 | `docker.sock` マウントの廃止（サーバレス移行で ECS API 呼び出しに置換） | `docker-compose.yml`, `mobilys-otp/app/infra/docker.py` |
| 高 | 全通信の HTTPS 化（CloudFront + ACM。EC2 構成では ALB/リバースプロキシ） | devMan.md 3-1 のポート直接公開 |
| 中 | バリデータの CORS `allow_origins=["*"]` の限定 | `mobilys-gtfs-validator/app/main.py` |
| 中 | JWT 設定（有効期限・ローテーション）の見直し | `mobilys-be/mobilys_BE/settings.py` |
| 中 | アップロードファイル（GTFS zip / CSV）のサイズ・拡張子・内容検証の強化 | be / validator |

### 3-7 データ取扱いの安全策

- **乗降実績データは要注意データとして扱う**: IC カードシステム等から出力される乗降実績データ（乗降日時・乗降停留所）は、粒度によっては個人の移動履歴となりうる。**実データを AI エージェントのプロンプト・学習・チャットへ投入することを禁止** し、開発・テストにはリポジトリ同梱のダミーデータ（`example/data`、`mobilys-be/tmp/ic_card_dummy.csv`）のみを使用する。
- **本番データベースへの AI アクセス禁止**: AI がスキーマを参照する必要がある場合はマイグレーションファイル・モデル定義（コード）から読み取らせる。
- **外部 API キーの管理**: e-Stat・国土交通データプラットフォームの API キーは Secrets Manager 管理とし、利用規約（レート制限等）をコード上のクライアントで強制する。

## 4. 開発プロセス（AI 駆動開発の標準フロー）

```
1. Issue 起票（人間）: 目的・受け入れ条件・触ってよい範囲を明記
2. AI が計画提示 → 人間が計画を承認（大きな変更は設計レビューを挟む）
3. AI が作業ブランチで実装 + テスト追加
4. CI ゲート（3-4）自動実行
5. 人間レビュー（設計判断・データ取扱い・セキュリティ境界に集中）
6. dev 環境へ自動デプロイ → 動作確認
7. stg で統合確認 → 人間承認 → prod デプロイ（ロールバック手順常備）
```

- **受け入れ条件を Issue に書き切る** ことが AI 駆動開発の品質を最も左右する。曖昧な指示での大規模変更を依頼しない。
- prod デプロイは CI/CD パイプライン経由のみ。手動変更（コンソール操作）は緊急時を除き禁止し、実施時は必ず IaC に反映する。

## 5. サーバレス移行方針（EC2 → Lambda / Fargate）

**方針: Lambda を第一候補とし、Lambda の制約（実行時間15分・常駐プロセス不可・Docker 操作不可）に適合しないコンポーネントのみ Fargate を採用する。**

| コンポーネント | 移行先 | 判定理由（要約） |
| --- | --- | --- |
| mobilys-fe | **S3 + CloudFront**（サーバ不要） | 静的 SPA のためコンピュートそのものが不要 |
| mobilys-be（同期 API） | **Lambda**（コンテナイメージ + Lambda Web Adapter） | リクエスト/レスポンス型で適合 |
| mobilys-be（長時間ジョブ） | **SQS + Lambda**、15分超は **Fargate タスク** | 現行 `--timeout 900` の同期処理を非同期ジョブ化 |
| mobilys-gtfs-validator | **Lambda**（Java コンテナ・非同期呼び出し） | バッチ的処理で適合。ただし900秒上限に近いため要計測、超過時は Fargate タスクへ |
| mobilys-otp（グラフ生成） | **Fargate タスク**（RunTask） | 長時間・大メモリの Java 処理で Lambda 不可 |
| mobilys-otp（経路探索サーバ） | **Fargate サービス** | 常駐 Java サーバ（Graph.obj 常時ロード）で Lambda 不可 |
| db（PostgreSQL + PostGIS + pg_cron） | **Aurora Serverless v2** + RDS Proxy | PostGIS / pg_cron 対応のサーバレス DB |

アーキテクチャ図・コンポーネント別詳細設計・必要なコード改修一覧・移行手順は **[サーバレスアーキテクチャ設計書](./SERVERLESS_ARCHITECTURE.md)** に定めます。

## 6. ロードマップ

| フェーズ | 期間目安 | 内容 | 完了条件 |
| --- | --- | --- | --- |
| **Phase 0: ガードレール整備** | 2週間 | ブランチ保護・CODEOWNERS・CI ゲート（lint / test / secret scan / SCA）導入、`CLAUDE.md` 整備、特性テスト整備（3-5）、セキュリティバックログ着手（3-6 の高優先度） | main 保護有効・CI 必須化・主要 API の特性テストが green |
| **Phase 1: 基盤構築** | 4週間 | IaC（infra/）で dev 環境構築: VPC、Aurora Serverless v2、ECR、S3/CloudFront。FE の S3+CloudFront 移行。GitHub Actions OIDC デプロイ | dev 環境で FE 配信 + DB 接続確認 |
| **Phase 2: BE / バリデータ移行** | 6週間 | BE の Lambda 化（Web Adapter）、長時間処理の非同期ジョブ分離（SQS + Lambda / Fargate タスク）、ファイル入出力の S3 化、バリデータの Lambda 非同期化 | dev で全 API がサーバレス経由で特性テスト通過 |
| **Phase 3: OTP 移行** | 6週間 | `docker.sock` 廃止 → ECS API 化、OTP ルータの Fargate サービス化、Graph.obj の S3/EFS 化、到達圏分析の E2E 確認 | 到達圏分析が Fargate 構成で動作 |
| **Phase 4: 本番化** | 4週間 | stg/prod 環境展開、負荷試験、脆弱性診断、監視・アラート（CloudWatch）、運用手順書、devMan.md 改訂 | prod 稼働・EC2 構成の廃止 |

各フェーズの成果物はすべて PR ベースで AI + 人間レビューのフローに乗せ、フェーズ末に振り返り（AI 生成コードの欠陥率・レビュー指摘傾向）を行いガードレールを調整します。

## 7. リスクと対応

| リスク | 対応 |
| --- | --- |
| AI が既存挙動を破壊する変更を生成 | 特性テスト（3-5）を先行整備し、CI で自動検出。1 PR の変更量を制限 |
| AI 生成コードに脆弱性が混入 | SAST / SCA / コンテナ・IaC スキャンの必須化（3-4）、セキュリティ観点のレビューチェックリスト |
| 秘密情報の漏えい（プロンプト・コミット経由） | Secrets Manager 集約、gitleaks + Push Protection、AI への実クレデンシャル非付与（3-1, 3-3） |
| 外部データ経由のプロンプトインジェクション | データ処理タスクの権限分離（3-3） |
| Lambda 制約（15分・ペイロード・コールドスタート）への不適合が後から発覚 | Phase 2 冒頭で実データ規模の計測を行い、閾値超過コンポーネントは早期に Fargate へ切替判断（設計書 5 章の判断基準） |
| サーバレス移行と機能開発の並走による競合 | フェーズ分割と CODEOWNERS による影響範囲の明確化。移行中は該当コンポーネントの機能改修を凍結 |
| レビュー負荷の増大 | CI ゲートによる一次フィルタ、PR サイズ制限、レビュー観点の標準化 |

## 8. 本計画の管理

- 本書および設計書は本リポジトリ `doc/` 配下で管理し、変更は PR で行う（計画自体も AI 駆動開発のガードレールに従う）。
- フェーズ完了ごとに本書のロードマップ・リスク表を更新する。
