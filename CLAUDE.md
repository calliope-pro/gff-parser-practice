# GFF Parser Practice - 遺伝子配列抽出トレーニングツール

## 1. サービス概要

* **サービス名**: GFF Parser Practice
* **目的**: Python初学者が遺伝子配列抽出コードを書いて動作確認できる研修・教育用Webアプリ
* **技術スタック**: Next.js 16 (App Router) + TypeScript + Tailwind CSS
* **実行環境**: Cloud Run Job + GCS

---

## 2. 機能要件

### 2.1 入力

**入力（Pythonコード + データセット選択）**
1. 参照データセット - GCSに配置済みのGFF/FASTA/遺伝子リスト/正解データを選択
   - **Yeast (S. cerevisiae R64-1-1)**: DNA配列抽出モード
     - 出力形式: 遺伝子名（例: `>YAL003W`）ごとにDNA配列
   - **Human (GRCh38 chr21)**: アミノ酸配列抽出モード
     - 出力形式: 転写産物名（例: `>rna80892`）ごとにアミノ酸配列（アイソフォーム分離）
2. Pythonコードファイル (.py) - ユーザーが作成した実行コード
3. requirements.txt（任意）

**モードと参照データ**
- データセット選択により自動設定（変更不可）
- Yeast → DNA配列抽出、遺伝子名で出力
- Human → アミノ酸配列抽出、転写産物名で出力

### 2.2 実行

- 「実行」ボタンをクリック
- Vercel APIがGCSにユーザーコード（user.py）を保存
- Cloud Run JobでPythonコードを実行
- 参照データはすべてGCSから自動ダウンロード:
  - GFF/FASTA（input.gff / input.fa）
  - 遺伝子リスト（genes.txt）
  - 正解データ（answer.fasta）

### 2.3 出力

- 標準出力（stdout）の表示
- エラーメッセージ（stderr）の表示
- result.fastaのダウンロード
- 検証結果の表示（正解データとの自動比較）
  - 全体正解/不正解
  - 遺伝子ごとの詳細（配列の一致/不一致）
  - 不正解の場合は差分表示

---

## 3. UI設計

### レイアウト
- シンプルで分かりやすい1カラムレイアウト
- 教育目的のため、直感的な操作性を重視

### セクション構成
1. **ヘッダー**: サービス名と説明
2. **課題説明セクション**: データセット、ファイル形式、実行環境、出力フォーマットの説明
   - データセットごとの出力形式の違いを明示
3. **入力エリア**: データセット選択 + 2つのファイル入力（.py, requirements.txt）
   - データセット選択時に参照データパスとモードを表示
4. **実行ボタン**: 大きめで目立つボタン
5. **結果表示エリア**: 標準出力、エラー、result.fastaダウンロード
6. **検証結果エリア**: 正解/不正解、遺伝子ごとの詳細

---

## 4. 技術仕様

### ディレクトリ構造
```
gff-parser-practice/
├── app/
│   ├── api/
│   │   └── jobs/         # ジョブ起動・ステータス取得API
│   ├── page.tsx          # メインページ
│   └── layout.tsx
├── components/
│   ├── FileUploader.tsx      # 入力コンポーネント
│   ├── ResultDisplay.tsx     # 結果表示
│   └── ValidationDisplay.tsx # 検証結果表示
├── data/
│   └── reference-datasets.json # データセット定義
├── answers/
│   ├── yeast_answer.fasta    # Yeast正解データ
│   └── human_answer.fasta    # Human正解データ
├── examples/
│   ├── *.gff / *.fa          # 参照データ
│   ├── one_fixed.py / two.py # 正解コード例
│   └── *.txt                 # 遺伝子リスト例
├── job/
│   ├── runner.py             # Cloud Run Job実行スクリプト
│   └── Dockerfile
├── lib/
│   ├── referenceDatasets.ts  # データセット型定義
│   ├── validator.ts          # FASTA検証ロジック
│   └── server/
│       └── gcp.ts            # GCS/Cloud Run操作
└── ...
```

### Cloud Run Job
- 実行環境:
  - Python 3.11
  - 1 vCPU
  - 4 GiB RAM
- 参照データをGCSからダウンロード:
  - GFF/FASTA（input.gff / input.fa）
  - 遺伝子リスト（genes.txt）
  - 正解データ（answer.fasta）
- ユーザー入力ファイルをGCSからダウンロード:
  - user.py
  - requirements.txt（存在する場合）
- `/work` ディレクトリで実行
- 環境変数:
  - `REFERENCE_GFF_OBJECT`: GFF参照パス
  - `REFERENCE_FASTA_OBJECT`: FASTA参照パス
  - `REFERENCE_GENES_OBJECT`: 遺伝子リスト参照パス
  - `REFERENCE_ANSWER_OBJECT`: 正解データパス
  - `OUTPUT_MODE`: `dna` / `amino`
- 結果をGCSにアップロード:
  - result.fasta（ユーザー出力）
  - answer.fasta（検証用）
  - user.log（標準出力/エラー）
  - status.json（実行結果）

### API
- `POST /api/jobs`: ユーザーコードアップロード + Cloud Run Job起動
- `GET /api/jobs/:jobId`: GCSの結果・ログを取得して検証結果を返す

---

## 5. 開発方針

- **シンプル第一**: 過度な機能追加は避ける
- **教育向け**: エラーメッセージは分かりやすく
- **レスポンシブ**: モバイルでも使える
- **型安全**: TypeScriptで厳密に型定義

---

## 6. 実装済み機能

- ✅ データセット選択（Yeast/Human）
- ✅ モード自動設定（DNA/アミノ酸）
- ✅ Cloud Run Jobでのコード実行
- ✅ 正解データとの自動照合
- ✅ 遺伝子ごとの詳細検証結果表示
- ✅ result.fastaダウンロード

## 7. セキュリティ考慮事項

- ユーザー提供コードを実行するため、Cloud Run Jobは最小権限で実行
- answer.fastaは検証にのみ使用し、ユーザーへのダウンロードは不可
- サービスアカウントの権限は必要最小限に制限
- GCS バケットはuniform access controlで保護
