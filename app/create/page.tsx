"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { createProject, getJobStatus, type CreatePayload, type JobStatus } from "../../api/create.api";
import Popup from "reactjs-popup";

const formSchema = z.object({
  subdomain: z
    .string()
    .min(1, "Subdomain is required")
    .refine((s) => /^[a-z0-9-]+$/i.test(s), "Use only letters, numbers, and hyphens"),
  companyName: z.string().optional(),
  companyWebsite: z.string().url("Company website must be a valid URL"),
  clientRequirements: z.string().min(1, "Client requirements are required"),
});

const competitorUrlSchema = z
  .string()
  .url("Competitor website must be a valid URL");

type FormValues = z.infer<typeof formSchema>;

export default function Create() {
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
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [liveUrl, setLiveUrl] = useState<string | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);
  const [jobProgress, setJobProgress] = useState<number | null>(null);
  const [jobState, setJobState] = useState<string | null>(null);

  const pollJob = (jobId: string) => {
    const interval = setInterval(async () => {
      try {
        const status: JobStatus = await getJobStatus(jobId);
        setJobProgress(typeof status.progress === "number" ? status.progress : null);
        setJobState(status.state);

        if (status.state === "completed") {
          clearInterval(interval);
          const result = status.result;
          setLiveUrl(result?.liveUrl ?? null);
          setDeployError(result?.deployError ?? null);
          setGenerationError(result?.generationError ?? null);
          setFormSuccess(
            result?.liveUrl
              ? "Project created and deployed."
              : result?.deployError
                ? "Project generated but deploy failed."
                : result?.generationError
                  ? "Scraping done; generation failed."
                  : "Project created."
          );
          if (result?.liveUrl) {
            try {
              window.open(result.liveUrl, "_blank", "noopener,noreferrer");
            } catch {
              setPopupOpen(true);
            }
          }
        } else if (status.state === "failed") {
          clearInterval(interval);
          setFormError(status.failedReason ?? "Job failed.");
        }
      } catch {
        clearInterval(interval);
        setFormError("Failed to get job status.");
      }
    }, 2000);
  };

  const mutation = useMutation({
    mutationFn: async (payload: CreatePayload) => createProject(payload),
    onSuccess: ({ jobId }) => {
      setFormError(null);
      setJobProgress(0);
      setJobState("waiting");
      pollJob(jobId);
    },
    onError: (error: unknown) => {
      setFormError(error instanceof Error ? error.message : "Something went wrong.");
      setFormSuccess(null);
      setLiveUrl(null);
      setDeployError(null);
      setGenerationError(null);
      setJobProgress(null);
      setJobState(null);
    },
  });

  const handleChange =
    (field: keyof FormValues) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setValues((current) => ({ ...current, [field]: value }));
    };

  const handleCompetitorKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();

    const value = competitorInput.trim();

    if (!value) {
      return;
    }

    if (competitorWebsites.length >= 3) {
      setCompetitorError("You can add up to 3 competitor websites.");
      return;
    }

    const parsed = competitorUrlSchema.safeParse(value);

    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setCompetitorError(issue?.message ?? "Competitor website must be a valid URL");
      return;
    }

    setCompetitorWebsites((current) => [...current, value]);
    setCompetitorInput("");
    setCompetitorError(null);
  };

  const handleRemoveCompetitor = (url: string) => {
    setCompetitorWebsites((current) => current.filter((item) => item !== url));
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    setFormSuccess(null);
    setLiveUrl(null);
    setDeployError(null);
    setGenerationError(null);

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

    const payload: CreatePayload = {
      subdomain: data.subdomain.toLowerCase().trim(),
      companyName: data.companyName || undefined,
      companyWebsite: data.companyWebsite,
      competitorWebsites:
        competitorWebsites.length > 0 ? competitorWebsites : undefined,
      clientRequirements: data.clientRequirements,
    };

    mutation.mutate(payload);
  };

  return (
    <div className="bg-[#F7F4EA] min-h-screen flex items-center justify-center px-4">
      <Popup
        open={popupOpen}
        closeOnDocumentClick={false}
        closeOnEscape={false}
        modal
        nested
        contentStyle={{
          borderRadius: "0.75rem",
          padding: "1rem 1.25rem",
          border: "1px solid #F97316",
          boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
        }}
      >
        <div
          className="text-sm text-[#7C2D12] bg-[#FFF7ED] rounded-xl"
          onMouseEnter={() => setPopupOpen(false)}
        >
          <p className="font-medium">Popup blocked by browser.</p>
          <p className="mt-1 text-xs text-[#9A3412]">
            Please allow popups for this site or click the "Live at" link below to open your generated site.
          </p>
          <p className="mt-2 text-[11px] text-[#B45309]">
            Hover over this message once you&apos;re done to dismiss it.
          </p>
        </div>
      </Popup>
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-[0_10px_40px_rgba(0,0,0,0.08)] p-8">
        <h1 className="mb-6 text-2xl font-semibold text-[#1F2933]">Create project</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="w-full md:w-1/2">
              <label className="block text-sm font-medium text-[#374151] mb-1">
                Subdomain (project id) *
              </label>
              <input
                type="text"
                value={values.subdomain}
                onChange={handleChange("subdomain")}
                className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#BF4646] focus:ring-2 focus:ring-[#BF4646]/20 bg-white"
                placeholder="subdomain"
              />
              {errors.subdomain && (
                <p className="mt-1 text-xs text-[#B91C1C]">{errors.subdomain}</p>
              )}
            </div>

            <div className="w-full md:w-1/2">
              <label className="block text-sm font-medium text-[#374151] mb-1">
                Company name (optional)
              </label>
              <input
                type="text"
                value={values.companyName}
                onChange={handleChange("companyName")}
                className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#BF4646] focus:ring-2 focus:ring-[#BF4646]/20 bg-white"
                placeholder="Company name"
              />
              {errors.companyName && (
                <p className="mt-1 text-xs text-[#B91C1C]">{errors.companyName}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">
              Company website *
            </label>
            <input
              type="url"
              value={values.companyWebsite}
              onChange={handleChange("companyWebsite")}
              className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#BF4646] focus:ring-2 focus:ring-[#BF4646]/20 bg-white"
              placeholder="Company website"
            />
            {errors.companyWebsite && (
              <p className="mt-1 text-xs text-[#B91C1C]">{errors.companyWebsite}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">
              Competitor websites (optional, max 3)
            </label>
            <input
              type="url"
              value={competitorInput}
              onChange={(event) => {
                setCompetitorInput(event.target.value);
                if (competitorError) {
                  setCompetitorError(null);
                }
              }}
              onKeyDown={handleCompetitorKeyDown}
              className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#BF4646] focus:ring-2 focus:ring-[#BF4646]/20 bg-white"
              placeholder="Paste a competitor website and press Enter"
            />
            {competitorError && (
              <p className="mt-1 text-xs text-[#B91C1C]">{competitorError}</p>
            )}
            {competitorWebsites.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {competitorWebsites.map((url) => (
                  <div
                    key={url}
                    className="group inline-flex items-center rounded-full bg-[#F3F4F6] px-3 py-1 text-xs text-[#111827]"
                  >
                    <span className="max-w-[200px] truncate">{url}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCompetitor(url)}
                      className="ml-2 text-[#6B7280] opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Remove competitor website"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-[#374151] mb-1">
              Client requirements *
            </label>
            <textarea
              rows={4}
              value={values.clientRequirements}
              onChange={handleChange("clientRequirements")}
              className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-sm text-[#111827] outline-none focus:border-[#BF4646] focus:ring-2 focus:ring-[#BF4646]/20 bg-white resize-none"
              placeholder="Describe what the client needs..."
            />
            {errors.clientRequirements && (
              <p className="mt-1 text-xs text-[#B91C1C]">{errors.clientRequirements}</p>
            )}
          </div>

          {formError && <p className="text-sm text-[#B91C1C]">{formError}</p>}
          {formSuccess && <p className="text-sm text-[#059669]">{formSuccess}</p>}
          {liveUrl && (
            <p className="text-sm">
              Live at:{" "}
              <a
                href={liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#BF4646] underline"
              >
                {liveUrl}
              </a>
            </p>
          )}
          {generationError && (
            <p className="text-sm text-[#B91C1C]">Generation error: {generationError}</p>
          )}
          {deployError && (
            <p className="text-sm text-[#B91C1C]">Deploy error: {deployError}</p>
          )}

          {jobProgress !== null && jobState !== "completed" && jobState !== "failed" && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-[#6B7280]">
                <span>{jobState === "waiting" ? "Queued..." : jobState === "active" ? "Processing..." : jobState ?? "Working..."}</span>
                <span>{jobProgress}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-[#F3F4F6]">
                <div
                  className="h-1.5 rounded-full bg-[#BF4646] transition-all duration-500"
                  style={{ width: `${jobProgress}%` }}
                />
              </div>
            </div>
          )}
          <p className="text-xs text-[#6B7280]">
            This may take several minutes (scraping, AI generation, deploy).
          </p>
          <button
            type="submit"
            disabled={mutation.isPending || (jobState !== null && jobState !== "completed" && jobState !== "failed")}
            className="mt-2 inline-flex w-full items-center justify-center rounded-lg bg-[#BF4646] px-4 py-2.5 text-sm font-medium text-white shadow-sm transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {mutation.isPending ? "Queuing..." : jobState === "active" ? "Generating..." : jobState === "waiting" ? "Waiting in queue..." : "Create project"}
          </button>
        </form>
      </div>
    </div>
  );
}

