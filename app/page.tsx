"use client";

import { useEffect, useState } from "react";
import { FileUploader } from "@/components/FileUploader";
import { ResultDisplay } from "@/components/ResultDisplay";
import { ValidationDisplay } from "@/components/ValidationDisplay";
import { validateFasta, type ValidationResult } from "@/lib/validator";

export default function Home() {
  const [files, setFiles] = useState<{
    datasetId: string;
    pythonCode: File | null;
    requirements: File | null;
  }>({
    datasetId: "",
    pythonCode: null,
    requirements: null,
  });

  const [mode, setMode] = useState<"dna" | "amino">("dna");
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);
  const [answerAvailable, setAnswerAvailable] = useState<boolean | null>(null);
  const [resultDownloadUrl, setResultDownloadUrl] = useState<string | null>(null);

  // ブラウザURLのクリーンアップ
  useEffect(() => {
    return () => {
      if (resultDownloadUrl) {
        URL.revokeObjectURL(resultDownloadUrl);
      }
    };
  }, [resultDownloadUrl]);

  const handleFilesChange = (newFiles: typeof files) => {
    setFiles(newFiles);
  };

  const handleModeChange = (newMode: "dna" | "amino") => {
    setMode(newMode);
  };

  const handleExecute = async () => {
    if (!files.datasetId || !files.pythonCode) {
      setError("データセット・Pythonコードを指定してください");
      return;
    }

    if (resultDownloadUrl) {
      URL.revokeObjectURL(resultDownloadUrl);
      setResultDownloadUrl(null);
    }

    setIsLoading(true);
    setOutput(null);
    setError(null);
    setValidationResult(null);
    setAnswerAvailable(null);
    setJobId(null);

    try {
      setOutput("ジョブを起動中...");

      const formData = new FormData();
      formData.append("datasetId", files.datasetId);
      formData.append("mode", mode);
      formData.append("pythonCode", files.pythonCode);
      if (files.requirements) {
        formData.append("requirements", files.requirements);
      }

      const submitResponse = await fetch("/api/jobs", {
        method: "POST",
        body: formData,
      });

      if (!submitResponse.ok) {
        const errorData = await submitResponse.json();
        throw new Error(errorData.error || "ジョブ起動に失敗しました");
      }

      const submitData = await submitResponse.json();
      const jobId = submitData.jobId as string;
      setJobId(jobId);
      const pollIntervalMs = 3000;
      const timeoutMs = 15 * 60 * 1000;
      const start = Date.now();

      let jobStatus: any = null;

      while (Date.now() - start < timeoutMs) {
        const statusResponse = await fetch(`/api/jobs/${jobId}`);
        if (!statusResponse.ok) {
          const errorData = await statusResponse.json();
          throw new Error(errorData.error || "ジョブ確認に失敗しました");
        }

        jobStatus = await statusResponse.json();
        if (jobStatus.status === "completed") {
          break;
        }

        const elapsed = Math.floor((Date.now() - start) / 1000);
        setOutput(`ジョブ実行中... (${elapsed}s)`);
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }

      if (!jobStatus || jobStatus.status !== "completed") {
        throw new Error("ジョブがタイムアウトしました");
      }

      const userLog = jobStatus.logs?.user || "";
      setOutput(userLog || "ユーザーコードのログがありません");

      if (!jobStatus.result) {
        const statusInfo = jobStatus.statusData?.user;
        const stderr = statusInfo?.stderr ? `\n${statusInfo.stderr}` : "";
        throw new Error(`result.fasta が生成されていません${stderr}`);
      }

      const userResult = String(jobStatus.result);
      const blob = new Blob([userResult], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      setResultDownloadUrl(url);

      if (jobStatus.answer) {
        const answerResult = String(jobStatus.answer);
        const validation = validateFasta(userResult, answerResult);
        setValidationResult(validation);
        setAnswerAvailable(true);
      } else {
        setValidationResult(null);
        setAnswerAvailable(false);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="max-w-4xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            GFF Parser Practice
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            遺伝子配列抽出コードの動作確認ツール
          </p>
        </header>

        <div className="bg-white shadow rounded-lg p-6 space-y-6">
          {/* 課題説明セクション */}
          <section className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h2 className="text-lg font-semibold text-blue-900 mb-3">
              📚 課題について
            </h2>
            <div className="space-y-3 text-sm text-gray-700">
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">目的</h3>
                <p>
                  GFFファイル（遺伝子アノテーション情報）とFASTAファイル（塩基配列データ）から、
                  指定された遺伝子の配列を抽出するPythonプログラムを作成します。
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-1">データセット</h3>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong>S. cerevisiae R64-1-1</strong>: 酵母（パン酵母）のゲノムデータ（DNAモード）</li>
                  <li><strong>GRCh38 chr21</strong>: ヒトの21番染色体のゲノムデータ（アミノ酸モード）</li>
                </ul>
                <p className="mt-2 text-xs text-gray-600">
                  選択したデータセットのGFF/FASTAファイルが <code className="bg-white px-1 rounded">input.gff</code> と <code className="bg-white px-1 rounded">input.fa</code> として配置されます。
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-1">ファイル形式</h3>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li><strong>GFF</strong>: 遺伝子の位置情報（染色体、開始位置、終了位置、ストランドなど）</li>
                  <li><strong>FASTA</strong>: DNA/タンパク質の配列データ（&gt;ヘッダー行 + 配列行）</li>
                  <li><strong>genes.txt</strong>: 抽出したい遺伝子名のリスト（1行1遺伝子）</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-1">実行環境</h3>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>作業ディレクトリ: <code className="bg-white px-1 rounded">/work</code></li>
                  <li>入力ファイル: <code className="bg-white px-1 rounded">input.gff</code>, <code className="bg-white px-1 rounded">input.fa</code>, <code className="bg-white px-1 rounded">genes.txt</code> (すべて参照データセットから自動配置)</li>
                  <li>出力: <code className="bg-white px-1 rounded">result.fasta</code> に書き出す</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-1">出力フォーマット</h3>
                <p>FASTA形式で出力してください：</p>
                <pre className="bg-white p-2 rounded border border-gray-200 mt-1 text-xs overflow-x-auto">
{`>遺伝子名
配列データ...
>次の遺伝子名
配列データ...`}
                </pre>
                <p className="mt-1 text-xs text-gray-600">
                  ※ DNAモード: 塩基配列をそのまま出力 / アミノ酸モード: CDS領域を翻訳して出力
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              ファイルアップロード
            </h2>
            <FileUploader onFilesChange={handleFilesChange} onModeChange={handleModeChange} />
          </section>

          <section>
            <button
              onClick={handleExecute}
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? "実行中..." : "実行"}
            </button>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              実行結果
            </h2>
            <ResultDisplay
              output={output}
              error={error}
              isLoading={isLoading}
              resultFileUrl={resultDownloadUrl}
              jobId={jobId}
            />
          </section>

          {answerAvailable === false && (
            <section>
              <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
                answer.fasta が未配置のため検証をスキップしました。
              </div>
            </section>
          )}

          {validationResult && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                判定結果
              </h2>
              <ValidationDisplay result={validationResult} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
