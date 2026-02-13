# 人口メッシュデータインポートガイド

本ツールでは人口メッシュデータを背景地図として表示することができます。<br>
本ガイドでは、都道府県ごとの人口メッシュデータを追加する方法を説明します。

---

## 目次

- [概要](#概要)
- [前提条件](#前提条件)
- [インポートフロー](#インポートフロー)
- [クイックリファレンス](#クイックリファレンス)
- [詳しい手順](#詳しい手順)
- [コマンドリファレンス](#コマンドリファレンス)
- [使用例](#使用例)
- [検証](#検証)
- [トラブルシューティング](#トラブルシューティング)
- [都道府県一覧](#都道府県一覧)
- [データソース](#データソース)

---

## 概要

Mobilysプラットフォームは、等時線計算における人口分析のために、e-Stat（統計局）の500mメッシュ人口データを使用します。人口データは年齢層別に分類されています：

- **0〜14歳**: 年少人口
- **15〜64歳**: 生産年齢人口
- **65歳以上**: 高齢人口

デフォルトでは、**富山県**のデータのみがプリロードされています。他の都道府県で人口分析を使用するには、手動でデータをインポートする必要があります。

> **注意：自動ブートストラップ機能**
>
> 初回起動時、富山県の人口データは自動的にインポートされます。インポート完了後、`mobilys-be/`ディレクトリに`.visualization_data_bootstrapped`マーカーファイルが作成されます。
>
> - このファイルが存在する場合、次回以降の起動時に**富山県の自動インポート**のみスキップされます
> - **他の都道府県を追加する場合**、このファイルを削除する必要はありません。本ガイドの手順に従って手動でインポートしてください
> - 富山県のデータを**再インポート**する必要がある場合のみ、このファイルを削除してからコンテナを再起動してください

---

## 前提条件

人口データをインポートする前に、以下を確認してください：

1. **データベースが稼働中** - PostGISを含むPostgreSQL
2. **マイグレーションが適用済み**
3. **e-Stat APIキー** - `.env`ファイルに`ESTAT_API_KEY`として設定
4. **インターネット接続** - メッシュリストのダウンロードとe-Stat APIからの人口データ取得に必要
5. **Dockerコンテナが起動中**

### 推奨ターミナル

コマンドは以下のターミナルで実行することを推奨します：
- **Windows**: PowerShell、Windows Terminal、または Git Bash
- **macOS/Linux**: Terminal、iTerm2、またはお好みのターミナルエミュレータ

### 環境変数

`.env`ファイルに以下が設定されていることを確認してください：

```bash
ESTAT_API_KEY=your_estat_api_key_here
ESTAT_API_URL=https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData
```

> **注意:** e-Stat APIキーは https://www.e-stat.go.jp/ で登録することで取得できます。

---

## インポートフロー

インポートプロセスは3つのステップで構成されています：

```
┌─────────────────────────────────────────────────────────────────┐
│                    人口データインポートフロー                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ステップ1：メッシュリストのダウンロード（初回のみ）                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  download_prefecture_mesh_list                           │   │
│  │  stat.go.jpから47個のCSVファイルをダウンロード              │   │
│  │  保存先: data/mesh_lists/01.csv ~ 47.csv                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ステップ2：メッシュ位置情報のインポート（都道府県ごと）              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  import_mesh_list --prefecture 富山県                    │   │
│  │  メッシュコード→都道府県/市区町村マッピングをインポート         │   │
│  │  保存先: MeshLocationテーブル                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                           ▼                                     │
│  ステップ3：人口データのインポート（都道府県ごと）                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  import_population_mesh --prefecture 富山県              │   │
│  │  e-Stat APIから人口データを取得                           │   │
│  │  保存先: PopulationMeshテーブル                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```
---

## クイックリファレンス

### 新しい都道府県を追加する場合

```bash
# 1. メッシュリストをダウンロード（初回のみ）
docker-compose exec mobilys_be python manage.py download_prefecture_mesh_list

# 2. メッシュ位置情報をインポート
docker-compose exec mobilys_be python manage.py import_mesh_list --prefecture "都道府県名"

# 3. 人口データをインポート
docker-compose exec mobilys_be python manage.py import_population_mesh --prefecture "都道府県名"
```

### 例：福岡県を追加

```bash
docker-compose exec mobilys_be python manage.py import_mesh_list --prefecture "福岡県"
docker-compose exec mobilys_be python manage.py import_population_mesh --prefecture "福岡県"
```

---

## 詳しい手順

### ステップ1：メッシュリストCSVのダウンロード（初回のみ）

全47都道府県のメッシュコードマッピングファイルをダウンロードします。これは初回利用時のみ実行してください。

```bash
docker-compose exec mobilys_be python manage.py download_prefecture_mesh_list
```

このコマンドは：
- `stat.go.jp`からCSVファイルをダウンロード
- `data/mesh_lists/`フォルダに保存
- ファイルは都道府県コードで命名：`01.csv`（北海道）〜`47.csv`（沖縄県）

### ステップ2：メッシュ位置情報のインポート

対象都道府県のメッシュ位置マッピングをインポートします。

```bash
docker-compose exec mobilys_be python manage.py import_mesh_list --prefecture "富山県"
```

**重要：** 都道府県名は**日本語**で指定してください（例：`富山県`、`Toyama`等を入力すると正しくインポートできません）

このコマンドは：
- `data/mesh_lists/`から対応するCSVファイルを読み込み
- メッシュコードを都道府県/市区町村名にマッピングする`MeshLocation`レコードを作成
- 人口データのインポート前に必要

### ステップ3：人口データのインポート

e-Stat APIから実際の人口データをインポートします。

```bash
docker-compose exec mobilys_be python manage.py import_population_mesh --prefecture "富山県"
```

このコマンドは：
- e-Stat APIに500mメッシュ人口データを問い合わせ
- ステップ2でインポートしたメッシュコードでデータをフィルタリング
- ジオメトリと年齢層別人口を含む`PopulationMesh`レコードを作成

---

## コマンドリファレンス

### download_prefecture_mesh_list

全47都道府県のメッシュコードマッピングCSVをダウンロードします。

```bash
docker-compose exec mobilys_be python manage.py download_prefecture_mesh_list
```

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| (なし) | - | 全47都道府県のファイルをダウンロード |

**出力先：** `data/mesh_lists/`

---

### import_mesh_list

特定の都道府県のメッシュ位置データをインポートします。

```bash
docker-compose exec mobilys_be python manage.py import_mesh_list --prefecture <都道府県名>
```

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `--prefecture` | はい | 日本語の都道府県名（例：`富山県`） |

**データベーステーブル：** `MeshLocation`

---

### import_population_mesh

e-Stat APIから特定の都道府県の人口メッシュデータをインポートします。

```bash
docker-compose exec mobilys_be python manage.py import_population_mesh --prefecture <都道府県名>
```

| パラメータ | 必須 | 説明 |
|-----------|------|------|
| `--prefecture` | はい | 日本語の都道府県名（例：`富山県`） |

**データベーステーブル：** `PopulationMesh`

**使用API：** e-Stat統計API（2020年国勢調査データ）

---

## 使用例

### 例1：香川県を追加

```bash
# ステップ1：メッシュリストをダウンロード（実行済みの場合はスキップ）
docker-compose exec mobilys_be python manage.py download_prefecture_mesh_list

# ステップ2：香川県のメッシュ位置情報をインポート
docker-compose exec mobilys_be python manage.py import_mesh_list --prefecture "香川県"

# ステップ3：香川県の人口データをインポート
docker-compose exec mobilys_be python manage.py import_population_mesh --prefecture "香川県"
```

### 例2：東京都を追加

```bash
# メッシュ位置情報をインポート
docker-compose exec mobilys_be python manage.py import_mesh_list --prefecture "東京都"

# 人口データをインポート
docker-compose exec mobilys_be python manage.py import_population_mesh --prefecture "東京都"
```

### 例3：複数の都道府県を追加

```bash
# メッシュリストを一度ダウンロード
docker-compose exec mobilys_be python manage.py download_prefecture_mesh_list

# 大阪府をインポート
docker-compose exec mobilys_be python manage.py import_mesh_list --prefecture "大阪府"
docker-compose exec mobilys_be python manage.py import_population_mesh --prefecture "大阪府"

# 兵庫県をインポート
docker-compose exec mobilys_be python manage.py import_mesh_list --prefecture "兵庫県"
docker-compose exec mobilys_be python manage.py import_population_mesh --prefecture "兵庫県"

# 京都府をインポート
docker-compose exec mobilys_be python manage.py import_mesh_list --prefecture "京都府"
docker-compose exec mobilys_be python manage.py import_population_mesh --prefecture "京都府"
```

---

## 検証

### インポートしたメッシュ位置情報を確認

```bash
docker-compose exec mobilys_be python manage.py shell
```

```python
from visualization.models import MeshLocation

# 都道府県ごとのメッシュ位置数をカウント
from django.db.models import Count
MeshLocation.objects.values('prefecture_name').annotate(count=Count('id')).order_by('prefecture_name')
```

### インポートした人口データを確認

```python
from visualization.models import PopulationMesh

# 人口メッシュ数をカウント
PopulationMesh.objects.count()

# サンプルデータを確認
PopulationMesh.objects.first().__dict__
```

### SQLで検証

```bash
# メッシュ位置情報を確認
docker-compose exec db psql -U postgres -d mobilys -c "SELECT prefecture_name, COUNT(*) as mesh_count FROM visualization_meshlocation GROUP BY prefecture_name ORDER BY prefecture_name;"

# 人口データを確認
docker-compose exec db psql -U postgres -d mobilys -c "SELECT LEFT(meshcode, 4) as mcode_prefix, COUNT(*) as count, SUM(total) as total_population FROM visualization_populationmesh GROUP BY LEFT(meshcode, 4) ORDER BY mcode_prefix;"
```

---

## トラブルシューティング

### エラー：「No M-mesh codes found for prefecture」

**原因：** この都道府県のメッシュ位置情報がインポートされていません。

**解決策：** 先に`import_mesh_list`を実行してください：
```bash
docker-compose exec mobilys_be python manage.py import_mesh_list --prefecture "都道府県名"
```

### エラー：「No file matched for prefecture」

**原因：** メッシュリストCSVがダウンロードされていないか、都道府県名が正しくありません。

**解決策：**
1. `download_prefecture_mesh_list`を実行してCSVをダウンロード
2. 都道府県名が日本語であることを確認（例：`富山県`）

### エラー：「ESTAT_API_KEY not set」

**原因：** e-Stat APIキーが設定されていません。

**解決策：** `.env`ファイルに追加してください：
```bash
ESTAT_API_KEY=your_api_key_here
```

### インポートが遅い

**原因：** 大規模な都道府県はメッシュコードが多く、e-Stat APIにはレート制限があります。

**解決策：**
- 大規模な都道府県（東京都、大阪府）は10〜30分かかる場合があります
- オフピーク時間帯に実行
- 複数の都道府県の場合は夜間実行を検討

### APIレート制限超過

**原因：** e-Stat APIへのリクエストが多すぎます。

**解決策：**
- 再試行前に1時間待つ
- 一度に1つの都道府県をインポート
- インポートを複数日に分散することを検討

---

## 都道府県一覧

インポートコマンドを実行する際は**日本語名**を使用してください。

| コード | 日本語名 | ローマ字 |
|--------|----------|----------|
| 01 | 北海道 | Hokkaido |
| 02 | 青森県 | Aomori |
| 03 | 岩手県 | Iwate |
| 04 | 宮城県 | Miyagi |
| 05 | 秋田県 | Akita |
| 06 | 山形県 | Yamagata |
| 07 | 福島県 | Fukushima |
| 08 | 茨城県 | Ibaraki |
| 09 | 栃木県 | Tochigi |
| 10 | 群馬県 | Gunma |
| 11 | 埼玉県 | Saitama |
| 12 | 千葉県 | Chiba |
| 13 | 東京都 | Tokyo |
| 14 | 神奈川県 | Kanagawa |
| 15 | 新潟県 | Niigata |
| 16 | 富山県 | Toyama |
| 17 | 石川県 | Ishikawa |
| 18 | 福井県 | Fukui |
| 19 | 山梨県 | Yamanashi |
| 20 | 長野県 | Nagano |
| 21 | 岐阜県 | Gifu |
| 22 | 静岡県 | Shizuoka |
| 23 | 愛知県 | Aichi |
| 24 | 三重県 | Mie |
| 25 | 滋賀県 | Shiga |
| 26 | 京都府 | Kyoto |
| 27 | 大阪府 | Osaka |
| 28 | 兵庫県 | Hyogo |
| 29 | 奈良県 | Nara |
| 30 | 和歌山県 | Wakayama |
| 31 | 鳥取県 | Tottori |
| 32 | 島根県 | Shimane |
| 33 | 岡山県 | Okayama |
| 34 | 広島県 | Hiroshima |
| 35 | 山口県 | Yamaguchi |
| 36 | 徳島県 | Tokushima |
| 37 | 香川県 | Kagawa |
| 38 | 愛媛県 | Ehime |
| 39 | 高知県 | Kochi |
| 40 | 福岡県 | Fukuoka |
| 41 | 佐賀県 | Saga |
| 42 | 長崎県 | Nagasaki |
| 43 | 熊本県 | Kumamoto |
| 44 | 大分県 | Oita |
| 45 | 宮崎県 | Miyazaki |
| 46 | 鹿児島県 | Kagoshima |
| 47 | 沖縄県 | Okinawa |



## データソース

人口データの出典：
- **e-Stat（政府統計の総合窓口）**: https://www.e-stat.go.jp/
- **データセット**: 令和2年国勢調査 - 500mメッシュ人口
- **調査**: 令和2年国勢調査 人口及び世帯 500Mメッシュ
