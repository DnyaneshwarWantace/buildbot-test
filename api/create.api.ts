export type CreatePayload = {
  subdomain: string;
  companyName?: string;
  companyWebsite: string;
  competitorWebsites?: string[];
  clientRequirements: string;
};

export type JobStatus = {
  jobId: string;
  state: "waiting" | "active" | "completed" | "failed";
  progress: number;
  result: {
    subdomain: string;
    liveUrl: string | null;
    nginxConfigured: boolean;
    generationError: string | null;
    deployError: string | null;
    stats: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null;
    total_time: number;
  } | null;
  failedReason: string | null;
};

export async function createProject(payload: CreatePayload): Promise<{ jobId: string }> {
  const response = await fetch("/api/v1/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      (data && typeof data === "object" && "message" in data && (data as any).message) ||
      "Failed to create project";
    throw new Error(String(message));
  }

  return { jobId: data.jobId };
}

export async function getJobStatus(jobId: string): Promise<JobStatus> {
  const response = await fetch(`/api/v1/status/${jobId}`);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error("Failed to get job status");
  }

  return data;
}

// Poll until job is completed or failed
export async function waitForJob(
  jobId: string,
  onProgress?: (status: JobStatus) => void,
  intervalMs = 2000
): Promise<JobStatus> {
  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const status = await getJobStatus(jobId);
        onProgress?.(status);

        if (status.state === "completed" || status.state === "failed") {
          resolve(status);
        } else {
          setTimeout(poll, intervalMs);
        }
      } catch (err) {
        reject(err);
      }
    };
    poll();
  });
}
