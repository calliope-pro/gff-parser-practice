import type { PyodideInterface } from "pyodide";

let pyodideInstance: PyodideInterface | null = null;

export async function getPyodide(): Promise<PyodideInterface> {
  if (pyodideInstance) {
    return pyodideInstance;
  }

  // Use global loadPyodide from CDN script
  if (typeof (globalThis as any).loadPyodide === "undefined") {
    throw new Error(
      "Pyodide script not loaded. Make sure the CDN script is included in your HTML."
    );
  }

  const loadedPyodide = await (globalThis as any).loadPyodide({
    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.29.0/full/",
  });

  pyodideInstance = loadedPyodide as PyodideInterface;

  return pyodideInstance;
}

export async function runPythonCode(
  pythonCode: string,
  files: { name: string; content: string }[]
): Promise<{ output: string; error: string | null }> {
  const pyodide = await getPyodide();

  let output = "";
  let error: string | null = null;

  try {
    // 旧状態の stdout/stderr をリセット
    pyodide.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
    `);

    // カレントディレクトリを確認・変更
    const cwd = pyodide.runPython("import os; os.getcwd()");
    console.log(`Current working directory: ${cwd}`);

    // /home/pyodideディレクトリに移動
    pyodide.runPython(`
import os
os.chdir('/home/pyodide')
print(f"Changed to: {os.getcwd()}")
    `);

    // ファイルシステムにファイルを書き込む
    console.log("Writing files to Pyodide FS...");
    for (const file of files) {
      try {
        pyodide.FS.writeFile(`/home/pyodide/${file.name}`, file.content);
        console.log(`✓ Written: ${file.name} (${file.content.length} bytes)`);
      } catch (writeErr) {
        console.error(`✗ Failed to write: ${file.name}`, writeErr);
        throw new Error(`Failed to write file ${file.name}: ${writeErr}`);
      }
    }

    // デバッグ: ファイルが正しく書き込まれたか確認
    const fileList = pyodide.FS.readdir("/home/pyodide");
    console.log("Files in /home/pyodide:", fileList);

    // 各ファイルの存在と内容を確認
    for (const file of files) {
      try {
        const stat = pyodide.FS.stat(`/home/pyodide/${file.name}`);
        console.log(`File ${file.name}: size=${stat.size}, mode=${stat.mode}`);
      } catch (statErr) {
        console.error(`Failed to stat ${file.name}:`, statErr);
      }
    }

    // Pythonコードを実行
    await pyodide.runPythonAsync(pythonCode);

    // 出力を取得
    output = pyodide.runPython("sys.stdout.getvalue()");
    const stderr = pyodide.runPython("sys.stderr.getvalue()");

    if (stderr) {
      error = stderr;
    }
  } catch (err: any) {
    // Pythonのトレースバックを取得
    try {
      const traceback = pyodide.runPython(`
import sys
import traceback
traceback.format_exc()
      `);
      const formatted = typeof traceback === "string" ? traceback.trim() : "";
      const stderrCapture = (() => {
        try {
          return pyodide.runPython("sys.stderr.getvalue()") as string;
        } catch {
          return "";
        }
      })();
      const fallbackMessage =
        err?.message ||
        (typeof err === "string" ? err : "") ||
        String(err);
      const stack = err?.stack ? `\nStack: ${err.stack}` : "";
      if (formatted && formatted !== "NoneType: None") {
        error = `Python Error:\n${formatted}`;
      } else if (stderrCapture) {
        error = `Python stderr:\n${stderrCapture}`;
      } else {
        error = `Error: ${fallbackMessage}${stack}`;
      }
    } catch {
      // トレースバック取得に失敗した場合は通常のエラーメッセージ
      error = `Error: ${err?.message || String(err)}`;
    }

    console.error("Python execution error:", err);
  }

  return { output, error };
}
