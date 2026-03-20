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

async function writeMeta(subdomain: string, meta: Record<string, unknown>) {
  const metaPath = path.join(PROJECTS_BASE, subdomain, "meta.json");
  await fs.writeFile(metaPath, JSON.stringify(meta, null, 2), "utf8").catch(() => {});
}

export function startWorker() {
  const worker = new Worker<JobData, JobResult>(
    "create-site",
    async (job: Job<JobData>) => {
      const data = job.data;
      const startedAt = Date.now();

      const ts = () => new Date().toISOString().slice(11, 23);
      const log = (msg: string) => job.log(`[${ts()}] ${msg}`);

      await log(`Job started for subdomain: ${data.subdomain}`);
      console.log(`[worker] job ${job.id} start`, data.subdomain);

      // Stage 1: Scrape
      await job.updateProgress(10);
      const t1 = Date.now();
      const urls = [data.companyWebsite, ...(data.competitorWebsites ?? [])];
      await log(`Scraping ${urls.length} URL(s)...`);
      for (const url of urls) await log(`  → ${url}`);

      const siteResults = await Promise.all(
        urls.map(async (url): Promise<StrippedSite | { url: string; error: string }> => {
          try {
            const result = await scrapeSite(url);
            await log(`  ✓ Scraped ${url} (${result.structure.length.toLocaleString()} chars)`);
            return result;
          } catch (error) {
            const msg = error instanceof Error ? error.message : "Failed to scrape";
            await log(`  ✕ Failed to scrape ${url}: ${msg}`);
            return { url, error: msg };
          }
        })
      );
      const scrapedSites = siteResults.filter(
        (r): r is StrippedSite => "structure" in r && typeof r.structure === "string"
      );
      const scrapeTime = (Date.now() - t1) / 1000;
      await log(`Scraping done — ${scrapedSites.length}/${urls.length} succeeded in ${scrapeTime.toFixed(1)}s`);
      console.log(`[worker] job ${job.id} scrape done`, { ok: scrapedSites.length, scrapeTime });

      // Stage 2: Generate
      await job.updateProgress(40);
      const t2 = Date.now();
      await log(`Sending to Kimi AI (model: ${process.env.KIMI_MODEL || "moonshotai/kimi-k2.5"})...`);
      await log(`Prompt includes ${scrapedSites.length} scraped site(s) + client requirements`);

      let generated = null;
      let generationError: string | null = null;
      try {
        generated = await generateSiteWithKimi({ request: data, sites: scrapedSites });
        const tokens = generated.usage;
        await log(`AI generation complete:`);
        await log(`  Files: ${generated.files.map(f => f.path).join(", ")}`);
        if (tokens) await log(`  Tokens: ${tokens.total_tokens.toLocaleString()} total (${tokens.prompt_tokens.toLocaleString()} prompt + ${tokens.completion_tokens.toLocaleString()} completion)`);
        console.log(`[worker] job ${job.id} generate done`);
      } catch (error) {
        generationError = error instanceof Error ? error.message : "Generation failed";
        await log(`AI generation failed: ${generationError}`);
        console.error(`[worker] job ${job.id} generate failed`, generationError);
        const raw = (error as any)?.rawKimiResponse;
        if (typeof raw === "string" && raw.trim()) {
          await persistKimiRawResponse(data.subdomain, raw).catch(() => {});
        }
      }
      const generateTime = (Date.now() - t2) / 1000;
      await log(`Generation stage: ${generateTime.toFixed(1)}s`);

      // Stage 3: Deploy
      await job.updateProgress(70);
      const t3 = Date.now();
      let deployResult = null;
      let deployError: string | null = null;
      if (generated) {
        await log(`Deploying ${generated.files.length} files to /var/www/sites/${data.subdomain}/`);
        for (const f of generated.files) await log(`  Writing ${f.path} (${f.content.length.toLocaleString()} bytes)`);
        try {
          deployResult = await deployProject(data.subdomain, generated);
          await log(`Nginx configured: ${deployResult.nginxConfigured}`);
          await log(`Site live at: ${deployResult.liveUrl}`);
          console.log(`[worker] job ${job.id} deploy done`, deployResult.liveUrl);
        } catch (error) {
          deployError = error instanceof Error ? error.message : "Deploy failed";
          await log(`Deploy failed: ${deployError}`);
          console.error(`[worker] job ${job.id} deploy failed`, deployError);
        }
      } else {
        await log(`Skipping deploy — no generated output`);
      }
      const deployTime = (Date.now() - t3) / 1000;
      await log(`Deploy stage: ${deployTime.toFixed(2)}s`);

      await job.updateProgress(100);
      const totalTime = (Date.now() - startedAt) / 1000;
      await log(`Done. Total time: ${totalTime.toFixed(1)}s`);
      console.log(`[worker] job ${job.id} done in ${totalTime}s`);

      // Persist meta.json alongside project files for the dashboard
      if (deployResult) {
        await writeMeta(data.subdomain, {
          subdomain: data.subdomain,
          companyWebsite: data.companyWebsite,
          liveUrl: deployResult.liveUrl,
          createdAt: Date.now(),
          scrapeTime,
          generateTime,
          deployTime,
          totalTime,
          tokens: generated?.usage
            ? {
                prompt: generated.usage.prompt_tokens,
                completion: generated.usage.completion_tokens,
                total: generated.usage.total_tokens,
              }
            : null,
          generationError,
          deployError,
        });
      }

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
