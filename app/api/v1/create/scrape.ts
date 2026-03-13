import * as cheerio from "cheerio";

export type StrippedSite = {
  url: string;
  structure: string;
};

function resolveUrl(baseUrl: string, relative: string): string {
  try {
    return new URL(relative, baseUrl).toString();
  } catch {
    return relative;
  }
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function serializeNode(node: any, $: cheerio.CheerioAPI, baseUrl: string): string {
  if (node.type === "text") {
    const normalized = normalizeText(node.data ?? "");
    return normalized;
  }

  if (node.type === "tag") {
    const tagName = node.tagName?.toLowerCase();
    if (tagName === "script" || tagName === "style" || tagName === "noscript") {
      return "";
    }

    if (tagName === "img") {
      const src = $(node).attr("src") || $(node).attr("srcset");
      
      if (!src) { return "" }
      
      const primarySrc = src.split(" ")[0];
      const resolved = resolveUrl(baseUrl, primarySrc);
      const url = normalizeText(resolved);
      
      if (!url) { return "" }
      
      return `{${url}}`;
    }

    const children = (node.children ?? []).map((child: any) => serializeNode(child, $, baseUrl)).join("");

    if (tagName === "a" || tagName === "video" || tagName === "iframe" || tagName === "source") {
      const hrefRaw = $(node).attr("href") || $(node).attr("src");
      const href = hrefRaw ? resolveUrl(baseUrl, hrefRaw) : "";
      const linkPart = href ? normalizeText(href) : "";
      const contentWithLink = [children, linkPart].filter(Boolean).join(" ");
      const normalized = normalizeText(contentWithLink);
      if (!normalized) {
        return "";
      }
      return `{${normalized}}`;
    }

    const content = normalizeText(children);
    if (!content) { return "" }

    return `{${content}}`;
  }

  return "";
}

const SCRAPE_FETCH_TIMEOUT_MS = 60 * 1000; // 60 seconds per URL

export async function scrapeSite(url: string): Promise<StrippedSite> {
  console.log("[scrape] start", url);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SCRAPE_FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      console.log("[scrape] timeout", url);
      throw new Error(`Scrape timed out: ${url}`);
    }
    throw err;
  }
  clearTimeout(timeoutId);

  const html = await response.text();

  const $ = cheerio.load(html);

  const body = $("body").get(0);

  const structure = body ? (body.children ?? []).map((child: any) => serializeNode(child, $, url)).join("") : "";

  console.log("[scrape] done", url, "structure length:", structure.length);
  return { url, structure };
}

