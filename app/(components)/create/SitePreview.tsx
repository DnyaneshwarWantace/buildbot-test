"use client";

import { useEffect, useState } from "react";

type Files = { html: string | null; css: string | null; js: string | null };
type Tab = "preview" | "html" | "css" | "js";

type Props = {
  subdomain: string;
  liveUrl: string;
};

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden border border-[#1e293b]">
      <div className="flex items-center justify-between px-3 py-2 bg-[#1e293b] shrink-0">
        <span className="text-[11px] text-[#64748b] font-mono">{lang}</span>
        <button
          onClick={copy}
          className="text-[11px] text-[#64748b] hover:text-[#e2e8f0] transition-colors font-mono"
        >
          {copied ? "copied!" : "copy"}
        </button>
      </div>
      <div className="flex-1 overflow-auto bg-[#0f172a] p-3 min-h-0">
        <pre className="text-[11px] font-mono leading-5 text-[#e2e8f0] whitespace-pre-wrap break-words">
          {code}
        </pre>
      </div>
    </div>
  );
}

export default function SitePreview({ subdomain, liveUrl }: Props) {
  const [tab, setTab] = useState<Tab>("preview");
  const [files, setFiles] = useState<Files | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/v1/sites/${subdomain}/files`)
      .then((r) => r.json())
      .then((d) => setFiles({ html: d.html ?? null, css: d.css ?? null, js: d.js ?? null }))
      .catch(() => setFiles(null))
      .finally(() => setLoading(false));
  }, [subdomain]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "preview", label: "Preview" },
    { key: "html", label: "HTML" },
    { key: "css", label: "CSS" },
    { key: "js", label: "JS" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-1 mb-2 shrink-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              tab === t.key
                ? "bg-[#1e293b] text-white"
                : "text-[#6B7280] hover:text-[#374151] hover:bg-[#F3F4F6]"
            }`}
          >
            {t.label}
          </button>
        ))}
        <a
          href={liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 bg-[#059669] text-white text-xs font-medium hover:bg-[#047857] transition-colors"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
          </svg>
          Open live
        </a>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {tab === "preview" && (
          <iframe
            src={liveUrl}
            className="w-full h-full rounded-xl border border-[#E5E7EB]"
            title={`Preview of ${subdomain}`}
          />
        )}
        {tab !== "preview" && loading && (
          <div className="flex items-center justify-center h-full text-sm text-[#9CA3AF]">
            Loading files...
          </div>
        )}
        {tab === "html" && files && <CodeBlock code={files.html ?? "Not found"} lang="index.html" />}
        {tab === "css" && files && <CodeBlock code={files.css ?? "Not found"} lang="styles.css" />}
        {tab === "js" && files && <CodeBlock code={files.js ?? "Not found"} lang="script.js" />}
      </div>
    </div>
  );
}
