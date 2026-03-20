"use client";

import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { createProject, getJobStatus, type CreatePayload, type JobStatus } from "../../api/create.api";
import CreateForm, { type FormValues } from "../(components)/create/CreateForm";
import BuildPanel, { type Stage, type BuildResult } from "../(components)/create/BuildPanel";
import RecentSites from "../(components)/create/RecentSites";

const formSchema = z.object({
  subdomain: z
    .string()
    .min(1, "Subdomain is required")
    .refine((s) => /^[a-z0-9-]+$/i.test(s), "Use only letters, numbers, and hyphens"),
  companyName: z.string().optional(),
  companyWebsite: z.string().url("Company website must be a valid URL"),
  clientRequirements: z.string().min(1, "Client requirements are required"),
});

const competitorUrlSchema = z.string().url("Must be a valid URL");

const INITIAL_STAGES: Stage[] = [
  { key: "scrape", label: "Scraping websites", status: "idle", startedAt: null, doneAt: null },
  { key: "generate", label: "AI generation (Kimi)", status: "idle", startedAt: null, doneAt: null },
  { key: "deploy", label: "Deploying to nginx", status: "idle", startedAt: null, doneAt: null },
];

// progress thresholds per stage
const STAGE_START: Record<string, number> = { scrape: 10, generate: 40, deploy: 70 };
const STAGE_DONE: Record<string, number> = { scrape: 40, generate: 70, deploy: 100 };

export default function CreatePage() {
  const [values, setValues] = useState<FormValues>({
    subdomain: "",
    companyName: "",
    companyWebsite: "",
    clientRequirements: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
  const [competitorInput, setCompetitorInput] = useState("");
  const [competitorWebsites, setCompetitorWebsites] = useState<string[]>([]);
  const [competitorError, setCompetitorError] = useState<string | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [stages, setStages] = useState<Stage[]>(INITIAL_STAGES);
  const [result, setResult] = useState<BuildResult | null>(null);
  const [isIdle, setIsIdle] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevProgressRef = useRef<number>(-1);

  // 1s tick to update live elapsed timers
  useEffect(() => {
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  // Resume in-progress job after page refresh
  useEffect(() => {
    const savedJobId = sessionStorage.getItem("activeJobId");
    if (!savedJobId) return;
    setIsIdle(false);
    setStages(INITIAL_STAGES);
    prevProgressRef.current = -1;
    pollJob(savedJobId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function applyProgress(progress: number, status: JobStatus) {
    const prev = prevProgressRef.current;
    prevProgressRef.current = progress;

    setStages((current) => {
      const next = current.map((s) => ({ ...s }));
      const t = Date.now();

      for (const s of next) {
        const start = STAGE_START[s.key];
        const done = STAGE_DONE[s.key];

        if (s.status === "idle" && progress >= start) {
          s.status = "running";
          s.startedAt = t;
        }
        if (s.status === "running" && progress >= done) {
          if (status.state === "completed" && s.key === "deploy") {
            const res = status.result;
            if (res?.deployError) {
              s.status = "error";
              s.error = res.deployError;
            } else {
              s.status = "done";
            }
          } else if (status.state === "completed" && s.key === "generate") {
            const res = status.result;
            if (res?.generationError) {
              s.status = "error";
              s.error = res.generationError;
            } else {
              s.status = "done";
            }
          } else {
            s.status = "done";
          }
          s.doneAt = t;
        }
      }

      // seed startedAt for first stage on first active tick
      if (prev < STAGE_START["scrape"] && progress >= STAGE_START["scrape"]) {
        const scrape = next.find((s) => s.key === "scrape");
        if (scrape && !scrape.startedAt) scrape.startedAt = t;
      }

      return next;
    });
  }

  function pollJob(jobId: string) {
    prevProgressRef.current = -1;
    pollRef.current = setInterval(async () => {
      try {
        const status = await getJobStatus(jobId);
        applyProgress(status.progress ?? 0, status);
        if (status.logs?.length) setLogs(status.logs);

        if (status.state === "completed") {
          stopPolling();
          sessionStorage.removeItem("activeJobId");
          setRefreshTrigger((n) => n + 1);
          const r = status.result;
          setResult({
            subdomain: r?.subdomain ?? "",
            liveUrl: r?.liveUrl ?? null,
            stats: r?.stats ?? null,
            total_time: r?.total_time ?? 0,
            generationError: r?.generationError ?? null,
            deployError: r?.deployError ?? null,
          });
          if (r?.liveUrl) {
            try { window.open(r.liveUrl, "_blank", "noopener,noreferrer"); } catch {}
          }
        } else if (status.state === "failed") {
          stopPolling();
          sessionStorage.removeItem("activeJobId");
          setJobError(status.failedReason ?? "Job failed");
        }
      } catch {
        stopPolling();
        setJobError("Failed to get job status");
      }
    }, 2000);
  }

  const mutation = useMutation({
    mutationFn: (payload: CreatePayload) => createProject(payload),
    onSuccess: ({ jobId }) => {
      sessionStorage.setItem("activeJobId", jobId);
      setJobError(null);
      setResult(null);
      setLogs([]);
      setIsIdle(false);
      setStages(INITIAL_STAGES);
      prevProgressRef.current = -1;
      pollJob(jobId);
    },
    onError: (error: unknown) => {
      setJobError(error instanceof Error ? error.message : "Something went wrong.");
    },
  });

  const isRunning =
    mutation.isPending ||
    (!isIdle && result === null && jobError === null);

  const buttonLabel = mutation.isPending
    ? "Queuing..."
    : isRunning
    ? "Generating..."
    : "Create project";

  const handleChange =
    (field: keyof FormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setValues((v) => ({ ...v, [field]: e.target.value }));

  const handleCompetitorKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const val = competitorInput.trim();
    if (!val) return;
    if (competitorWebsites.length >= 3) {
      setCompetitorError("Max 3 competitor websites.");
      return;
    }
    const parsed = competitorUrlSchema.safeParse(val);
    if (!parsed.success) {
      setCompetitorError(parsed.error.issues[0]?.message ?? "Invalid URL");
      return;
    }
    setCompetitorWebsites((c) => [...c, val]);
    setCompetitorInput("");
    setCompetitorError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setJobError(null);

    const parsed = formSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof FormValues, string>> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path[0];
        if (typeof path === "string" && !(path in fieldErrors)) {
          fieldErrors[path as keyof FormValues] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    const data = parsed.data;
    mutation.mutate({
      subdomain: data.subdomain.toLowerCase().trim(),
      companyName: data.companyName || undefined,
      companyWebsite: data.companyWebsite,
      competitorWebsites: competitorWebsites.length > 0 ? competitorWebsites : undefined,
      clientRequirements: data.clientRequirements,
    });
  };

  return (
    <div className="min-h-screen bg-[#F7F4EA] p-[24px] flex flex-col gap-4">
      {/* Top — two-column layout */}
      <div className="flex flex-col lg:flex-row gap-[10px] items-stretch" style={{ minHeight: "calc(100vh - 48px - 1rem - 320px)" }}>
        {/* Left — form */}
        <div className="w-full lg:w-[42%] shrink-0">
          <CreateForm
            values={values}
            errors={errors}
            onChange={handleChange}
            onSubmit={handleSubmit}
            isDisabled={isRunning}
            buttonLabel={buttonLabel}
            competitorWebsites={competitorWebsites}
            competitorInput={competitorInput}
            onCompetitorInputChange={(val) => {
              setCompetitorInput(val);
              if (competitorError) setCompetitorError(null);
            }}
            onCompetitorKeyDown={handleCompetitorKeyDown}
            onRemoveCompetitor={(url) => setCompetitorWebsites((c) => c.filter((u) => u !== url))}
            competitorError={competitorError}
          />
        </div>

        {/* Right — build panel */}
        <BuildPanel
          isIdle={isIdle}
          stages={stages}
          result={result}
          jobError={jobError}
          logs={logs}
          now={now}
          refreshTrigger={refreshTrigger}
        />
      </div>

      {/* Bottom — full-width recent sites table */}
      <div className="w-full">
        <RecentSites refreshTrigger={refreshTrigger} />
      </div>
    </div>
  );
}
