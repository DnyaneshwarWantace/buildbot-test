import { NextResponse } from "next/server";
import { createRequestSchema, type CreateRequest } from "./validation";
import { createQueue } from "@/lib/queue";

export async function POST(request: Request) {
  console.log("[create] POST /api/v1/create start");

  const json = await request.json().catch(() => null);
  const parsed = createRequestSchema.safeParse(json);

  if (!parsed.success) {
    console.log("[create] validation failed", parsed.error.issues);
    return NextResponse.json(
      { message: "Validation failed", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const data: CreateRequest = parsed.data;
  console.log("[create] enqueuing job", data.subdomain);

  const job = await createQueue.add("create-site", data, {
    jobId: data.subdomain,
    removeOnComplete: { age: 60 * 60 * 24 }, // keep for 24h
    removeOnFail: { age: 60 * 60 * 24 },
  });

  console.log("[create] job enqueued", job.id);

  return NextResponse.json({
    success: true,
    jobId: job.id,
    message: "Job queued — poll /api/v1/status/" + job.id + " for progress",
  });
}
