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

function buildStructureFromHtml(html: string, baseUrl: string): string {
    const $ = cheerio.load(html);
    const body = $("body").get(0);
    if (!body) return "";

    const structure = (body.children ?? []).map((child: any) => serializeNode(child, $, baseUrl)).join("");
    return structure;
}

export async function scrapeSite(url: string): Promise<StrippedSite> {

  let html: string | null = null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SCRAPE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    html = await response.text();
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      console.log("[scrape] timeout", url);
    } else {
      console.log("[scrape] fetch error", url, err instanceof Error ? err.message : String(err));
    }
  }

  if (html) {
    const structure = buildStructureFromHtml(html, url);
    if (structure) {
      console.log("[scrape] done (direct)", url, "structure length:", structure.length);
      return { url, structure };
    }
    console.log("[scrape] direct scrape returned empty structure, trying Cloudflare", url);
  } else {
    console.log("[scrape] direct scrape failed, trying Cloudflare", url);
  }

  const cloudflareHtml = await crawlWithCloudflareHtml(url);

  if (cloudflareHtml) {
    const structure = buildStructureFromHtml(cloudflareHtml, url);
    if (structure) {
      console.log("[scrape] done (Cloudflare fallback)", url, "structure length:", structure.length);
      return { url, structure };
    }
  }

  throw new Error(`Scrape failed for ${url}: no content from direct fetch or Cloudflare crawl`);
  
}
