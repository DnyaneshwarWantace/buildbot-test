import { NextResponse } from "next/server";
import { createQueue } from "@/lib/queue";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const job = await createQueue.getJob(jobId);

  if (!job) {
    return NextResponse.json({ message: "Job not found" }, { status: 404 });
  }

  const state = await job.getState();
  const progress = job.progress;
  const result = job.returnvalue ?? null;
  const failedReason = job.failedReason ?? null;

  const { logs } = await createQueue.getJobLogs(jobId, 0, 200);

  return NextResponse.json({
    jobId,
    state,
    progress,
    result,
    failedReason,
    logs: logs ?? [],
  });
}
