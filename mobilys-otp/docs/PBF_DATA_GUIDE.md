# PBFデータガイド

本ガイドでは、道路ネットワーク分析のためにMobilys OTPサービスに新しいOSM（OpenStreetMap）またはDRM（デジタル道路地図）PBFファイルを追加する方法を説明します。

---

## 目次

- [概要](#概要)
- [データタイプ](#データタイプ)
- [フォルダ構成](#フォルダ構成)
- [ファイル命名規則](#ファイル命名規則)
- [OSMデータの追加](#osmデータの追加)
- [DRMデータの追加](#drmデータの追加)
- [検証](#検証)
- [データソース](#データソース)
- [現在利用可能なデータ](#現在利用可能なデータ)
- [トラブルシューティング](#トラブルシューティング)

---

## 概要

Mobilys OTPサービスは、道路ネットワークデータにPBF（Protocolbuffer Binary Format）ファイルを使用します。これらのファイルは、OpenTripPlannerが等時線計算や道路ネットワーク分析のためのルーティンググラフを構築するために使用されます。

道路ネットワークデータには2種類あります：
- **OSM（OpenStreetMap）** - オープンソースの地図データ
- **DRM（デジタル道路地図）** - 交通情報を含む日本の公式道路ネットワークデータ

---

## データタイプ

| タイプ | 説明 | 用途 |
|--------|------|------|
| OSM | OpenStreetMapデータ | 一般的な道路ネットワーク分析、全都道府県で利用可能 |
| DRM | デジタル道路地図データ | 詳細な道路属性（車線数、交通量、速度）を使用した交通シミュレーション |

---

## フォルダ構成

PBFファイルは`mobilys-otp`ディレクトリに格納されます：

```
mobilys-otp/
├── preloaded_osm_files/          # OSM PBFファイル
│   ├── Hokkaido.osm.pbf
│   ├── Tokyo.osm.pbf
│   ├── Osaka.osm.pbf
│   ├── Kagawa.osm.pbf
│   └── ... (47都道府県)
│
├── preloaded_drm_files/          # DRMファイル
│   ├── Kagawa.osm
│   ├── Toyama.osm
│   └── ... (限定された都道府県)
```

---

## ファイル命名規則

### OSMファイル

**形式:** `{都道府県名}.osm.pbf`

**ルール:**
- 都道府県名は**先頭大文字**（最初の文字を大文字）
- 都道府県名は**ローマ字**（英語表記）を使用
- ファイル拡張子は`.osm.pbf`

**例:**
| 都道府県 | 正しい | 間違い |
|----------|--------|--------|
| 東京都 | `Tokyo.osm.pbf` | `tokyo.osm.pbf`, `TOKYO.osm.pbf` |
| 香川県 | `Kagawa.osm.pbf` | `kagawa.osm.pbf`, `Kagawa.pbf` |
| 北海道 | `Hokkaido.osm.pbf` | `hokkaido.osm.pbf` |

### DRMファイル

**形式:** `{都道府県名}.osm.pbf`

**ルール:**
- 都道府県名は**先頭大文字**（最初の文字を大文字）
- 都道府県名は**ローマ字**（英語表記）を使用
- ファイル拡張子は`.osm.pbf`（OSMファイルと同じ形式）

**例:**
| 都道府県 | 正しい | 間違い |
|----------|--------|--------|
| 香川県 | `Kagawa.osm.pbf` | `kagawa.osm.pbf`, `Kagawa.osm` |
| 富山県 | `Toyama.osm.pbf` | `toyama.osm.pbf` |

---

## OSMデータの追加

### ステップ1：OSMデータをダウンロード

GeofabrikからPBFファイルをダウンロードします：

1. https://download.geofabrik.de/asia/japan.html にアクセス
2. 対象の都道府県を探す
3. `.osm.pbf`ファイルをダウンロード

### ステップ2：ファイル名を変更

ダウンロードしたファイルを命名規則に合わせてリネームします：

```bash
# 例：Geofabrikファイルを標準形式にリネーム
mv japan-latest.osm.pbf Osaka.osm.pbf
```

### ステップ3：プリロードフォルダにコピー

ファイルを`mobilys-otp/preloaded_osm_files/`にコピーします：

```bash
cp Osaka.osm.pbf /path/to/mobilys-otp/preloaded_osm_files/
```

### ステップ4：サービスを再起動

ファイルをフォルダにコピーするだけで自動的に認識されます。バックエンド設定の更新は不要です。

```bash
# プロジェクトのルートディレクトリから実行
docker-compose restart otp-fastapi
```

---

## DRMデータの追加

### ステップ1：DRMデータを準備

DRMデータは元の形式からOSM PBF形式への変換が必要です。データは通常、日本の道路交通センサスから取得します。

### ステップ2：OSM PBF形式に変換

生のDRMデータがある場合は、適切なツールを使用して`.osm.pbf`形式に変換します。

### ステップ3：ファイル名を変更

ファイルが命名規則に従っていることを確認します：

```bash
# 例
mv drm_kagawa_data.osm.pbf Kagawa.osm.pbf
```

### ステップ4：プリロードフォルダにコピー

ファイルを`mobilys-otp/preloaded_drm_files/`にコピーします：

```bash
cp Kagawa.osm.pbf /path/to/mobilys-otp/preloaded_drm_files/
```

### ステップ5：サービスを再起動

ファイルをフォルダにコピーするだけで自動的に認識されます。バックエンド設定の更新は不要です。

```bash
# プロジェクトのルートディレクトリから実行
docker-compose restart otp-fastapi
```

---


### 重要な注意事項

- 都道府県名は**完全に一致**する必要があります（大文字小文字を区別）
- ファイル名は先頭大文字のローマ字で、拡張子は`.osm.pbf`
- 例：`Kagawa.osm.pbf`、`Tokyo.osm.pbf`
- ファイルをフォルダにコピーするだけで自動認識されます（設定ファイルの編集は不要）

---

## 検証

### ファイルの存在確認

```bash
# OSMの場合
ls -la mobilys-otp/preloaded_osm_files/

# DRMの場合
ls -la mobilys-otp/preloaded_drm_files/
```

### API経由でテスト

サービスを再起動した後、PBF bboxエンドポイントをテストします：

```bash
# 新しい都道府県が認識されているか確認
curl "http://localhost:8001/pbf_bbox?prefecture=Kagawa"
```

期待されるレスポンス：
```json
{
  "status": "success",
  "bbox": {
    "min_lon": 133.xxx,
    "min_lat": 34.xxx,
    "max_lon": 134.xxx,
    "max_lat": 34.xxx
  }
}
```

### グラフ構築テスト

データが動作することを確認するためにテストグラフを構築します：

```bash
curl -X POST "http://localhost:8001/build_graph" \
  -F "scenario_id=test-123" \
  -F "prefecture=Kagawa" \
  -F "gtfs_file=@test_gtfs.zip"
```

---

## データソース

### OSMデータ

| ソース | URL | 説明 |
|--------|-----|------|
| Geofabrik | https://download.geofabrik.de/asia/japan.html | 事前抽出された日本の都道府県データ |
| Planet OSM | https://planet.openstreetmap.org/ | 完全なOpenStreetMapデータ |
| BBBike | https://extract.bbbike.org/ | カスタムエリア抽出 |

### DRMデータ

DRMデータは国土交通省の道路交通センサスから取得します。アクセスについてはデータ管理者にお問い合わせください。

---

## 現在利用可能なデータ

### OSMファイル（47都道府県）

日本の全47都道府県が利用可能です：

| 地方 | 都道府県 |
|------|----------|
| 北海道 | Hokkaido |
| 東北 | Aomori, Iwate, Miyagi, Akita, Yamagata, Fukushima |
| 関東 | Ibaraki, Tochigi, Gunma, Saitama, Chiba, Tokyo, Kanagawa |
| 中部 | Niigata, Toyama, Ishikawa, Fukui, Yamanashi, Nagano, Gifu, Shizuoka, Aichi |
| 近畿 | Mie, Shiga, Kyoto, Osaka, Hyogo, Nara, Wakayama |
| 中国 | Tottori, Shimane, Okayama, Hiroshima, Yamaguchi |
| 四国 | Tokushima, Kagawa, Ehime, Kochi |
| 九州 | Fukuoka, Saga, Nagasaki, Kumamoto, Oita, Miyazaki, Kagoshima, Okinawa |

---

## トラブルシューティング

### エラー：「PBF file not found」

**原因：** ファイルが存在しないか、名前が正しくありません。

**解決策：**
1. 正しいフォルダにファイルが存在することを確認
2. ファイル名が命名規則に一致していることを確認（先頭大文字）
3. ファイル拡張子を確認（OSMは`.osm.pbf`、DRMは`.osm`）

### エラー：「Prefecture not in available list」

**原因：** PBFファイルが正しいフォルダに存在しないか、ファイル名が正しくありません。

**解決策：**
1. ファイルが正しいフォルダ（OSMは`preloaded_osm_files/`、DRMは`preloaded_drm_files/`）にあることを確認
2. ファイル名が命名規則に従っていることを確認（先頭大文字、`.osm.pbf`拡張子）
3. `docker-compose restart otp-fastapi`でサービスを再起動

### エラー：「OTP build failed」

**原因：** PBFファイルが破損しているか互換性がありません。

**解決策：**
1. PBFファイルを再ダウンロード
2. `osmium fileinfo <file.osm.pbf>`でファイルの整合性を確認
3. OTPログで具体的なエラーメッセージを確認

### グラフ構築が遅い

**原因：** 道路が多い大規模な都道府県。

**解決策：**
1. OTPヒープメモリを増やす：`OTP_BUILD_HEAP=12G`以上に設定
2. 十分なシステムRAMを確保（16GB以上推奨）
3. 大規模な都道府県（東京、大阪、北海道）は10〜30分かかる場合があります

---

## クイックリファレンス

### OSM都道府県の追加

```bash
# 1. Geofabrikからダウンロード
wget https://download.geofabrik.de/asia/japan/kanto-region-latest.osm.pbf

# 2. リネーム（埼玉の例）
mv kanto-region-latest.osm.pbf Saitama.osm.pbf

# 3. フォルダにコピー
cp Saitama.osm.pbf mobilys-otp/preloaded_osm_files/

# 4. サービスを再起動（設定ファイルの編集は不要、自動認識されます）
docker-compose restart otp-fastapi
```

### DRM都道府県の追加

```bash
# 1. .osm.pbfファイルを準備

# 2. リネーム（大阪の例）
mv osaka_drm.osm.pbf Osaka.osm.pbf

# 3. フォルダにコピー
cp Osaka.osm.pbf mobilys-otp/preloaded_drm_files/

# 4. サービスを再起動（設定ファイルの編集は不要、自動認識されます）
docker-compose restart otp-fastapi
```
