# 環境構築マニュアル

# 1 本書について

本書では、地域公共交通計画策定支援ツール(以下「本ツール」という。)の利用環境構築手順について記載しています。本ツールの構成や仕様の詳細については以下を参考にしてください。

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


# 3 AWS EC2でのビルド手順

AWS EC2（Amazon Linux 2023）上で本ツールをデプロイする手順を説明します。
以下のコマンドは、すべて AWS マネジメントコンソールから開いた EC2 のターミナル上で実行します。

## 3-1 AWS 側の初期設定

### 前提条件

| 項目 | 内容 |
|---|---|
| リージョン | ap-northeast-1（東京）など任意 |
| OS（AMI） | Amazon Linux 2023（x86_64） |
| インスタンスタイプ | t3.xlarge 以上 |
| 構成 | 単一インスタンス上に全コンテナを配置 |
| コンテナ構成 | mobilys-be／mobilys-fe／mobilys-otp／mobilys-gtfs-validator |
| 接続方法 | EC2 Instance Connect（ブラウザ接続） |

### EC2 インスタンス作成手順

(1) AWS マネジメントコンソールにログインし、`EC2` を開きます。  
(2) `インスタンス` -> `インスタンスを起動` を選択します。  
(3) 以下を設定します。  
   - 名前: 任意（例: `mobilys-oss`）
   - AMI: `Amazon Linux 2023 AMI`
   - インスタンスタイプ: `t3.xlarge`
   - キーペア: `キーペアなしで続行`（EC2 Instance Connect 利用時）
   - ネットワーク設定: `パブリック IP の自動割り当て` を有効化  

(4) セキュリティグループのインバウンドルールを設定します。

| プロトコル | ポート | ソース | 用途 |
|---|---|---|---|
| TCP | 22 | EC2 Instance Connect | ブラウザからの接続 |
| TCP | 3000 | 利用者のIP帯 | Web UI |
| TCP | 8000 | 利用者のIP帯 | バックエンド API |
| TCP | 8080 | 利用者のIP帯 | OTP（nginx） |
| TCP | 80 / 443 | （任意）利用者のIP帯 | リバースプロキシ利用時 |

※ EC2 Instance Connect を使う場合、ポート22のソースIPは
  以下のAWS公式ページからリージョン別のIPレンジを確認して設定してください。
  https://ip-ranges.amazonaws.com/ip-ranges.json（サービス: EC2_INSTANCE_CONNECT）
  または「よくある問題」の通り一時的に 0.0.0.0/0 に変更して接続後、絞り込みを推奨します。

(5) `インスタンスを起動` を実行します。
(6) インスタンス状態が `実行中` になったら、`パブリック IPv4 アドレス` を控えます（以下、`＜EC2_IP＞` と表記）。

※ 停止・再起動でIPを変えたくない場合は、Elastic IP の割り当てを行うことを推奨します。

## 3-2 EC2 ターミナル接続とOS確認

(1) AWS マネジメントコンソールで `EC2` -> `インスタンス` を開き、対象インスタンスを選択します。  
(2) 右上の `接続` をクリックします。  
(3) `EC2 Instance Connect` タブを選択し、ユーザー名が `ec2-user` であることを確認して `接続` をクリックします。  
(4) ブラウザで EC2 ターミナルが開いたら、OS を確認します。  

```bash
cat /etc/os-release
```

`NAME="Amazon Linux"` と表示されることを確認してください。  

## 3-3 EC2 上での Git / Docker インストール

(1) パッケージ更新を実行します。  

```bash
sudo dnf update -y
```

(2) Git と Docker Engine をインストールします。  

```bash
sudo dnf install -y git docker
```

(3) Docker Compose Plugin をインストールします。  

```bash
mkdir -p ~/.docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/download/v2.38.2/docker-compose-linux-x86_64 \
  -o ~/.docker/cli-plugins/docker-compose
chmod +x ~/.docker/cli-plugins/docker-compose
```

(4) Docker サービスを起動し、自動起動を有効化します。  

```bash
sudo systemctl enable --now docker
```

(5) `ec2-user` が sudo なし Docker を実行できるよう、グループ追加します。  

```bash
sudo usermod -aG docker ec2-user
```

(6) Docker グループ反映のため、ターミナルからログアウトします。  

```bash
exit
```

(7) 3-2 の手順を再実施してEC2ターミナルに再接続し、バージョンを確認します。  

```bash
git --version
docker --version
docker compose version
```

## 3-4 ソースコード配置と環境変数設定

### ソースコード取得
以下のコマンドを実行します。
```bash
cd /home/ec2-user
git clone https://github.com/Project-LINKS-mlitoss/LINKS-Mobilys.git
cd LINKS-Mobilys
```

### `.env` ファイル作成
以下のコマンドを実行します。
```bash
cp mobilys-be/.env.example mobilys-be/.env
cp mobilys-fe/.env.example mobilys-fe/.env
cp mobilys-otp/.env.example mobilys-otp/.env
```

### EC2 用の接続設定

以下のコマンドを実行して、EC2のIPを自動的に設定します。

```bash
# EC2のIPを自動取得して設定（コピー&ペーストで実行可能）
EC2_IP=$(curl -s http://checkip.amazonaws.com | tr -d '\n')
echo "$EC2_IP"

sed -i "s/^DJANGO_ENV=.*/DJANGO_ENV=prod/" mobilys-be/.env
sed -i "s/^DEBUG=.*/DEBUG=False/" mobilys-be/.env
sed -i "s|^ALLOWED_HOSTS=.*|ALLOWED_HOSTS=\"localhost,127.0.0.1,$EC2_IP\"|" mobilys-be/.env
sed -i "s|^CORS_ALLOWED_ORIGINS=.*|CORS_ALLOWED_ORIGINS=\"http://$EC2_IP:3000\"|" mobilys-be/.env
grep -q '^CSRF_TRUSTED_ORIGINS=' mobilys-be/.env || echo "CSRF_TRUSTED_ORIGINS=\"http://$EC2_IP:3000,http://$EC2_IP:8000\"" >> mobilys-be/.env

sed -i "s|VITE_API_BASE_URL: http://localhost:8000/api|VITE_API_BASE_URL: http://$EC2_IP:8000/api|g" docker-compose.yml
sed -i "s|VITE_API_USERS_BASE_URL: http://localhost:8000/api|VITE_API_USERS_BASE_URL: http://$EC2_IP:8000/api|g" docker-compose.yml
```

人口メッシュデータや関連データインポートを利用する場合は、APIキーの取得・設定方法は、 [4-4節の初回実行時](#4-4-ビルド実行) を参照してください。

## 3-5 ビルド・デプロイ手順

(1) イメージをビルドします。

```bash
docker compose build
```

(2) コンテナをバックグラウンドで起動します。

```bash
docker compose up -d
```

(3) 起動状態を確認します。

```bash
docker compose ps
docker compose logs -f mobilys_fe
# ログ確認後、Ctrl+C で終了してください
```

(4) 全てのコンテナが起動したらブラウザから以下のURLを開き、本ツールにアクセスしてください。

URL：http://＜EC2_IP＞:3000

アクセス時にログインIDとパスワードを求められます。  
`mobilys-be/.env`にある以下を参照してください。  
`DEFAULT_ADMIN_USERNAME`  
`DEFAULT_ADMIN_PASSWORD`


## 3-6 停止・シャットダウン手順

(1) コンテナを削除せずにシステムを停止する場合：

```bash
docker compose stop
```
次回以降の起動：
```bash
docker compose start
```


(2) サービスをシャットダウンし、コンテナ/ネットワークを削除する場合：

```bash
docker compose down
```
次回以降の起動：
```bash
docker compose up
```


(3) DBデータを含むEC2環境を完全に初期化する場合：

```bash
docker compose down -v
```
次回以降の起動：
```bash
docker compose build
docker compose up -d
```

## 3-7 よくある問題

(1) EC2 ターミナルに接続できない場合：  

EC2 Instance Connect で接続エラーになる場合は、`3-1` のセキュリティグループ設定表の `ソース` を一時的に `0.0.0.0/0` に変更して接続確認してください。  
特に `TCP 22` を見直してください。接続確認後は、必要な IP 帯のみに戻すことを推奨します。


(2) `mobilys_be` コンテナが起動しない（permission denied）場合：

`entrypoint.sh` に実行権限がないか、改行コード（CRLF）の問題が原因のため、以下を実行してください。

```bash
cd /home/ec2-user/LINKS-Mobilys
ls -l mobilys-be/entrypoint.sh
chmod +x mobilys-be/entrypoint.sh
sed -i 's/\r$//' mobilys-be/entrypoint.sh

docker compose up -d db
docker compose up -d mobilys_be
docker compose ps
docker compose logs --tail=120 mobilys_be
```




# 4 ローカル環境へのビルド手順

自身でダウンロードしたソースファイルを使い、ローカル環境にビルドを行うことで、本ツールを利用することができます。  

## 4-1 ソースコードの取得

[こちら](https://github.com/Project-LINKS-mlitoss/LINKS-Mobilys/archive/refs/heads/main.zip)
から本ツールをダウンロードします。ダウンロード後、zipファイルを任意のフォルダにコピーしてください。

あるいはコマンドプロンプトから以下のコマンドを入力することでダウンロードすることができます。
```bash
git clone https://github.com/Project-LINKS-mlitoss/LINKS-Mobilys.git
cd LINKS-Mobilys
```
![](../resources/devMan/tutorial_033.png)

## 4-2 ソースファイル構成
本ツールのソースファイルの構成は以下のようになっています。

|フォルダ名|詳細|
|---|---|
|mobilys-be |バックエンド|
|mobilys-fe|フロントエンド|
|mobilys-otp|OpenTripPlannerを使用した経路探索サービス|
|mobilys-gtfs-validator|GTFSフィード検証マイクロサービス|


## 4-3 ビルド前準備
ビルドを行う際には以下のソフトウェアが必要です。

| ソフトウェア | 最低バージョン | 用途 |
|-------------|---------------|------|
| Docker | 20.10以上 | コンテナランタイム |
| Docker Compose | 2.0以上 | マルチコンテナオーケストレーション |
| Git | 2.30以上 | ソースコード管理 |

インストールされていない場合は以下の方法でインストールしてください。

### Docker/Docker Composeのインストール方法

以下の公式サイトから Docker Desktopをインストールしてください。
https://www.docker.com/products/docker-desktop/

インストール後、Docker Desktop を起動し、以下のコマンドが実行できることを確認します。バージョン情報が表示されていればインストール成功です。

```bash
docker --version
docker compose version
```


## 4-4 ビルド実行

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


(2) 以下のコマンドを入力し本ツールの実行環境をビルドします。

```bash
docker compose build
```

(3) 以下のコマンドを入力し本ツールの実行環境を起動します。

```bash
docker compose up
```

(4) システムにアクセス  
全てのコンテナが起動したらブラウザから以下のURLを開き、本ツールにアクセスしてください。  

URL：http://localhost:3000  

アクセス時にログインIDとパスワードを求められます。  
`mobilys-be/.env`にある以下を参照してください。  
`DEFAULT_ADMIN_USERNAME`  
`DEFAULT_ADMIN_PASSWORD`  


## 4-5 停止・シャットダウン手順

(1) コンテナを削除せずにシステムを停止する場合：

```bash
docker compose stop
```
次回以降の起動：
```bash
docker compose start
```


(2) サービスをシャットダウンし、コンテナ/ネットワークを削除する場合：

```bash
docker compose down
```
次回以降の起動：
```bash
docker compose up
```


(3) DBデータを含むローカル環境を完全に初期化する場合：

```bash
docker compose down -v
```
次回以降の起動：
```bash
docker compose build
docker compose up
```


# 5 準備物一覧

本ツールを利用するために以下のデータを入手・設定します。

|     | データ名              | 用途                 | 入手・設定概要                                                                                                               | 入力方法           |
| --- | --------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------ |
| ①  |施設データインポート | 全般| 関連データの施設データを取得するためのAPIキーを設定します。取得には国土交通データプラットフォームのAPIキーを使用します。| 本マニュアルの[初回実行時](#4-4-ビルド実行) を参照してください。|
| ②  |富山県の人口メッシュデータ | 全般 | 人口メッシュデータを取得するためのAPIキーを設定します。デフォルトでは富山県の人口データが表示されます。取得にはe-Stat APIを使用します。| 本マニュアルの[初回実行時](#4-4-ビルド実行)を参照してください。|
| ③  |富山県以外の人口メッシュデータ | 全般                 | ツールで表示したい人口メッシュデータをe-Stat APIを利用して入手します。| [人口メッシュデータインポートガイド](./doc/POPULATION_DATA_GUIDE.md) を参照してください。|
| ④  | 道路ネットワーク| 到達圏域分析        | 利用したいGTFSに含まれるすべての都道府県の道路ネットワークデータをダウンロード・インストールします。  |  [道路ネットワーク設定ガイド](./doc/PBF_DATA_GUIDE.md) を参照してください。         |
