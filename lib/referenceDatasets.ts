import datasets from "@/data/reference-datasets.json";

export type ReferenceDataset = {
  id: string;
  label: string;
  gffObject: string;
  fastaObject: string;
  answerObject: string;
  mode: "dna" | "amino";
};

export const referenceDatasets = datasets as ReferenceDataset[];

export function getReferenceDataset(id: string): ReferenceDataset | undefined {
  return referenceDatasets.find((dataset) => dataset.id === id);
}
