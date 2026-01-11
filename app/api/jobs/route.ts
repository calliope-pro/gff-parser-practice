import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getReferenceDataset } from "@/lib/referenceDatasets";
import { runCloudRunJob, uploadObject } from "@/lib/server/gcp";

export const runtime = "nodejs";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const datasetId = String(formData.get("datasetId") || "").trim();
    const mode = String(formData.get("mode") || "dna").trim();
    const geneListFile = formData.get("geneList") as File | null;
    const pythonCodeFile = formData.get("pythonCode") as File | null;
    const requirementsFile = formData.get("requirements") as File | null;

    if (!datasetId || !geneListFile || !pythonCodeFile) {
      return NextResponse.json(
        { error: "Missing datasetId, geneList, or pythonCode" },
        { status: 400 }
      );
    }

    if (mode !== "dna" && mode !== "amino") {
      return NextResponse.json(
        { error: 'Invalid mode. Must be "dna" or "amino"' },
        { status: 400 }
      );
    }

    const dataset = getReferenceDataset(datasetId);
    if (!dataset) {
      return NextResponse.json(
        { error: "Unknown datasetId" },
        { status: 400 }
      );
    }

    const projectId = getEnv("GCP_PROJECT_ID");
    const region = getEnv("GCP_REGION");
    const jobName = getEnv("CLOUD_RUN_JOB_NAME");
    const bucket = getEnv("GCS_BUCKET");
    const jobPrefix = (process.env.GCS_JOB_PREFIX || "jobs").replace(/\/+$/g, "");

    const jobId = randomUUID();
    const basePrefix = `${jobPrefix}/${jobId}`;

    await uploadObject(
      bucket,
      `${basePrefix}/user.py`,
      await pythonCodeFile.arrayBuffer(),
      "text/x-python"
    );
    await uploadObject(
      bucket,
      `${basePrefix}/genes.txt`,
      await geneListFile.arrayBuffer(),
      "text/plain"
    );

    if (requirementsFile && requirementsFile.size > 0) {
      await uploadObject(
        bucket,
        `${basePrefix}/requirements.txt`,
        await requirementsFile.arrayBuffer(),
        "text/plain"
      );
    }

    await runCloudRunJob({
      projectId,
      region,
      jobName,
      env: {
        GCS_BUCKET: bucket,
        GCS_JOB_PREFIX: jobPrefix,
        JOB_ID: jobId,
        REFERENCE_GFF_OBJECT: dataset.gffObject,
        REFERENCE_FASTA_OBJECT: dataset.fastaObject,
        OUTPUT_MODE: mode,
      },
    });

    return NextResponse.json({ success: true, jobId });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Job submission failed", details: error.message },
      { status: 500 }
    );
  }
}
