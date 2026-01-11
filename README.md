# GFF Parser Practice

教育用途の遺伝子配列抽出トレーニングツール。  
ユーザーがアップロードした Python コードを Cloud Run Job で実行し、GCS の参照データと照合します。

## 仕組み

- フロント: Next.js（Vercel）
- API: Next.js Route Handler → GCSに入力を保存 → Cloud Run Job起動
- 実行: Cloud Run Job（`job/`）が GCS から入力を取得し `/work` で実行
- 結果: `result.fasta` / `answer.fasta` / ログ / status.json を GCS に保存

## セットアップ

### 0) GCPの設定

最小構成の手順です。

#### 0-1. プロジェクト作成 + 課金有効化
GCP Consoleで新規プロジェクトを作成し、課金アカウントを紐付けます。

#### 0-2. 必要APIの有効化
```bash
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  storage.googleapis.com \
  iam.googleapis.com \
  serviceusage.googleapis.com
```

#### 0-3. GCSバケット作成
```bash
gcloud storage buckets create gs://YOUR_BUCKET \
  --location=asia-northeast1 \
  --uniform-bucket-level-access
```

#### 0-4. 参照データをGCSへアップロード
```bash
gcloud storage cp examples/ref_GRCh38_scaffolds.gff3 gs://YOUR_BUCKET/references/
gcloud storage cp examples/hs_ref_GRCh38_chr21.fa gs://YOUR_BUCKET/references/
```
`data/reference-datasets.json` の `gffObject` / `fastaObject` をこのパスに合わせます。

#### 0-5. サービスアカウント作成
**Vercel用（API）**: Cloud Run Job起動 + GCS書き込み  
**ジョブ実行用**: GCS読み書き

```bash
gcloud iam service-accounts create vercel-api
gcloud projects add-iam-policy-binding YOUR_PROJECT \
  --member="serviceAccount:vercel-api@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/run.admin"
gcloud projects add-iam-policy-binding YOUR_PROJECT \
  --member="serviceAccount:vercel-api@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"
gcloud projects add-iam-policy-binding YOUR_PROJECT \
  --member="serviceAccount:vercel-api@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

gcloud iam service-accounts create job-runtime
gcloud projects add-iam-policy-binding YOUR_PROJECT \
  --member="serviceAccount:job-runtime@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

#### 0-6. Cloud Run Job作成
```bash
gcloud artifacts repositories create gff-runner \
  --repository-format=docker \
  --location=asia-northeast1

gcloud builds submit \
  --tag asia-northeast1-docker.pkg.dev/YOUR_PROJECT/gff-runner/gff-runner:latest .

gcloud run jobs create gff-parser-job \
  --image asia-northeast1-docker.pkg.dev/YOUR_PROJECT/gff-runner/gff-runner:latest \
  --region asia-northeast1 \
  --service-account job-runtime@YOUR_PROJECT.iam.gserviceaccount.com
```

#### 0-7. Vercelの環境変数
`.env.sample` に合わせて設定します。  
`GCP_SERVICE_ACCOUNT_KEY_JSON` は **vercel-api** のJSONキー全文を貼り付けます。

### 1) GCSに参照データを配置

GFF/FASTA を GCS にアップロードし、`data/reference-datasets.json` に対応するオブジェクト名を設定します。

例:
- `references/ref_GRCh38_scaffolds.gff3`
- `references/hs_ref_GRCh38_chr21.fa`

### 2) Cloud Run Job をデプロイ

`job/Dockerfile` を使って Cloud Run Job を作成します。  
実行用サービスアカウントに GCS の読み書き権限を付与してください。

### 3) 環境変数

`.env.sample` を参照して Vercel / ローカルに設定します。

必要な変数:
- `GCP_PROJECT_ID`
- `GCP_REGION`
- `GCP_SERVICE_ACCOUNT_KEY_JSON`
- `CLOUD_RUN_JOB_NAME`
- `GCS_BUCKET`
- `GCS_JOB_PREFIX`（任意）

### 4) ローカル起動

```bash
yarn install
yarn dev
```

## 実行時の入出力

- 参照データ: GCS の固定パス（データセット選択で切替）
- 入力ファイル: `genes.txt`, `user.py`, `requirements.txt`（任意）
- 作業ディレクトリ: `/work`
- 出力: `result.fasta`（ユーザー出力）, `answer.fasta`（正解）

## 注意

ユーザー提供コードを実行するため、Cloud Run Job の権限と実行制限は最小化してください。
