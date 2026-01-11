# GFF Parser Practice - 遺伝子配列抽出トレーニングツール

## 1. サービス概要

* **サービス名**: GFF Parser Practice
* **目的**: Python初学者が遺伝子配列抽出コードを書いて動作確認できる研修・教育用Webアプリ
* **技術スタック**: Next.js 16 (App Router) + TypeScript + Tailwind CSS
* **実行環境**: Cloud Run Job + GCS

---

## 2. 機能要件

### 2.1 入力

**入力（3種類 + データセット選択）**
1. 参照データセット - GCSに配置済みのGFF/FASTA/正解データを選択
   - **Yeast (S. cerevisiae)**: DNA配列抽出モード
   - **Human (GRCh38 chr21)**: アミノ酸配列抽出モード
2. 遺伝子名リストTXT (.txt) - 抽出対象の遺伝子名リスト
3. Pythonコードファイル (.py) - ユーザーが作成した実行コード
4. requirements.txt（任意）

**モード**
- データセット選択により自動設定（変更不可）
- Yeast → DNA配列抽出
- Human → アミノ酸配列抽出

### 2.2 実行

- 「実行」ボタンをクリック
- Vercel APIがGCSに入力ファイルを保存
- Cloud Run JobでPythonコードを実行
- 参照データ（GFF/FASTA）はGCSの固定パスから読み込み
- 正解データ（answer.fasta）も自動的にダウンロードして検証用に配置

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
2. **入力エリア**: データセット選択 + 3つのファイル入力（.txt, .py, requirements.txt）
   - データセット選択時にモード（DNA/アミノ酸）を表示
3. **実行ボタン**: 大きめで目立つボタン
4. **結果表示エリア**: 標準出力、エラー、result.fastaダウンロード
5. **検証結果エリア**: 正解/不正解、遺伝子ごとの詳細

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
- 参照データ（GFF/FASTA）と正解データ（answer.fasta）をGCSからダウンロード
- ユーザー入力ファイル（user.py、genes.txt、requirements.txt）をGCSからダウンロード
- `/work` ディレクトリで実行
- `OUTPUT_MODE` 環境変数（`dna` / `amino`）に応じて処理
- 結果（result.fasta、ログ、status.json、answer.fasta）をGCSにアップロード

### API
- `POST /api/jobs`: 入力アップロード + Cloud Run Job起動
- `GET /api/jobs/:jobId`: GCSの結果・ログを取得

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
