"use client";

type FileUploaderProps = {
  onFilesChange: (files: {
    fasta: File | null;
    gff: File | null;
    geneList: File | null;
    pythonCode: File | null;
  }) => void;
};

export function FileUploader({ onFilesChange }: FileUploaderProps) {
  const handleFileChange = (
    type: "fasta" | "gff" | "geneList" | "pythonCode",
    file: File | null
  ) => {
    onFilesChange({
      fasta: type === "fasta" ? file : null,
      gff: type === "gff" ? file : null,
      geneList: type === "geneList" ? file : null,
      pythonCode: type === "pythonCode" ? file : null,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="fasta-file"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          FASTAファイル (.fa)
        </label>
        <input
          id="fasta-file"
          type="file"
          accept=".fa,.fasta"
          onChange={(e) =>
            handleFileChange("fasta", e.target.files?.[0] || null)
          }
          className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="gff-file"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          GFFファイル (.gff)
        </label>
        <input
          id="gff-file"
          type="file"
          accept=".gff,.gff3"
          onChange={(e) => handleFileChange("gff", e.target.files?.[0] || null)}
          className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="gene-list-file"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          遺伝子名リスト (.txt)
        </label>
        <input
          id="gene-list-file"
          type="file"
          accept=".txt"
          onChange={(e) =>
            handleFileChange("geneList", e.target.files?.[0] || null)
          }
          className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="python-code-file"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          Pythonコード (.py)
        </label>
        <input
          id="python-code-file"
          type="file"
          accept=".py"
          onChange={(e) =>
            handleFileChange("pythonCode", e.target.files?.[0] || null)
          }
          className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
        />
      </div>
    </div>
  );
}
