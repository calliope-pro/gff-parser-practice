"use client";

import { useEffect, useState } from "react";
import { FileUploader } from "@/components/FileUploader";
import { ModeSelector } from "@/components/ModeSelector";
import { ResultDisplay } from "@/components/ResultDisplay";
import { ValidationDisplay } from "@/components/ValidationDisplay";
import { validateFasta, type ValidationResult } from "@/lib/validator";

export default function Home() {
  const [files, setFiles] = useState<{
    datasetId: string;
    geneList: File | null;
    pythonCode: File | null;
    requirements: File | null;
  }>({
    datasetId: "",
    geneList: null,
    pythonCode: null,
    requirements: null,
  });

  const [mode, setMode] = useState<"dna" | "amino">("dna");
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);
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

  const handleExecute = async () => {
    if (!files.datasetId || !files.geneList || !files.pythonCode) {
      setError("データセット・遺伝子リスト・Pythonコードを指定してください");
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

    try {
      setOutput("ジョブを起動中...");

      const formData = new FormData();
      formData.append("datasetId", files.datasetId);
      formData.append("mode", mode);
      formData.append("geneList", files.geneList);
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

      if (!jobStatus.result || !jobStatus.answer) {
        const statusInfo = jobStatus.statusData?.user;
        const stderr = statusInfo?.stderr ? `\n${statusInfo.stderr}` : "";
        throw new Error(`result.fasta が生成されていません${stderr}`);
      }

      const userResult = String(jobStatus.result);
      const answerResult = String(jobStatus.answer);
      const blob = new Blob([userResult], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      setResultDownloadUrl(url);

      const validation = validateFasta(userResult, answerResult);
      setValidationResult(validation);
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
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              ファイルアップロード
            </h2>
            <FileUploader onFilesChange={handleFilesChange} />
            <p className="mt-2 text-xs text-gray-500">
              参照データは GCS 上のデータセットを使用します。
              <br />
              ジョブの作業ディレクトリは /work で、input.fa / input.gff / genes.txt を読み込みます。
              <br />
              ユーザーコードの出力は result.fasta に書き出してください（ここからダウンロードします）。
            </p>
          </section>

          <section>
            <ModeSelector mode={mode} onModeChange={setMode} />
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
            />
          </section>

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
