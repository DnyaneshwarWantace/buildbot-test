const CLOUDFLARE_CRAWL_POLL_DELAY_MS = 5_000;
const CLOUDFLARE_CRAWL_MAX_ATTEMPTS = 24; // ~2 minutes max

export async function crawlWithCloudflareHtml(url: string): Promise<string | null> {
  const accountId = process.env.CF_ACCOUNT_ID;
  const apiToken = process.env.CF_API_TOKEN;

  if (!accountId || !apiToken) {
    console.log("[cloudflareCrawl] env vars missing, skipping fallback");
    return null;
  }

  console.log("[cloudflareCrawl] crawl start", url);

  const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/crawl`;

  const createResponse = await fetch(base, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url,
      limit: 20,
      depth: 3,
      formats: ["html"],
      render: true,
    }),
  });

  if (!createResponse.ok) {
    const text = await createResponse.text().catch(() => "");
    console.log("[cloudflareCrawl] create failed", {
      status: createResponse.status,
      statusText: createResponse.statusText,
      text,
    });
    return null;
  }

  const createJson = (await createResponse.json().catch(() => null)) as any;
  const jobId = createJson?.result;

  if (!jobId || typeof jobId !== "string") {
    console.log("[cloudflareCrawl] missing job id");
    return null;
  }

  let attempt = 0;
  let records: any[] | null = null;

  while (attempt < CLOUDFLARE_CRAWL_MAX_ATTEMPTS) {
    attempt += 1;

    const statusResponse = await fetch(`${base}/${jobId}?limit=50`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    });

    if (!statusResponse.ok) {
      const text = await statusResponse.text().catch(() => "");
      console.log("[cloudflareCrawl] status failed", {
        status: statusResponse.status,
        statusText: statusResponse.statusText,
        text,
      });
      return null;
    }

    const statusJson = (await statusResponse.json().catch(() => null)) as any;
    const result = statusJson?.result;
    const jobStatus = result?.status;

    if (jobStatus && jobStatus !== "running") {
      if (jobStatus !== "completed") {
        console.log("[cloudflareCrawl] ended without completion", {
          status: jobStatus,
        });
        return null;
      }

      records = Array.isArray(result?.records) ? result.records : [];
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, CLOUDFLARE_CRAWL_POLL_DELAY_MS));
  }

  if (!records || records.length === 0) {
    console.log("[cloudflareCrawl] no records");
    return null;
  }

  const completedRecords = records.filter((r) => r && r.status === "completed");

  if (completedRecords.length === 0) {
    console.log("[cloudflareCrawl] no completed records");
    return null;
  }

  const htmlParts: string[] = [];

  for (const record of completedRecords) {
    const html = typeof record?.html === "string" ? record.html : "";
    if (html) {
      htmlParts.push(html);
    }
  }

  if (!htmlParts.length) {
    console.log("[cloudflareCrawl] records had no html");
    return null;
  }

  const combinedHtml = htmlParts.join("\n\n");
  console.log("[cloudflareCrawl] done", url, "combined html length:", combinedHtml.length);

  return combinedHtml;
}

