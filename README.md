# GFF Parser Practice

教育用途の遺伝子配列抽出トレーニングツール。
ユーザーがアップロードした Python コードを Cloud Run Job で実行し、GCS の参照データと照合します。

## 仕組み

- フロント: Next.js（Vercel）
- API: Next.js Route Handler → GCSに入力を保存 → Cloud Run Job起動
- 実行: Cloud Run Job（`job/`）が GCS から入力を取得し `/work` で実行
- 結果: `result.fasta` / ログ / status.json を GCS に保存
- 検証: データセットごとに `answer.fasta` を自動ダウンロードして検証

## セットアップ

### 0) GCPの設定（GUIベース）

#### 0-1. プロジェクト作成 + 課金有効化
1. [GCP Console](https://console.cloud.google.com/)にアクセス
2. 新しいプロジェクトを作成
3. 課金を有効化

#### 0-2. 必要APIの有効化
GCP Console → APIとサービス → 有効なAPIとサービス → 「APIとサービスの有効化」から以下を有効化：
- Cloud Run API
- Cloud Build API
- Artifact Registry API
- Cloud Storage API

#### 0-3. GCSバケット作成
1. Cloud Storage → バケット → 作成
2. 名前を入力（例: `gff-practice`）
3. ロケーション: `asia-northeast1`
4. アクセス制御: 均一
5. 作成

#### 0-4. 参照データと正解データをGCSへアップロード
**GCS Console**で以下のフォルダ構造を作成してファイルをアップロード：

```
YOUR_BUCKET/
├── references/
│   ├── ref_GRCh38_scaffolds.gff3
│   ├── hs_ref_GRCh38_chr21.fa
│   ├── saccharomyces_cerevisiae_R64-1-1_20110208_annotation.gff
│   └── saccharomyces_cerevisiae_R64-1-1_20110208_sequences.fasta
└── answers/
    ├── human_answer.fasta
    └── yeast_answer.fasta
```

`data/reference-datasets.json` でこれらのパスを指定します。

#### 0-5. サービスアカウント作成と権限付与

**1. vercel-api サービスアカウント（API用）**
1. IAM と管理 → サービスアカウント → サービスアカウントを作成
2. 名前: `vercel-api`
3. 作成して続行
4. IAM → プリンシパルを追加 → `vercel-api@YOUR_PROJECT.iam.gserviceaccount.com` に以下のロールを付与：
   - Cloud Run 管理者（`roles/run.admin`）
   - Storage オブジェクト管理者（`roles/storage.objectAdmin`）
   - サービス アカウント ユーザー（`roles/iam.serviceAccountUser`）

**2. job-runtime サービスアカウント（ジョブ実行用）**
1. サービスアカウントを作成
2. 名前: `job-runtime`
3. IAM → `job-runtime@YOUR_PROJECT.iam.gserviceaccount.com` に以下を付与：
   - Storage オブジェクト管理者（`roles/storage.objectAdmin`）
4. サービスアカウント → `job-runtime` → 権限タブ → アクセス権を付与
   - プリンシパル: `vercel-api@YOUR_PROJECT.iam.gserviceaccount.com`
   - ロール: サービス アカウント ユーザー

**3. vercel-api のJSONキーをダウンロード**
1. サービスアカウント → `vercel-api` → キータブ
2. 鍵を追加 → 新しい鍵を作成 → JSON → 作成
3. ダウンロードしたJSONファイルを保存（後で使用）

#### 0-6. Cloud Run Job作成

**1. Artifact Registry リポジトリ作成**
1. Artifact Registry → リポジトリを作成
2. 名前: `gff-runner`
3. 形式: Docker
4. ロケーション: `asia-northeast1`
5. 作成

**2. GitHubリポジトリと連携してビルド**
1. プロジェクトルートに `cloudbuild.yaml` を配置（既に存在）
2. Cloud Build → トリガー → リポジトリを接続
3. GitHub を選択してこのリポジトリを接続
4. トリガーを作成
   - 名前: `build-gff-runner`
   - イベント: 手動呼び出し
   - ソース: main ブランチ
   - 構成: Cloud Build 構成ファイル
   - Cloud Build 構成ファイルの場所: `cloudbuild.yaml`
5. 作成後、「実行」をクリックしてビルド

**3. Cloud Run Job 作成**
1. Cloud Run → ジョブ → ジョブを作成
2. ジョブ名: `gff-runner`
3. リージョン: `asia-northeast3`
4. コンテナイメージ: `asia-northeast1-docker.pkg.dev/YOUR_PROJECT/gff-runner/gff-runner:latest`
5. サービスアカウント: `job-runtime@YOUR_PROJECT.iam.gserviceaccount.com`
6. 作成

#### 0-7. Vercelの環境変数設定
`.env.local` または Vercel ダッシュボードで以下を設定：
- `GCP_PROJECT_ID`: プロジェクトID
- `GCP_REGION`: `asia-northeast3`（ジョブのリージョン）
- `GCP_SERVICE_ACCOUNT_KEY_JSON`: vercel-api のJSONキー全文
- `CLOUD_RUN_JOB_NAME`: `gff-runner`
- `GCS_BUCKET`: バケット名
- `GCS_JOB_PREFIX`: `jobs`

### ローカル起動

```bash
yarn install
yarn dev
```

## データセット構造

`data/reference-datasets.json` で各データセットを定義：

```json
{
  "id": "yeast_r64",
  "label": "S. cerevisiae R64-1-1",
  "gffObject": "references/saccharomyces_cerevisiae_R64-1-1_20110208_annotation.gff",
  "fastaObject": "references/saccharomyces_cerevisiae_R64-1-1_20110208_sequences.fasta",
  "genesObject": "references/genes_yeast.txt",
  "answerObject": "answers/yeast_answer.fasta",
  "mode": "dna"
}
```

**データセット別の出力形式:**
- **yeast (S. cerevisiae R64-1-1)**: DNA配列抽出モード
  - 出力: 遺伝子名（例: `>YAL003W`）ごとにDNA配列を出力
- **human (GRCh38 chr21)**: アミノ酸配列抽出モード
  - 出力: 転写産物名（例: `>rna80892`）ごとにアミノ酸配列を出力
  - アイソフォームは別エントリとして分離

## 実行時の入出力

**入力:**
- データセット選択（yeast / human）→ モード・参照データが自動設定される
- Pythonコード（`.py`）
- requirements.txt（任意）

**実行環境（/work）:**
- Python: 3.11
- CPU: 1 vCPU
- RAM: 4 GiB
- 入力ファイル:
  - `input.gff` - 参照GFFファイル（GCSから自動配置）
  - `input.fa` - 参照FASTAファイル（GCSから自動配置）
  - `genes.txt` - 遺伝子名リスト（GCSから自動配置）
  - `user.py` - ユーザーのPythonコード

**出力:**
- `result.fasta` - ユーザーコードの出力（ダウンロード可能）
- 標準出力/エラー出力
- 検証結果（answer.fastaと自動比較）

## 注意

ユーザー提供コードを実行するため、Cloud Run Job の権限と実行制限は最小化してください。
