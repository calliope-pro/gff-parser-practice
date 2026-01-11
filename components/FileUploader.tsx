"use client";

import { useMemo, useState } from "react";
import { referenceDatasets } from "@/lib/referenceDatasets";

type FileUploaderProps = {
  onFilesChange: (files: {
    datasetId: string;
    pythonCode: File | null;
    requirements: File | null;
  }) => void;
  onModeChange: (mode: "dna" | "amino") => void;
  disabled?: boolean;
};

export function FileUploader({ onFilesChange, onModeChange, disabled = false }: FileUploaderProps) {
  const [files, setFiles] = useState<{
    datasetId: string;
    pythonCode: File | null;
    requirements: File | null;
  }>({
    datasetId: "",
    pythonCode: null,
    requirements: null,
  });

  const handleFileChange = (
    type: "pythonCode" | "requirements",
    file: File | null
  ) => {
    const newFiles = {
      ...files,
      [type]: file,
    };
    setFiles(newFiles);
    onFilesChange(newFiles);
  };

  const handleDatasetChange = (datasetId: string) => {
    const newFiles = {
      ...files,
      datasetId,
    };
    setFiles(newFiles);
    onFilesChange(newFiles);

    const dataset = referenceDatasets.find((d) => d.id === datasetId);
    if (dataset) {
      onModeChange(dataset.mode);
    }
  };

  const selectedDataset = useMemo(
    () => referenceDatasets.find((dataset) => dataset.id === files.datasetId),
    [files.datasetId]
  );

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="reference-dataset"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          参照データセット
        </label>
        <select
          id="reference-dataset"
          value={files.datasetId}
          onChange={(e) => handleDatasetChange(e.target.value)}
          disabled={disabled}
          className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <option value="">選択してください</option>
          {referenceDatasets.map((dataset) => (
            <option key={dataset.id} value={dataset.id}>
              {dataset.label}
            </option>
          ))}
        </select>
        {selectedDataset && (
          <p className="mt-2 text-xs text-gray-500">
            GFF: {selectedDataset.gffObject}
            <br />
            FASTA: {selectedDataset.fastaObject}
            <br />
            遺伝子リスト: {selectedDataset.genesObject}
            <br />
            モード: {selectedDataset.mode === "dna" ? "DNA配列" : "アミノ酸配列"}
          </p>
        )}
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
          disabled={disabled}
          className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      <div>
        <label
          htmlFor="requirements-file"
          className="block text-sm font-medium text-gray-700 mb-2"
        >
          requirements.txt（任意）
        </label>
        <input
          id="requirements-file"
          type="file"
          accept=".txt"
          onChange={(e) =>
            handleFileChange("requirements", e.target.files?.[0] || null)
          }
          disabled={disabled}
          className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
    </div>
  );
}
