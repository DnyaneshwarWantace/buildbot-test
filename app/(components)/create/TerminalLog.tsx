"use client";

import { useEffect, useRef } from "react";

type Props = {
  logs: string[];
  isRunning: boolean;
};

function colorize(line: string) {
  if (line.includes("✓") || line.includes("live at") || line.includes("Done."))
    return "text-[#4ade80]";
  if (line.includes("✕") || line.includes("failed") || line.includes("Failed"))
    return "text-[#f87171]";
  if (line.includes("Sending to Kimi") || line.includes("AI generation") || line.includes("Tokens:"))
    return "text-[#a78bfa]";
  if (line.includes("Scraping") || line.includes("Scraped"))
    return "text-[#60a5fa]";
  if (line.includes("Deploying") || line.includes("Writing") || line.includes("Nginx"))
    return "text-[#fbbf24]";
  if (line.startsWith("  "))
    return "text-[#94a3b8]";
  return "text-[#e2e8f0]";
}

export default function TerminalLog({ logs, isRunning }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden border border-[#1e293b]">
      {/* Terminal bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-[#1e293b] shrink-0">
        <span className="h-2.5 w-2.5 rounded-full bg-[#f87171]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#fbbf24]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#4ade80]" />
        <span className="ml-2 text-[11px] text-[#64748b] font-mono">build log</span>
        {isRunning && (
          <span className="ml-auto flex items-center gap-1.5 text-[11px] text-[#4ade80] font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80] animate-pulse" />
            running
          </span>
        )}
      </div>

      {/* Log body */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto bg-[#0f172a] p-3 font-mono text-[11px] leading-5 min-h-0">
        {logs.length === 0 ? (
          <span className="text-[#475569]">Waiting for logs...</span>
        ) : (
          logs.map((line, i) => (
            <div key={i} className={colorize(line)}>
              {line}
            </div>
          ))
        )}
        {isRunning && (
          <div className="text-[#4ade80] mt-1">
            <span className="animate-pulse">█</span>
          </div>
        )}
      </div>
    </div>
  );
}
