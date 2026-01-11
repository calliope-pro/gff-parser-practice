import { NextRequest, NextResponse } from "next/server";
import { downloadObjectText } from "@/lib/server/gcp";

export const runtime = "nodejs";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const bucket = getEnv("GCS_BUCKET");
    const jobPrefix = (process.env.GCS_JOB_PREFIX || "jobs").replace(/\/+$/g, "");
    const jobId = params.jobId;
    const basePrefix = `${jobPrefix}/${jobId}`;

    const statusText = await downloadObjectText(
      bucket,
      `${basePrefix}/status.json`
    );

    if (!statusText) {
      return NextResponse.json({ status: "running" });
    }

    let statusData: unknown = statusText;
    try {
      statusData = JSON.parse(statusText);
    } catch {
      statusData = statusText;
    }

    const [result, answer, userLog, answerLog] = await Promise.all([
      downloadObjectText(bucket, `${basePrefix}/result.fasta`),
      downloadObjectText(bucket, `${basePrefix}/answer.fasta`),
      downloadObjectText(bucket, `${basePrefix}/user.log`),
      downloadObjectText(bucket, `${basePrefix}/answer.log`),
    ]);

    return NextResponse.json({
      status: "completed",
      statusData,
      result,
      answer,
      logs: {
        user: userLog,
        answer: answerLog,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Job status failed", details: error.message },
      { status: 500 }
    );
  }
}
