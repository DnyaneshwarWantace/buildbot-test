"use client";

import { useEffect, useState } from "react";

type Site = {
  subdomain: string;
  url: string;
  companyWebsite: string | null;
  createdAt: number;
  scrapeTime: number | null;
  generateTime: number | null;
  deployTime: number | null;
  totalTime: number | null;
  tokens: { prompt: number; completion: number; total: number } | null;
  sizeBytes: number;
  sizeFormatted: string;
  generationError: string | null;
  deployError: string | null;
};

function fmt(s: number | null): string {
  if (s === null) return "—";
  if (s < 60) return `${s.toFixed(1)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

function fmtNum(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function formatDate(ms: number): { date: string; time: string; ago: string } {
  const d = new Date(ms);
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const ago = m < 1 ? "just now" : m < 60 ? `${m}m ago` : h < 24 ? `${h}h ago` : `${days}d ago`;
  return {
    date: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    ago,
  };
}

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className={`inline-block h-2 w-2 rounded-full ${ok ? "bg-[#059669]" : "bg-[#F59E0B]"}`} />
  );
}

export default function RecentSites({ refreshTrigger }: { refreshTrigger: number }) {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/v1/sites`)
      .then((r) => r.json())
      .then((data) => setSites(data.sites ?? []))
      .catch(() => setSites([]))
      .finally(() => setLoading(false));
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3">
        <span className="h-3 w-3 rounded-full border-2 border-[#BF4646] border-t-transparent animate-spin" />
        <span className="text-xs text-[#9CA3AF]">Loading...</span>
      </div>
    );
  }

  if (sites.length === 0) {
    return <p className="text-xs text-[#9CA3AF] py-2">No sites deployed yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#F3F4F6]">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-[#F7F4EA] text-[#6B7280] uppercase tracking-wide">
            <th className="px-3 py-2 text-left font-semibold">Site</th>
            <th className="px-3 py-2 text-right font-semibold">Scrape</th>
            <th className="px-3 py-2 text-right font-semibold">AI Gen</th>
            <th className="px-3 py-2 text-right font-semibold">Deploy</th>
            <th className="px-3 py-2 text-right font-semibold">Total</th>
            <th className="px-3 py-2 text-right font-semibold">Tokens</th>
            <th className="px-3 py-2 text-right font-semibold">Size</th>
            <th className="px-3 py-2 text-right font-semibold">Created</th>
          </tr>
        </thead>
        <tbody>
          {sites.map((site, i) => {
            const hasError = !!(site.generationError || site.deployError);
            return (
              <tr
                key={site.subdomain}
                className={`border-t border-[#F3F4F6] hover:bg-[#FFF5F5] transition-colors ${i % 2 === 0 ? "bg-white" : "bg-[#FAFAFA]"}`}
              >
                {/* Site name + URL */}
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <StatusDot ok={!hasError} />
                    <a
                      href={site.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-[#1F2933] hover:text-[#BF4646] transition-colors"
                    >
                      {site.subdomain}
                    </a>
                  </div>
                  {site.companyWebsite && (
                    <div className="mt-0.5 text-[10px] text-[#9CA3AF] truncate max-w-[140px]">
                      {site.companyWebsite.replace(/^https?:\/\//, "")}
                    </div>
                  )}
                  {hasError && (
                    <div className="mt-0.5 text-[10px] text-[#F59E0B] truncate max-w-[160px]">
                      {site.generationError ?? site.deployError}
                    </div>
                  )}
                </td>

                {/* Scrape time */}
                <td className="px-3 py-2.5 text-right tabular-nums text-[#374151]">
                  {fmt(site.scrapeTime)}
                </td>

                {/* AI Gen time */}
                <td className="px-3 py-2.5 text-right tabular-nums">
                  <span className={site.generateTime && site.generateTime > 180 ? "text-[#F59E0B] font-medium" : "text-[#374151]"}>
                    {fmt(site.generateTime)}
                  </span>
                </td>

                {/* Deploy time */}
                <td className="px-3 py-2.5 text-right tabular-nums text-[#374151]">
                  {fmt(site.deployTime)}
                </td>

                {/* Total time */}
                <td className="px-3 py-2.5 text-right tabular-nums font-medium text-[#1F2933]">
                  {fmt(site.totalTime)}
                </td>

                {/* Tokens */}
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {site.tokens ? (
                    <div>
                      <span className="font-medium text-[#1F2933]">{fmtNum(site.tokens.total)}</span>
                      <div className="text-[10px] text-[#9CA3AF]">
                        {fmtNum(site.tokens.prompt)}↑ {fmtNum(site.tokens.completion)}↓
                      </div>
                    </div>
                  ) : (
                    <span className="text-[#9CA3AF]">—</span>
                  )}
                </td>

                {/* Size */}
                <td className="px-3 py-2.5 text-right tabular-nums">
                  <span className={site.sizeBytes > 500 * 1024 ? "text-[#F59E0B] font-medium" : "text-[#374151]"}>
                    {site.sizeFormatted}
                  </span>
                </td>

                {/* Created */}
                <td className="px-3 py-2.5 text-right">
                  {(() => { const f = formatDate(site.createdAt); return (
                    <div>
                      <div className="text-[#374151] font-medium">{f.date}</div>
                      <div className="text-[10px] text-[#9CA3AF]">{f.time} · {f.ago}</div>
                    </div>
                  ); })()}
                </td>
              </tr>
            );
          })}
        </tbody>

        {/* Footer totals */}
        <tfoot>
          <tr className="border-t-2 border-[#E5E7EB] bg-[#F7F4EA] font-semibold text-[#374151]">
            <td className="px-3 py-2">{sites.length} sites</td>
            <td />
            <td />
            <td />
            <td />
            <td className="px-3 py-2 text-right tabular-nums">
              {fmtNum(sites.reduce((s, x) => s + (x.tokens?.total ?? 0), 0))} total
            </td>
            <td className="px-3 py-2 text-right tabular-nums">
              {(sites.reduce((s, x) => s + x.sizeBytes, 0) / (1024 * 1024)).toFixed(2)} MB
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
