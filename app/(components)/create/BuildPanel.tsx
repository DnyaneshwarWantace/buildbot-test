"use client";

import StageRow, { type StageStatus } from "./StageRow";
import TerminalLog from "./TerminalLog";
import SitePreview from "./SitePreview";

export type Stage = {
  key: string;
  label: string;
  status: StageStatus;
  startedAt: number | null;
  doneAt: number | null;
  error?: string | null;
};

export type BuildResult = {
  liveUrl: string | null;
  subdomain: string;
  stats: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null;
  total_time: number;
  generationError: string | null;
  deployError: string | null;
};

type Props = {
  isIdle: boolean;
  stages: Stage[];
  result: BuildResult | null;
  jobError: string | null;
  logs: string[];
  now: number;
  refreshTrigger: number;
};

function getElapsed(stage: Stage, now: number): number | null {
  if (!stage.startedAt) return null;
  return ((stage.doneAt ?? now) - stage.startedAt) / 1000;
}

function formatTime(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  return `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
}

function fmtNum(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col rounded-xl bg-[#F7F4EA] px-3 py-2">
      <span className="text-[10px] text-[#6B7280] font-medium uppercase tracking-wide">{label}</span>
      <span className="mt-0.5 text-sm font-semibold text-[#1F2933]">{value}</span>
    </div>
  );
}

export default function BuildPanel({ isIdle, stages, result, jobError, logs, now, refreshTrigger: _ }: Props) {
  const isRunning = !isIdle && !result && !jobError;
  const isDone = !!result || !!jobError;

  return (
    <div className="flex-1 min-w-0 flex flex-col gap-3 h-full">

      {/* Stage progress bar — always visible once started */}
      {!isIdle && (
        <div className="rounded-2xl bg-white shadow-[0_4px_24px_rgba(0,0,0,0.08)] p-4 shrink-0">
          <div className="flex items-center gap-6">
            {stages.map((stage) => (
              <StageRow
                key={stage.key}
                label={stage.label}
                status={stage.status}
                elapsed={getElapsed(stage, now)}
                error={stage.error}
              />
            ))}
          </div>
          {jobError && (
            <p className="mt-2 text-xs text-[#B91C1C]">Job failed: {jobError}</p>
          )}
        </div>
      )}

      {/* Main panel */}
      <div className="flex-1 min-h-0 rounded-2xl bg-white shadow-[0_4px_24px_rgba(0,0,0,0.08)] overflow-hidden flex flex-col">

        {/* Idle state */}
        {isIdle && (
          <div className="flex flex-col items-center justify-center h-full py-16 px-8 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F7F4EA]">
              <svg className="h-7 w-7 text-[#BF4646]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[#374151]">Submit the form to start building</p>
            <p className="mt-1 text-xs text-[#9CA3AF]">Live build log, preview and code will appear here</p>
            <div className="mt-6 flex flex-col gap-2 text-left w-full max-w-xs">
              {[
                { label: "Scrape", desc: "Fetches and parses website content" },
                { label: "AI Gen", desc: "Kimi rebuilds the site with HTML/CSS/JS" },
                { label: "Deploy", desc: "Files written + nginx configured live" },
              ].map((s, i) => (
                <div key={s.label} className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F3F4F6] text-[10px] font-semibold text-[#6B7280]">{i + 1}</span>
                  <div>
                    <span className="text-xs font-medium text-[#374151]">{s.label}</span>
                    <span className="text-xs text-[#9CA3AF]"> — {s.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Running — show terminal */}
        {isRunning && (
          <div className="flex-1 min-h-0 p-4">
            <TerminalLog logs={logs} isRunning={isRunning} />
          </div>
        )}

        {/* Done — show stats + preview + code */}
        {isDone && result && (
          <div className="flex flex-col h-full min-h-0">
            {/* Stats bar */}
            <div className="px-4 pt-4 pb-3 border-b border-[#F3F4F6] shrink-0">
              <div className="grid grid-cols-4 gap-2">
                <StatPill label="Total time" value={formatTime(result.total_time)} />
                {result.stats ? (
                  <>
                    <StatPill label="Total tokens" value={fmtNum(result.stats.total_tokens)} />
                    <StatPill label="Prompt" value={fmtNum(result.stats.prompt_tokens)} />
                    <StatPill label="Output" value={fmtNum(result.stats.completion_tokens)} />
                  </>
                ) : (
                  <div className="col-span-3 flex items-center pl-2 text-xs text-[#9CA3AF]">No token data</div>
                )}
              </div>
              {(result.generationError || result.deployError) && (
                <p className="mt-2 text-xs text-[#B91C1C]">{result.generationError ?? result.deployError}</p>
              )}
            </div>

            {/* Logs collapsible strip */}
            <details className="shrink-0 border-b border-[#F3F4F6]">
              <summary className="px-4 py-2 text-xs text-[#6B7280] cursor-pointer hover:text-[#374151] select-none">
                View build log ({logs.length} lines)
              </summary>
              <div className="px-4 pb-3 max-h-40">
                <TerminalLog logs={logs} isRunning={false} />
              </div>
            </details>

            {/* Preview / code — takes remaining space */}
            <div className="flex-1 min-h-0 p-4">
              {result.liveUrl ? (
                <SitePreview subdomain={result.subdomain} liveUrl={result.liveUrl} />
              ) : (
                <div className="flex items-center justify-center h-full text-sm text-[#9CA3AF]">
                  Site was not deployed — no preview available
                </div>
              )}
            </div>
          </div>
        )}

        {/* Failed with no result */}
        {isDone && !result && jobError && (
          <div className="flex-1 min-h-0 flex flex-col p-4 gap-3">
            <div className="rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 shrink-0">
              <p className="text-xs font-semibold text-[#B91C1C]">Job failed</p>
              <p className="text-xs text-[#B91C1C] mt-0.5">{jobError}</p>
            </div>
            <div className="flex-1 min-h-0">
              <TerminalLog logs={logs} isRunning={false} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
