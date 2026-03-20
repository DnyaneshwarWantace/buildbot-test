import * as cheerio from "cheerio";
import { crawlWithCloudflareHtml } from "./cloudflareCrawl";

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

const SCRAPE_FETCH_TIMEOUT_MS = 60 * 1000;
const SCRAPE_RETRY_DELAYS_MS = [3000, 8000]; // retry twice on 429/5xx

function buildStructureFromHtml(html: string, baseUrl: string): string {
  const $ = cheerio.load(html);
  const body = $("body").get(0);
  if (!body) return "";
  return (body.children ?? []).map((child: any) => serializeNode(child, $, baseUrl)).join("");
}

async function directFetch(url: string): Promise<string | null> {
  for (let attempt = 0; attempt <= SCRAPE_RETRY_DELAYS_MS.length; attempt++) {
    if (attempt > 0) {
      const delay = SCRAPE_RETRY_DELAYS_MS[attempt - 1];
      console.log(`[scrape] retry ${attempt} after ${delay}ms (rate limited)`, url);
      await new Promise((r) => setTimeout(r, delay));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SCRAPE_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" },
      });
      clearTimeout(timeoutId);

      // Rate limited — retry after delay
      if (response.status === 429) {
        console.log("[scrape] 429 rate limited", url);
        continue;
      }

      // Server errors — retry
      if (response.status >= 500) {
        console.log("[scrape] server error", response.status, url);
        continue;
      }

      // Auth/block errors — no point retrying, go straight to Cloudflare
      if (response.status === 403 || response.status === 401 || response.status === 406) {
        console.log("[scrape] blocked", response.status, url);
        return null;
      }

      return await response.text();
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        console.log("[scrape] timeout", url);
      } else {
        console.log("[scrape] fetch error", url, err instanceof Error ? err.message : String(err));
      }
      return null;
    }
  }

  console.log("[scrape] all retries exhausted", url);
  return null;
}

export async function scrapeSite(url: string): Promise<StrippedSite> {
  // Try direct fetch first
  const html = await directFetch(url);

  if (html) {
    const structure = buildStructureFromHtml(html, url);
    if (structure) {
      console.log("[scrape] done (direct)", url, "structure length:", structure.length);
      return { url, structure };
    }
    console.log("[scrape] direct fetch returned empty structure, trying Cloudflare", url);
  } else {
    console.log("[scrape] direct fetch failed, trying Cloudflare", url);
  }

  // Cloudflare fallback for JS-heavy or blocked sites
  const cloudflareHtml = await crawlWithCloudflareHtml(url);

  if (cloudflareHtml) {
    const structure = buildStructureFromHtml(cloudflareHtml, url);
    if (structure) {
      console.log("[scrape] done (Cloudflare fallback)", url, "structure length:", structure.length);
      return { url, structure };
    }
  }

  throw new Error(`Scrape failed for ${url}: blocked or no content returned`);
}
