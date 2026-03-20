"use client";

import { type FormEvent, type KeyboardEvent, type ChangeEvent } from "react";

export type FormValues = {
  subdomain: string;
  companyName: string;
  companyWebsite: string;
  clientRequirements: string;
};

type Props = {
  values: FormValues;
  errors: Partial<Record<keyof FormValues, string>>;
  onChange: (field: keyof FormValues) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSubmit: (e: FormEvent) => void;
  isDisabled: boolean;
  buttonLabel: string;
  competitorWebsites: string[];
  competitorInput: string;
  onCompetitorInputChange: (val: string) => void;
  onCompetitorKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  onRemoveCompetitor: (url: string) => void;
  competitorError: string | null;
};

const inputClass =
  "w-full rounded-lg border border-[#D1D5DB] px-3.5 py-2.5 text-sm text-[#111827] outline-none focus:border-[#BF4646] focus:ring-2 focus:ring-[#BF4646]/20 bg-white";

const labelClass = "block text-sm font-medium text-[#374151] mb-1.5";

export default function CreateForm({
  values,
  errors,
  onChange,
  onSubmit,
  isDisabled,
  buttonLabel,
  competitorWebsites,
  competitorInput,
  onCompetitorInputChange,
  onCompetitorKeyDown,
  onRemoveCompetitor,
  competitorError,
}: Props) {
  return (
    <div className="w-full rounded-2xl bg-white shadow-[0_4px_24px_rgba(0,0,0,0.08)] p-7">
      <h1 className="mb-6 text-xl font-semibold text-[#1F2933]">Create project</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1 min-w-0">
            <label className={labelClass}>Subdomain *</label>
            <input
              type="text"
              value={values.subdomain}
              onChange={onChange("subdomain")}
              className={inputClass}
              placeholder="my-project"
            />
            {errors.subdomain && <p className="mt-1 text-xs text-[#B91C1C]">{errors.subdomain}</p>}
          </div>
          <div className="flex-1 min-w-0">
            <label className={labelClass}>Company name</label>
            <input
              type="text"
              value={values.companyName}
              onChange={onChange("companyName")}
              className={inputClass}
              placeholder="Acme Inc."
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Company website *</label>
          <input
            type="url"
            value={values.companyWebsite}
            onChange={onChange("companyWebsite")}
            className={inputClass}
            placeholder="https://example.com"
          />
          {errors.companyWebsite && <p className="mt-1 text-xs text-[#B91C1C]">{errors.companyWebsite}</p>}
        </div>

        <div>
          <label className={labelClass}>Competitor websites (max 3)</label>
          <input
            type="url"
            value={competitorInput}
            onChange={(e) => onCompetitorInputChange(e.target.value)}
            onKeyDown={onCompetitorKeyDown}
            className={inputClass}
            placeholder="Paste URL and press Enter"
            disabled={competitorWebsites.length >= 3}
          />
          {competitorError && <p className="mt-1 text-xs text-[#B91C1C]">{competitorError}</p>}
          {competitorWebsites.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {competitorWebsites.map((url) => (
                <span
                  key={url}
                  className="inline-flex items-center gap-1 rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-xs text-[#374151]"
                >
                  <span className="max-w-[160px] truncate">{url}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveCompetitor(url)}
                    className="text-[#9CA3AF] hover:text-[#374151] transition-colors"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className={labelClass}>Client requirements *</label>
          <textarea
            rows={5}
            value={values.clientRequirements}
            onChange={onChange("clientRequirements")}
            className={`${inputClass} resize-none`}
            placeholder="Describe what the client needs..."
          />
          {errors.clientRequirements && <p className="mt-1 text-xs text-[#B91C1C]">{errors.clientRequirements}</p>}
        </div>

        <button
          type="submit"
          disabled={isDisabled}
          className="w-full rounded-lg bg-[#BF4646] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#a83c3c] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {buttonLabel}
        </button>
      </form>
    </div>
  );
}
