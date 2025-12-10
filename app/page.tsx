"use client";

import { useEffect, useState } from "react";
import { FileUploader } from "@/components/FileUploader";
import { ModeSelector } from "@/components/ModeSelector";
import { ResultDisplay } from "@/components/ResultDisplay";
import { ValidationDisplay } from "@/components/ValidationDisplay";
import { runPythonCode } from "@/lib/pyodide";
import { validateFasta, type ValidationResult } from "@/lib/validator";

export default function Home() {
  const [files, setFiles] = useState<{
    fasta: File | null;
    gff: File | null;
    geneList: File | null;
    pythonCode: File | null;
  }>({
    fasta: null,
    gff: null,
    geneList: null,
    pythonCode: null,
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
    setFiles((prev) => ({
      fasta: newFiles.fasta || prev.fasta,
      gff: newFiles.gff || prev.gff,
      geneList: newFiles.geneList || prev.geneList,
      pythonCode: newFiles.pythonCode || prev.pythonCode,
    }));
  };

  const handleExecute = async () => {
    if (!files.fasta || !files.gff || !files.geneList || !files.pythonCode) {
      setError("すべてのファイルをアップロードしてください");
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
      // Wait for Pyodide to be available
      let retries = 0;
      while (
        typeof (globalThis as any).loadPyodide === "undefined" &&
        retries < 50
      ) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        retries++;
      }

      if (typeof (globalThis as any).loadPyodide === "undefined") {
        setError("Pyodideの読み込みに失敗しました。ページを再読み込みしてください。");
        setIsLoading(false);
        return;
      }
      const [fastaContent, gffContent, geneListContent, pythonCodeContent] =
        await Promise.all([
          files.fasta.text(),
          files.gff.text(),
          files.geneList.text(),
          files.pythonCode.text(),
        ]);

      const fileList = [
        { name: "input.fa", content: fastaContent },
        { name: "input.gff", content: gffContent },
        { name: "genes.txt", content: geneListContent },
        { name: "mode.txt", content: mode },
      ];

      // Pyodideを取得
      const pyodide = await (await import("@/lib/pyodide")).getPyodide();

      // Step 1: BioPythonをインストール
      setOutput("BioPythonをインストール中...");
      await pyodide.loadPackage("micropip");
      const micropip = pyodide.pyimport("micropip");
      await micropip.install("biopython");
      setOutput("BioPythonのインストールが完了しました\n\n正解データを生成中...");

      // Step 2: 正解生成スクリプトを取得
      const answerScriptResponse = await fetch("/answer_generator.py");
      if (!answerScriptResponse.ok) {
        throw new Error("正解生成スクリプトの取得に失敗しました");
      }
      const answerScript = await answerScriptResponse.text();
      const answerScriptWithMode = `OUTPUT_MODE = "${mode}"\n${answerScript}`;

      // Step 3: 正解データを生成
      const answerResult = await runPythonCode(answerScriptWithMode, fileList);
      if (answerResult.error) {
        throw new Error(`正解データの生成に失敗: ${answerResult.error}`);
      }

      // 正解データを読み込む
      const answer = pyodide.FS.readFile("/home/pyodide/answer.fasta", {
        encoding: "utf8"
      });
      setOutput(answerResult.output + "\n\nユーザーコードを実行中...");

      // Step 4: ユーザーのコードを実行
      const userScriptWithMode = `OUTPUT_MODE = "${mode}"\n${pythonCodeContent}`;
      const result = await runPythonCode(userScriptWithMode, fileList);

      setOutput(answerResult.output + "\n\n" + result.output);
      setError(result.error);

      // Step 5: 結果が生成されていれば判定を実行
      if (!result.error) {
        try {
          const userResult = pyodide.FS.readFile("/home/pyodide/result.fasta", {
            encoding: "utf8",
          });
          const blob = new Blob([userResult], { type: "text/plain" });
          const url = URL.createObjectURL(blob);
          setResultDownloadUrl(url);
          const validation = validateFasta(userResult, answer);
          setValidationResult(validation);
        } catch (readError) {
          setError(
            "result.fastaファイルが生成されていません。コードを確認してください。"
          );
        }
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
          <section>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              ファイルアップロード
            </h2>
            <FileUploader onFilesChange={handleFilesChange} />
            <p className="mt-2 text-xs text-gray-500">
              アップロードした FASTA/GFF/遺伝子リストは Pyodide 内で「input.fa / input.gff / genes.txt」として扱われます。
              <br/>
              ユーザーコードの出力は「result.fasta」に書き出してください（ここからダウンロードします）。
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
