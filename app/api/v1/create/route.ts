import { NextResponse } from "next/server";
import { createRequestSchema, type CreateRequest } from "./validation";
import { scrapeSite, type StrippedSite } from "./scrape";
import { generateSiteWithKimi, type GeneratedSiteSpec } from "./generate";
import { deployProject, type DeployResult } from "./deploy";

export async function POST(request: Request) {

    const startedAt = Date.now();
    console.log("[create] POST /api/v1/create start");

    const json = await request.json().catch(() => null);

    const parsed = createRequestSchema.safeParse(json);

    if (!parsed.success) {
        console.log("[create] validation failed", parsed.error.issues);
        return NextResponse.json(
            {
                message: "Validation failed",
                issues: parsed.error.issues,
            },
            { status: 400 },
        );
    }

    const data: CreateRequest = parsed.data;
    console.log("[create] validated", { subdomain: data.subdomain, companyWebsite: data.companyWebsite });

    const urls: string[] = [ data.companyWebsite, ...(data.competitorWebsites ?? []),];

    console.log("[create] scrape start", { urlCount: urls.length, urls });
    const siteResults = await Promise.all(
        urls.map(
        async (url): Promise<StrippedSite | { url: string; error: string }> => {
            try {
                return await scrapeSite(url);
            } catch (error) {
                return {
                    url,
                    error: error instanceof Error ? error.message : "Failed to scrape site",
                };
            }
        },
        ),
    );

    const scrapedSites: StrippedSite[] = siteResults.filter(
        (result): result is StrippedSite =>
        "structure" in result && typeof result.structure === "string",
    );
    const scrapeOk = scrapedSites.length;
    const scrapeFail = siteResults.length - scrapeOk;
    console.log("[create] scrape done", { ok: scrapeOk, fail: scrapeFail, total: siteResults.length });

    let generated: GeneratedSiteSpec | null = null;
    let generationError: string | null = null;

    console.log("[create] generate start");
    try {
        generated = await generateSiteWithKimi({
            request: data,
            sites: scrapedSites,
        });
        console.log("[create] generate done", { fileCount: generated?.files?.length ?? 0 });
    } catch (error) {
        generationError = error instanceof Error ? error.message : "Generation failed";
        console.error("[create] generate failed", generationError);
    }

    let deployResult: DeployResult | null = null;
    let deployError: string | null = null;

    if (generated) {
        console.log("[create] deploy start", data.subdomain);
        try {
            deployResult = await deployProject(data.subdomain, generated);
            console.log("[create] deploy done", deployResult?.liveUrl);
        } catch (error) {
            deployError =
                error instanceof Error ? error.message : "Deploy failed";
            console.error("[create] deploy failed", error instanceof Error ? error.message : error);
        }
    } else {
        console.log("[create] deploy skipped (no generated spec)");
    }

    const totalSeconds = (Date.now() - startedAt) / 1000;
    const usage = generated?.usage ?? null;

    const deployPayload = {
        liveUrl: deployResult?.liveUrl ?? null,
        port: deployResult?.port ?? null,
        nginxConfigured: deployResult?.nginxConfigured ?? false,
        generationError: generationError ?? null,
        deployError: deployError ?? null,
    };

    const responseBody = {
        success: true,
        status: 200,
        message: "Project created",
        data: {
            subdomain: data.subdomain,
            companyWebsite: data.companyWebsite,
            clientRequirements: data.clientRequirements,
        },
        deploy: deployPayload,
        stats: usage
            ? {
                  prompt_tokens: usage.prompt_tokens,
                  completion_tokens: usage.completion_tokens,
                  total_tokens: usage.total_tokens,
              }
            : null,
        time: {
            total_time: totalSeconds,
        },
    };

    console.log("[create] POST /api/v1/create end", {
        deploy: !!deployResult,
        deployError: deployError ?? null,
        totalSeconds,
        stats: usage ?? null,
    });

    return NextResponse.json(responseBody, { status: 200 });
}
