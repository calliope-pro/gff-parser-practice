"use client";

import type { ValidationResult } from "@/lib/validator";

type ValidationDisplayProps = {
  result: ValidationResult | null;
};

export function ValidationDisplay({ result }: ValidationDisplayProps) {
  if (!result) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* 総合結果 */}
      <div
        className={`rounded-lg p-4 ${
          result.isCorrect
            ? "bg-green-50 border border-green-300"
            : "bg-red-50 border border-red-300"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-2xl">
            {result.isCorrect ? "✅" : "❌"}
          </span>
          <div>
            <h3
              className={`text-lg font-semibold ${
                result.isCorrect ? "text-green-900" : "text-red-900"
              }`}
            >
              {result.isCorrect ? "正解！" : "不正解"}
            </h3>
            <div
              className={`text-sm ${
                result.isCorrect ? "text-green-700" : "text-red-700"
              }`}
            >
              <p>正解: {result.correctGenes} / {result.totalGenes} 件</p>
              {result.userTotalGenes !== result.totalGenes && (
                <p className="text-xs mt-1">
                  出力数: {result.userTotalGenes} 件
                  {result.extraGenes > 0 && ` (不要: ${result.extraGenes}件)`}
                  {result.missingGenes > 0 && ` (不足: ${result.missingGenes}件)`}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 詳細結果 */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-2">詳細結果</h4>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {result.details.map((detail, index) => (
            <div
              key={index}
              className={`rounded-lg p-3 border ${
                detail.isCorrect
                  ? "bg-green-50 border-green-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-lg flex-shrink-0">
                  {detail.isCorrect ? "✓" : "✗"}
                </span>
                <div className="flex-1 min-w-0">
                  <p
                    className={`font-medium text-sm ${
                      detail.isCorrect ? "text-green-900" : "text-red-900"
                    }`}
                  >
                    {detail.geneName}
                  </p>
                  <p
                    className={`text-xs ${
                      detail.isCorrect ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {detail.message}
                  </p>
                  {!detail.isCorrect && detail.userSequence && (
                    <details className="mt-2">
                      <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-900">
                        詳細を表示
                      </summary>
                      <div className="mt-2 space-y-2 text-xs">
                        <div>
                          <p className="font-medium text-gray-700">
                            あなたの出力:
                          </p>
                          <pre className="bg-white p-2 rounded border border-gray-200 overflow-x-auto text-xs">
                            {detail.userSequence}
                          </pre>
                        </div>
                        <div>
                          <p className="font-medium text-gray-700">正解:</p>
                          <pre className="bg-white p-2 rounded border border-gray-200 overflow-x-auto text-xs">
                            {detail.correctSequence}
                          </pre>
                        </div>
                      </div>
                    </details>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
