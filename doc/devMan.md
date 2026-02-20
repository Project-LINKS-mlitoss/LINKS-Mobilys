# 環境構築手順書

# 1 本書について

本書では、地域公共交通計画策定支援ツール(以下「本ツール」という。)の利用環境構築手順について記載しています。本ツールの構成や仕様の詳細については以下も参考にしてください。

技術検証レポート（2026年3月公開予定）

# 2 動作環境

本ツールの動作環境は以下のとおりです。

| 項目 | 最小動作環境| 推奨動作環境  | 
| --------- | ------| --- | 
| OS| Microsoft Windows 10 または11|  同左 | 
| CPU  | Intel Core i5以上| Intel Core i7以上| 
| メモリ| 8GB以上  | 16GB以上 | 
| ディスプレイ解像度 | 1024×768以上  | 同左 | 
| ネットワーク       | 地図表示機能を使用する場合、以下のURLを閲覧できる環境が必要・地理院地図（国土地理院）　<br>http://cyberjapandata.gsi.go.jp<br>・標準地図<br>https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png<br>・淡色地図<br>https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png<br>・白地図<br>https://cyberjapandata.gsi.go.jp/xyz/blank/{z}/{x}/{y}.png<br>・写真<br>https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg<br><br>GTFSデータリポジトリに登録されているGTFSデータをインポートする機能を使用する場合、以下のAPIが利用できる環境が必要<br>・GTFSデータリポジトリ<br>http://docs.gtfs-data.jp/api.v2.html<br><br>人口メッシュデータを表示する場合、以下のAPIが利用できる環境が必要<br>・e-Stat<br>https://www.e-stat.go.jp/mypage/user/preregister<br><br>関連データとして医療機関と学校のデータを表示する場合、以下のAPIが利用できる環境が必要<br>・国土交通データプラットフォーム<br>https://data-platform.mlit.go.jp/api_docs/|  同左      


# 3 インストール手順

[こちら](https://github.com/Project-LINKS-mlitoss/LINKS-Mobilys/archive/refs/heads/main.zip)
から本ツールをダウンロードします。ダウンロード後、zipファイルを任意のフォルダにコピーしてください。<br>

あるいはコマンドプロンプトから以下のコマンドを入力することでダウンロードすることができます。
```bash
git lfs clone https://github.com/Project-LINKS-mlitoss/LINKS-Mobilys.git
cd gtfs-analysis-tool
```
![](../resources/devMan/tutorial_033.png)

# 4 ローカル環境へのビルド手順

自身でダウンロードしたソースファイルを使い、ローカル環境にビルドを行うことで、本ツールを利用することができます

## 4-1 前提条件
本ツールのソースファイルの構成は以下のようになっています。

![](../resources/devMan/tutorial_028.png)

## 4-2 ビルド前準備
ビルドを行う際には以下のソフトウェアが必要です。<br>以下がインストールされていることを確認してください。
| ソフトウェア | 最低バージョン | 用途 |
|-------------|---------------|------|
| Docker | 20.10以上 | コンテナランタイム |
| Docker Compose | 2.0以上 | マルチコンテナオーケストレーション |
| Git LFS | 3.0以上 | 大容量ファイルストレージ（OTP JARファイル用） |

インストールされていない場合は以下の方法でを行ってください。

(1) Docker/Docker Composeのインストール方法<br>

以下の公式サイトから Docker Desktopをインストールしてください。
https://www.docker.com/products/docker-desktop/

インストール後、Docker Desktop を起動し、以下のコマンドが実行できることを確認します。<br>バージョン情報が表示されいればインストール成功です。

```bash
docker --version
docker compose version
```

(2)Git LFS のインストール方法<br>

以下の公式サイトからインストーラーをダウンロードしてください。<br>
https://git-lfs.com/<br>

インストール完了後、ターミナル（または Git Bash）で以下を実行します。<br>

```bash
git lfs install
```
以下のコマンドでバージョンが表示されていればインストール成功です。
```bash
git lfs version
```

## 4-3 ビルド実行

### 初回実行時
(1) コマンドプロンプト等のターミナルに以下のコマンドを入力し、環境変数を設定します。

```bash
cp mobilys-be/.env.example mobilys-be/.env
cp mobilys-fe/.env.example mobilys-fe/.env
cp mobilys-otp/.env.example mobilys-otp/.env
```
人口メッシュデータを本ツール上に表示させる場合は、以下のAPIキーを取得・設定する必要があります。

**ESTAT_API_KEY（e-Stat API）**
1. [e-Stat ユーザー登録ページ](https://www.e-stat.go.jp/mypage/user/preregister)にアクセス
2. アカウントを登録し、メールアドレスを確認
3. ログイン後、マイページ画面から必要事項を記入の上APIキーを取得
4. `mobilys-be/.env`にキーを追加：`ESTAT_API_KEY=your_api_key_here`

「関連データインポート」機能の「施設データインポート」を利用する場合は、以下のAPIキーを取得・設定する必要があります。

**MLIT_API_KEY（国土交通データプラットフォームAPI）**
1. [国土交通データプラットフォーム アカウント登録](https://data-platform.mlit.go.jp/#/Login)にアクセス
2. アカウントを登録し、ログインを行う
3. ログイン後、API設定画面でAPIキーを取得
4. `mobilys-be/.env`にキーを追加：`MLIT_API_KEY=your_api_key_here`


(2) 以下のコマンドを入力し本ツールの実行環境をビルドします
```bash
docker-compose build
```

(3) 以下のコマンドを入力し本ツールの実行環境を起動します
```bash
docker-compose up
```

(4)システムにアクセス
全てのコンテナが起動したらブラウザから以下のURLを開き、本ツールにアクセスしてください。<br>

URL：http://localhost:300
アクセス時にログインIDとパスワードを求められます。<br>
`mobilys-be/.env`にある以下を参照してください<br>
`DEFAULT_ADMIN_USERNAME`<br>
`DEFAULT_ADMIN_PASSWORD`


### ツールの利用終了時

コンテナを削除せずにシステムを停止する場合：

```bash
docker-compose stop
```
> **次回以降の起動**
>
> 次回以降の起動では以下のコマンドを実行してください
```bash
docker-compose start
```

<br>サービスをシャットダウンし、コンテナ/ネットワークを削除する場合：

```bash
docker-compose down
```
> **次回以降の起動**
>
> 次回以降の起動では(3)を実行してください

<br>名前付きボリュームも削除してローカル環境を完全に初期化する場合（DBデータを含む）：

```bash
docker-compose down -v
```
> **次回以降の起動**
>
> 次回以降の起動では(2)を実行してください


## 4-4 参考情報

### 4-4-1 ソースファイル構成

ソースファイルの構成と機能は以下のようになっています。コードを修正する際の参考としてください。

|フォルダ名|詳細|
|---|---|
|mobilys-be |バックエンド|
|mobilys-fe|フロントエンド|
|mobilys-otp|OpenTripPlannerを使用した経路探索サービス|
|mobilys-gtfs-validator|GTFSフィード検証マイクロサービス|
<br>

# 5 IaaS環境上でのビルド手順


本ツールは、AWS EC2 等の IaaS 環境上にデプロイして利用することも可能です。  
本章では、EC2 インスタンス 1 台構成で、本ツールを構成する各コンテナを起動する方法を示します。

> 基本的なビルド・起動手順は「4 ローカル環境へのビルド手順」と同一です。  
> 本章では、AWS EC2 固有の設定事項のみを補足します。

## 5-1 前提条件・構成

### EC2 インスタンス条件

| 項目 | 内容 |
|---|---|
| インスタンスタイプ | t3.xlarge |
| OS | Amazon Linux 2023 / Ubuntu 22.04 LTS（いずれか） |
| 構成 | 単一インスタンス上に全コンテナを配置 |
| コンテナ構成 | mobilys-be／mobilys-fe／mobilys-otp／mobilys-gtfs-validator |

## 5-2 セキュリティグループ設定

EC2 に割り当てるセキュリティグループで、以下のポートを許可してください。

| プロトコル | ポート | 用途 |
|---|---|---|
| TCP | 22 | SSH 接続 |
| TCP | 3000 | 本ツール（Web UI） |
| TCP | 80 / 443 | （任意）リバースプロキシ利用時 |
| TCP | 8000| バックエンド |
| TCP | 8080| OTP |

※ 実運用では、22 番ポートの接続元 IP 制限や、HTTPS 化を推奨します。

## 5-3 EC2 上での Docker 環境構築

EC2 上で本ツールを利用する場合、  
フロントエンドおよびバックエンドの接続先として `localhost` は使用できません。
そのため、`.env` ファイル内の一部設定を EC2 インスタンス自身の IP アドレスに変更する必要があります。

ここで指定する 「自身の IP アドレス」とは、本ツールをデプロイしている EC2 インスタンスに割り当てられているパブリック IPv4 アドレスを指します。

### EC2 インスタンスの IP アドレス確認方法

AWS マネジメントコンソールで以下の手順により確認できます。

1. AWS マネジメントコンソールにログイン
2. EC2 サービスを開く
3. 対象の EC2 インスタンスを選択
4. 「パブリック IPv4 アドレス」を確認

以下では ＜EC2のIPアドレス＞ と表記します。

### フロントエンド（mobilys-fe）の設定
mobilys-fe/.env を開き、以下の項目を修正します。
```bash
VITE_API_BASE_URL=http://＜EC2のIPアドレス＞
```

### バックエンド（mobilys-be）の設定
mobilys-be/.env を開き、以下の項目を修正します。
```bash
CORS_ALLOWED_ORIGINS=http://＜EC2のIPアドレス＞
```

## 5-4 EC2 上での Docker 環境構築

EC2 上で Docker / Docker Compose をインストールしてください。  
インストール手順および確認方法は [ビルド前準備](#4-2-ビルド前準備)と同様です。

## 5-5 ビルド実行

本マニュアルの[ビルド実行](#4-3-ビルド実行)と同じ方法でビルド実行してください。




# 6 準備物一覧

本ツールを利用するために以下のデータを入手・設定します。

|     | データ名              | 用途                 | 入手・設定概要                                                                                                               | 入力方法           |
| --- | --------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------ |
| ①  |施設データインポート | 全般| 関連データの施設データを取得するためのAPIキーを設定します。取得には国土交通データプラットフォームのAPIキーを使用します。| 本マニュアルの[初回実行時](#4-3-ビルド実行) を参照してください。|
| ②  |富山県の人口メッシュデータ | 全般 | 人口メッシュデータを取得するためのAPIキーを設定します。デフォルトでは富山県の人口データが表示されます。取得にはe-Stat APIを使用します。| 本マニュアルの[初回実行時](#4-3-ビルド実行)を参照してください。|
| ③  |富山県以外の人口メッシュデータ | 全般                 | ツールで表示したい人口メッシュデータをe-Stat APIを利用して入手します。| [人口メッシュデータインポートガイド](./doc/POPULATION_DATA_GUIDE.md) を参照してください。|
| ④  | 道路ネットワーク| 到達圏域分析        | 利用したいGTFSに含まれるすべての都道府県の道路ネットワークデータをダウンロード・インストールします。  |  [道路ネットワーク設定ガイド](./doc/PBF_DATA_GUIDE.md) を参照してください。         |
