"use client";

import { useRouter } from "next/navigation";
import { ArrowUp, Mic, Plus } from "lucide-react";

export default function ComposerInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  
  const router = useRouter();
  const placeholder = "Start typing your idea to reality here . . .";

  return (
    <div className="flex w-full min-h-[72px] flex-col rounded-[24px] bg-[#fff] shadow-[0_4px_20px_rgba(0,0,0,0.08)]">
      <div className="flex flex-1 flex-col px-6 pt-6 pb-2">
  
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={1}
          className="min-h-[24px] w-full resize-none bg-transparent text-[18px] leading-6 text-[#333333] placeholder:text-[#666666] outline-none"
        />
        <div className="mt-6 flex items-center justify-between">
          
          <button type="button" aria-label="Add"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#333333] transition hover:bg-black/5 cursor-pointer"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
          </button>
          
          <div className="flex items-center gap-3">
          
            <span className="text-[15px] font-medium text-[#333333]">Chat</span>
          
            <button type="button" aria-label="Voice input"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-[#333333] transition hover:bg-black/5 cursor-pointer"
            >
              <Mic className="h-5 w-5" strokeWidth={2} />
            </button>
            
            <button
              type="button"
              aria-label="Send"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#BF4646] text-white transition hover:bg-[#BF4689] cursor-pointer"
              onClick={() => router.push("/create")}
            >
              <ArrowUp className="h-5 w-5 rotate-45" strokeWidth={2.5} />
            </button>
          
          </div>
        </div>
      </div>
    </div>
  );
}
