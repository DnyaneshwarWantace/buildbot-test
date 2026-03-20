import { Queue, Worker, Job } from "bullmq";
import { scrapeSite, type StrippedSite } from "@/app/api/v1/create/scrape";
import { generateSiteWithKimi } from "@/app/api/v1/create/generate";
import { deployProject } from "@/app/api/v1/create/deploy";
import type { CreateRequest } from "@/app/api/v1/create/validation";
import fs from "node:fs/promises";
import path from "node:path";

const PROJECTS_BASE =
  process.env.PROJECTS_BASE || path.join(process.cwd(), "projects");

const connection = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
};

export const createQueue = new Queue("create-site", { connection });

export type JobData = CreateRequest;

export type JobResult = {
  subdomain: string;
  liveUrl: string | null;
  nginxConfigured: boolean;
  generationError: string | null;
  deployError: string | null;
  stats: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  } | null;
  total_time: number;
};

async function persistKimiRawResponse(subdomain: string, raw: string) {
  const binDir = path.join(PROJECTS_BASE, "bin");
  const filePath = path.join(binDir, `${subdomain}.txt`);
  await fs.mkdir(binDir, { recursive: true });
  await fs.writeFile(filePath, raw, "utf8");
}

export function startWorker() {
  const worker = new Worker<JobData, JobResult>(
    "create-site",
    async (job: Job<JobData>) => {
      const data = job.data;
      const startedAt = Date.now();

      console.log(`[worker] job ${job.id} start`, data.subdomain);

      // Stage 1: Scrape
      await job.updateProgress(10);
      const urls = [data.companyWebsite, ...(data.competitorWebsites ?? [])];
      const siteResults = await Promise.all(
        urls.map(async (url): Promise<StrippedSite | { url: string; error: string }> => {
          try {
            return await scrapeSite(url);
          } catch (error) {
            return { url, error: error instanceof Error ? error.message : "Failed to scrape" };
          }
        })
      );
      const scrapedSites = siteResults.filter(
        (r): r is StrippedSite => "structure" in r && typeof r.structure === "string"
      );
      console.log(`[worker] job ${job.id} scrape done`, { ok: scrapedSites.length });

      // Stage 2: Generate
      await job.updateProgress(40);
      let generated = null;
      let generationError: string | null = null;
      try {
        generated = await generateSiteWithKimi({ request: data, sites: scrapedSites });
        console.log(`[worker] job ${job.id} generate done`);
      } catch (error) {
        generationError = error instanceof Error ? error.message : "Generation failed";
        console.error(`[worker] job ${job.id} generate failed`, generationError);
        const raw = (error as any)?.rawKimiResponse;
        if (typeof raw === "string" && raw.trim()) {
          await persistKimiRawResponse(data.subdomain, raw).catch(() => {});
        }
      }

      // Stage 3: Deploy
      await job.updateProgress(70);
      let deployResult = null;
      let deployError: string | null = null;
      if (generated) {
        try {
          deployResult = await deployProject(data.subdomain, generated);
          console.log(`[worker] job ${job.id} deploy done`, deployResult.liveUrl);
        } catch (error) {
          deployError = error instanceof Error ? error.message : "Deploy failed";
          console.error(`[worker] job ${job.id} deploy failed`, deployError);
        }
      }

      await job.updateProgress(100);
      const totalTime = (Date.now() - startedAt) / 1000;
      console.log(`[worker] job ${job.id} done in ${totalTime}s`);

      return {
        subdomain: data.subdomain,
        liveUrl: deployResult?.liveUrl ?? null,
        nginxConfigured: deployResult?.nginxConfigured ?? false,
        generationError,
        deployError,
        stats: generated?.usage ?? null,
        total_time: totalTime,
      };
    },
    {
      connection,
      concurrency: Number(process.env.WORKER_CONCURRENCY) || 10,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[worker] job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[worker] job ${job?.id} failed`, err.message);
  });

  return worker;
}
