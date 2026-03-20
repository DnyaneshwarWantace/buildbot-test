import { type StrippedSite } from "./scrape";
import { type CreateRequest } from "./validation";

export type GeneratedSiteFile = {
  path: string;
  content: string;
};

export type GeneratedSiteUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export type GeneratedSiteSpec = {
  files: GeneratedSiteFile[];
  dockerfile: string;
  startCommand?: string;
  usage?: GeneratedSiteUsage | null;
};

type GenerateInput = {
  request: CreateRequest;
  sites: StrippedSite[];
};

const KIMI_FETCH_TIMEOUT_MS = 20 * 60 * 1000;
const KIMI_MAX_RETRIES = 2;

const KIMI_API_BASE = process.env.KIMI_API_BASE || process.env.MOONSHOT_BASE_URL || "https://api.moonshot.cn/v1";

const STATIC_DOCKERFILE = `FROM nginx:alpine
COPY . /usr/share/nginx/html
EXPOSE 80
`;

const SECTION_FILES = ["index.html", "styles.css", "script.js", "README.md"] as const;

function extractSection(content: string, filename: string): string | null {
  const escaped = filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(
    `===\\s*${escaped}\\s*===\\s*([\\s\\S]*?)(?=\\n===|$)`,
    "i",
  );
  const m = content.match(regex);
  return m ? m[1].trim() : null;
}

// README.md is optional — the site works without it
const REQUIRED_SECTION_FILES = ["index.html", "styles.css", "script.js"] as const;

function parseSectionFormat(rawContent: string): GeneratedSiteSpec {
  const content = rawContent.replace(/```/g, "").trim();

  for (const name of REQUIRED_SECTION_FILES) {
    const headerRegex = new RegExp(`===\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*===`, "i");
    if (!headerRegex.test(content)) {
      throw new Error(`AI output missing section: ${name}`);
    }
  }

  const files: GeneratedSiteFile[] = [];

  for (const path of SECTION_FILES) {
    const fileContent = extractSection(content, path);
    if (path === "index.html" && !fileContent) {
      throw new Error("index.html not generated properly");
    }
    files.push({ path, content: fileContent ?? "" });
  }

  return {
    files,
    dockerfile: STATIC_DOCKERFILE,
  };
}

function buildUserPrompt(input: GenerateInput): string {
  const crawlText = input.sites
    .map(
      (s) =>
        `URL: ${s.url}\n\nSTRUCTURE (nested text + links):\n${s.structure}`,
    )
    .join("\n\n---\n\n")
    .trim();

  const hasCrawl = crawlText.length > 0;

  const lines: string[] = [];
  lines.push(`Company: ${input.request.companyName ?? "—"}`);
  if (!hasCrawl) {
    lines.push(`Company website: ${input.request.companyWebsite}`);
  }
  lines.push(`Client requirements: ${input.request.clientRequirements}`);
  lines.push("");
  lines.push("SCRAPED WEBSITE CONTENT (use this to rebuild and improve the site):");
  lines.push("");
  if (hasCrawl) {
    lines.push(crawlText);
    lines.push("");
  }
  lines.push(
    "Generate exactly 4 files in this format. Do NOT include markdown code blocks or triple backticks. Return ONLY the sections below:",
  );
  lines.push("");
  lines.push("=== index.html ===");
  lines.push("<html content here, use Tailwind CDN, responsive>");
  lines.push("");
  lines.push("=== styles.css ===");
  lines.push("<css content>");
  lines.push("");
  lines.push("=== script.js ===");
  lines.push("<js content>");
  lines.push("");
  lines.push("=== README.md ===");
  lines.push("<readme content>");

  return lines.join("\n");
}

async function attemptGenerate(input: GenerateInput, apiKey: string, systemPrompt: string): Promise<GeneratedSiteSpec> {
    const chatUrl = `${KIMI_API_BASE.replace(/\/$/, "")}/chat/completions`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), KIMI_FETCH_TIMEOUT_MS);

    const payload = {
      model: process.env.KIMI_MODEL || "moonshotai/kimi-k2.5",
      temperature: 0.7,
      max_tokens: 15000,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: buildUserPrompt(input) },
      ],
    };

    const isOpenRouter = chatUrl.includes("openrouter.ai");
    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    if (isOpenRouter) {
      headers["HTTP-Referer"] = process.env.OPENROUTER_REFERER || "https://wantace.org";
      headers["X-Title"] = process.env.OPENROUTER_TITLE || "Buildbot";
    }

    let response: Response;
    try {
      response = await fetch(chatUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") throw new Error("Kimi request timed out");
      throw err;
    }
    clearTimeout(timeoutId);

    // Use text() first — response.json() throws on truncated bodies, hiding the real error
    const bodyText = await response.text().catch(() => "");

    if (!response.ok) {
      throw new Error(`Kimi request failed: ${response.status} ${response.statusText} ${bodyText.slice(0, 200)}`);
    }

    let data: any;
    try {
      data = JSON.parse(bodyText);
    } catch {
      throw new Error(`Kimi API returned malformed JSON (truncated response): ${bodyText.slice(0, 100)}`);
    }

    const rawContent = data?.choices?.[0]?.message?.content;
    if (!rawContent || typeof rawContent !== "string") {
      throw new Error("Kimi response missing content");
    }

    const normalized = rawContent.replace(/```/g, "").trim();

    const usageRaw = data?.usage;
    const usage: GeneratedSiteUsage | null =
      usageRaw && typeof usageRaw === "object"
        ? {
            prompt_tokens: Number(usageRaw.prompt_tokens ?? 0),
            completion_tokens: Number(usageRaw.completion_tokens ?? 0),
            total_tokens: Number(usageRaw.total_tokens ?? 0),
          }
        : null;

    if (usage) console.log("[generate] usage", usage);

    let spec: GeneratedSiteSpec;
    try {
      const parsed = JSON.parse(normalized);
      if (Array.isArray(parsed.files) && typeof parsed.dockerfile === "string") {
        spec = {
          files: parsed.files.map((file: any) => ({ path: String(file.path), content: String(file.content ?? "") })),
          dockerfile: parsed.dockerfile,
          startCommand: parsed.startCommand ? String(parsed.startCommand) : undefined,
        };
        console.log("[generate] Parsed JSON response", { fileCount: spec.files.length });
      } else {
        spec = parseSectionFormat(normalized);
        console.log("[generate] Parsed section format (JSON fallback)", { fileCount: spec.files.length });
      }
    } catch {
      try {
        spec = parseSectionFormat(normalized);
        console.log("[generate] Parsed section format", { fileCount: spec.files.length });
      } catch (sectionErr) {
        const err = new Error("Failed to parse Kimi response (expected JSON or === section === format)");
        (err as any).rawKimiResponse = normalized;
        throw err;
      }
    }

    if (!spec.files.some((f) => f.path === "index.html" && f.content.trim())) {
      throw new Error("Kimi response missing valid index.html");
    }

    if (usage) spec.usage = usage;
    return spec;
}

export async function generateSiteWithKimi(input: GenerateInput): Promise<GeneratedSiteSpec> {
    const apiKey = process.env.MOONSHOT_API_KEY;
    if (!apiKey) throw new Error("MOONSHOT_API_KEY is not set");

    const systemPrompt = process.env.KIMI_SYSTEM_PROMPT;
    if (!systemPrompt) throw new Error("KIMI_SYSTEM_PROMPT is not set");

    console.log("[generate] Kimi request start", { subdomain: input.request.subdomain, sitesCount: input.sites.length });

    let lastErr: Error = new Error("Unknown error");
    for (let attempt = 1; attempt <= KIMI_MAX_RETRIES + 1; attempt++) {
      if (attempt > 1) {
        const delay = attempt * 3000;
        console.log(`[generate] retry ${attempt - 1}/${KIMI_MAX_RETRIES} after ${delay}ms`, { subdomain: input.request.subdomain, reason: lastErr.message });
        await new Promise((r) => setTimeout(r, delay));
      }
      try {
        const spec = await attemptGenerate(input, apiKey, systemPrompt);
        console.log("[generate] Kimi request done", { fileCount: spec.files.length, attempt });
        return spec;
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error(String(err));
        console.error(`[generate] attempt ${attempt} failed`, lastErr.message);
      }
    }

    const finalErr = new Error(`Generation failed after ${KIMI_MAX_RETRIES + 1} attempts: ${lastErr.message}`);
    (finalErr as any).rawKimiResponse = (lastErr as any).rawKimiResponse;
    throw finalErr;
}

