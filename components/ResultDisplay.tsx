"use client";

type ResultDisplayProps = {
  output: string | null;
  error: string | null;
  isLoading: boolean;
  resultFileUrl?: string | null;
};

export function ResultDisplay({
  output,
  error,
  isLoading,
  resultFileUrl,
}: ResultDisplayProps) {
  if (isLoading) {
    return (
      <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
        <p className="text-sm text-gray-600">実行中...</p>
      </div>
    );
  }

  if (!output && !error) {
    return (
      <div className="bg-gray-50 border border-gray-300 rounded-lg p-4">
        <p className="text-sm text-gray-500">
          ファイルをアップロードして実行ボタンを押してください
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {output && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-2">標準出力</h3>
          <pre className="bg-gray-50 border border-gray-300 rounded-lg p-4 text-sm text-gray-900 whitespace-pre-wrap overflow-x-auto">
            {output}
          </pre>
          {resultFileUrl && (
            <div className="mt-3">
              <a
                href={resultFileUrl}
                download="result.fasta"
                className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
              >
                result.fasta をダウンロード
              </a>
            </div>
          )}
        </div>
      )}

      {error && (
        <div>
          <h3 className="text-sm font-medium text-red-700 mb-2">エラー</h3>
          <pre className="bg-red-50 border border-red-300 rounded-lg p-4 text-sm text-red-900 whitespace-pre-wrap overflow-x-auto">
            {error}
          </pre>
        </div>
      )}
    </div>
  );
}
