/**
 * FASTA形式の配列を比較して判定する
 */

export type ValidationResult = {
  isCorrect: boolean;
  totalGenes: number;
  correctGenes: number;
  incorrectGenes: number;
  details: {
    geneName: string;
    isCorrect: boolean;
    userSequence: string;
    correctSequence: string;
    message: string;
  }[];
};

/**
 * FASTA形式の文字列をパースする
 */
function parseFasta(fastaContent: string): Map<string, string> {
  const result = new Map<string, string>();
  const lines = fastaContent.split("\n");

  let currentName: string | null = null;
  let currentSequence = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith(">")) {
      // 前の配列を保存
      if (currentName !== null) {
        result.set(currentName, currentSequence);
      }
      // 新しい配列を開始
      currentName = trimmed.substring(1).trim();
      currentSequence = "";
    } else {
      currentSequence += trimmed;
    }
  }

  // 最後の配列を保存
  if (currentName !== null) {
    result.set(currentName, currentSequence);
  }

  return result;
}

/**
 * ユーザーの出力と正解を比較して判定する
 */
export function validateFasta(
  userOutput: string,
  correctAnswer: string
): ValidationResult {
  const userSequences = parseFasta(userOutput);
  const correctSequences = parseFasta(correctAnswer);

  const details: ValidationResult["details"] = [];
  let correctCount = 0;
  let incorrectCount = 0;

  // 正解に含まれる全ての遺伝子をチェック
  for (const [geneName, correctSeq] of correctSequences) {
    const userSeq = userSequences.get(geneName);

    if (!userSeq) {
      details.push({
        geneName,
        isCorrect: false,
        userSequence: "",
        correctSequence: correctSeq,
        message: "配列が出力されていません",
      });
      incorrectCount++;
    } else if (userSeq === correctSeq) {
      details.push({
        geneName,
        isCorrect: true,
        userSequence: userSeq,
        correctSequence: correctSeq,
        message: "正解",
      });
      correctCount++;
    } else {
      details.push({
        geneName,
        isCorrect: false,
        userSequence: userSeq,
        correctSequence: correctSeq,
        message: "配列が一致しません",
      });
      incorrectCount++;
    }
  }

  // ユーザーが余分な遺伝子を出力していないかチェック
  for (const geneName of userSequences.keys()) {
    if (!correctSequences.has(geneName)) {
      details.push({
        geneName,
        isCorrect: false,
        userSequence: userSequences.get(geneName) || "",
        correctSequence: "",
        message: "不要な遺伝子が含まれています",
      });
      incorrectCount++;
    }
  }

  const totalGenes = correctSequences.size;
  const isCorrect = correctCount === totalGenes && incorrectCount === 0;

  return {
    isCorrect,
    totalGenes,
    correctGenes: correctCount,
    incorrectGenes: incorrectCount,
    details,
  };
}
