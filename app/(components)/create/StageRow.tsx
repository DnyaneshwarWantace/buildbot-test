"use client";

export type StageStatus = "idle" | "running" | "done" | "error";

type Props = {
  label: string;
  status: StageStatus;
  elapsed: number | null;
  error?: string | null;
};

function StatusIcon({ status }: { status: StageStatus }) {
  if (status === "idle") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#D1D5DB]" />
    );
  }
  if (status === "running") {
    return (
      <span className="flex h-5 w-5 items-center justify-center">
        <span className="h-4 w-4 rounded-full border-2 border-[#BF4646] border-t-transparent animate-spin" />
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#059669] text-white text-[10px] font-bold">
        ✓
      </span>
    );
  }
  // error
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#B91C1C] text-white text-[10px] font-bold">
      ✕
    </span>
  );
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

export default function StageRow({ label, status, elapsed, error }: Props) {
  return (
    <div>
      <div className="flex items-center gap-3">
        <StatusIcon status={status} />
        <div className="flex flex-1 items-center justify-between">
          <span
            className={`text-sm font-medium ${
              status === "idle"
                ? "text-[#9CA3AF]"
                : status === "error"
                ? "text-[#B91C1C]"
                : "text-[#1F2933]"
            }`}
          >
            {label}
          </span>
          {elapsed !== null && status !== "idle" && (
            <span
              className={`text-xs tabular-nums ${
                status === "running" ? "text-[#6B7280]" : status === "done" ? "text-[#059669]" : "text-[#B91C1C]"
              }`}
            >
              {formatElapsed(elapsed)}
            </span>
          )}
        </div>
      </div>
      {error && (
        <p className="ml-8 mt-1 text-xs text-[#B91C1C] leading-relaxed">{error}</p>
      )}
    </div>
  );
}
