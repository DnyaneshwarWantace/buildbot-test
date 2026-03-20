import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const PROJECTS_BASE = process.env.PROJECTS_BASE || path.join(process.cwd(), "projects");
const DOMAIN = process.env.DOMAIN || "wantace.org";

async function getDirSizeBytes(dirPath: string): Promise<number> {
  let total = 0;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    await Promise.all(
      entries.map(async (e) => {
        if (e.name === "meta.json") return;
        const full = path.join(dirPath, e.name);
        if (e.isFile()) {
          const s = await fs.stat(full).catch(() => null);
          if (s) total += s.size;
        }
      })
    );
  } catch {}
  return total;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export async function GET() {
  try {
    const entries = await fs.readdir(PROJECTS_BASE, { withFileTypes: true });

    const sites = await Promise.all(
      entries
        .filter((e) => e.isDirectory() && e.name !== "bin")
        .map(async (e) => {
          const dir = path.join(PROJECTS_BASE, e.name);

          // Read meta.json if exists
          let meta: Record<string, any> = {};
          try {
            const raw = await fs.readFile(path.join(dir, "meta.json"), "utf8");
            meta = JSON.parse(raw);
          } catch {
            // No meta — fall back to dir mtime
            const stat = await fs.stat(dir).catch(() => null);
            meta.createdAt = stat?.mtimeMs ?? 0;
          }

          const sizeBytes = await getDirSizeBytes(dir);

          return {
            subdomain: e.name,
            url: meta.liveUrl ?? `http://${e.name}.${DOMAIN}`,
            companyWebsite: meta.companyWebsite ?? null,
            createdAt: meta.createdAt ?? 0,
            scrapeTime: meta.scrapeTime ?? null,
            generateTime: meta.generateTime ?? null,
            deployTime: meta.deployTime ?? null,
            totalTime: meta.totalTime ?? null,
            tokens: meta.tokens ?? null,
            sizeBytes,
            sizeFormatted: formatSize(sizeBytes),
            generationError: meta.generationError ?? null,
            deployError: meta.deployError ?? null,
          };
        })
    );

    sites.sort((a, b) => b.createdAt - a.createdAt);

    return NextResponse.json({ sites });
  } catch {
    return NextResponse.json({ sites: [] });
  }
}
