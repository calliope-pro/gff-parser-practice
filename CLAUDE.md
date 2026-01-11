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
1. 参照データセット - GCSに配置済みのGFF/FASTAを選択
2. 遺伝子名リストTXT (.txt) - 抽出対象の遺伝子名リスト
3. Pythonコードファイル (.py) - ユーザーが作成した実行コード
4. requirements.txt（任意）

**モード選択**
- DNA配列抽出モード
- アミノ酸配列抽出モード

### 2.2 実行

- 「実行」ボタンをクリック
- Vercel APIがGCSに入力ファイルを保存
- Cloud Run JobでPythonコードを実行
- 参照データはGCSの固定パスから読み込み
 - `answer.fasta` は必要に応じてGCSへ別途配置

### 2.3 出力

- 標準出力（stdout）の表示
- エラーメッセージ（stderr）の表示
- 実行結果の可視化
- 検証結果（`answer.fasta` がある場合のみ）

---

## 3. UI設計

### レイアウト
- シンプルで分かりやすい1カラムレイアウト
- 教育目的のため、直感的な操作性を重視

### セクション構成
1. **ヘッダー**: サービス名と簡単な説明
2. **入力エリア**: データセット選択 + 3つのファイル入力（.txt, .py, requirements.txt）
3. **モード選択**: ラジオボタンまたはトグル（DNA / アミノ酸）
4. **実行ボタン**: 大きめで目立つボタン
5. **結果表示エリア**: 出力とエラーを分けて表示

---

## 4. 技術仕様

### ディレクトリ構造
```
gff-parser-practice/
├── app/
│   ├── api/
│   │   └── jobs/         # ジョブ起動・ステータス取得
│   ├── page.tsx          # メインページ
│   └── layout.tsx
├── components/
│   ├── FileUploader.tsx  # 入力コンポーネント
│   ├── ModeSelector.tsx  # DNA/アミノ酸モード選択
│   ├── ResultDisplay.tsx # 結果表示
│   └── ValidationDisplay.tsx
├── data/
│   └── reference-datasets.json # データセット一覧
├── job/
│   ├── runner.py         # Cloud Run Jobの実行スクリプト
│   └── Dockerfile
├── lib/
│   ├── referenceDatasets.ts
│   ├── validator.ts
│   └── server/
│       └── gcp.ts
└── ...
```

### Cloud Run Job
- 参照データ（GFF/FASTA）はGCSの固定パスから取得
- ジョブ入力と結果はGCSに保存
- `OUTPUT_MODE` に応じてDNA/アミノ酸を出力
- `answer.fasta` が存在する場合のみ検証を実施

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

## 6. 今後の拡張可能性

- 正解データとの照合機能
