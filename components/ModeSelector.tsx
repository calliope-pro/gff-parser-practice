"use client";

type ModeSelectorProps = {
  mode: "dna" | "amino";
  onModeChange: (mode: "dna" | "amino") => void;
};

export function ModeSelector({ mode, onModeChange }: ModeSelectorProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        抽出モード
      </label>
      <div className="flex gap-4">
        <label className="flex items-center">
          <input
            type="radio"
            name="mode"
            value="dna"
            checked={mode === "dna"}
            onChange={() => onModeChange("dna")}
            className="mr-2"
          />
          <span className="text-sm text-gray-700">DNA配列</span>
        </label>
        <label className="flex items-center">
          <input
            type="radio"
            name="mode"
            value="amino"
            checked={mode === "amino"}
            onChange={() => onModeChange("amino")}
            className="mr-2"
          />
          <span className="text-sm text-gray-700">アミノ酸配列</span>
        </label>
      </div>
    </div>
  );
}
