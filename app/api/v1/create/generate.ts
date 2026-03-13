import { type StrippedSite } from "./scrape";
import { type CreateRequest } from "./validation";

export type GeneratedSiteFile = {
  path: string;
  content: string;
};

export type GeneratedSiteSpec = {
  files: GeneratedSiteFile[];
  dockerfile: string;
  startCommand?: string;
};

type GenerateInput = {
  request: CreateRequest;
  sites: StrippedSite[];
};

const KIMI_FETCH_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export async function generateSiteWithKimi(input: GenerateInput ): Promise<GeneratedSiteSpec> {
    const apiKey = process.env.MOONSHOT_API_KEY;
    if (!apiKey) throw new Error("MOONSHOT_API_KEY is not set");

    console.log("[generate] Kimi request start", { subdomain: input.request.subdomain, sitesCount: input.sites.length });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), KIMI_FETCH_TIMEOUT_MS);

    const payload = {
      model: "moonshotai/kimi-k2.5",
      temperature: 0.6,
      max_tokens: 15000,
      messages: [
        {
          role: "system",
          content:
            "You are an AI that generates full web projects. Respond ONLY with strict JSON of the form {\"files\":[{\"path\":\"index.html\",\"content\":\"...\"}],\"dockerfile\":\"...\",\"startCommand\":\"...\"} and no other text.",
        },
        {
          role: "user",
          content: JSON.stringify(input),
        },
      ],
    };

    let response: Response;
    try {
      response = await fetch("https://api.moonshot.cn/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        console.log("[generate] Kimi request timed out", KIMI_FETCH_TIMEOUT_MS);
        throw new Error("Kimi request timed out");
      }
      throw err;
    }
    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.log("[generate] Kimi request failed", { status: response.status, statusText: response.statusText });
      throw new Error(
        `Kimi request failed: ${response.status} ${response.statusText} ${text}`,
      );
    }

    const data = (await response.json()) as any;
    const rawContent = data?.choices?.[0]?.message?.content;

    if (!rawContent || typeof rawContent !== "string") {
      console.log("[generate] Kimi response missing content");
      throw new Error("Kimi response missing content");
    }

    let parsed: any;

    try {
      parsed = JSON.parse(rawContent);
    } catch (error) {
      console.log("[generate] Kimi response invalid JSON");
      throw new Error("Failed to parse Kimi JSON response");
    }

    if (!Array.isArray(parsed.files) || typeof parsed.dockerfile !== "string") {
      console.log("[generate] Kimi response missing required fields", { hasFiles: Array.isArray(parsed?.files), hasDockerfile: typeof parsed?.dockerfile });
      throw new Error("Kimi response missing required fields");
    }

    const files: GeneratedSiteFile[] = parsed.files.map((file: any) => ({
      path: String(file.path),
      content: String(file.content ?? ""),
    }));

    const spec: GeneratedSiteSpec = {
      files,
      dockerfile: parsed.dockerfile,
    };

    if (parsed.startCommand) {
      spec.startCommand = String(parsed.startCommand);
    }

    console.log("[generate] Kimi request done", { fileCount: files.length });
    return spec;
}

