"use client";

import HookBankPanel from "@/components/hook-bank/HookBankPanel";

export default function HooksPage() {
  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Page header */}
      <div className="shrink-0 px-6 py-4 bg-[#0e0e1a] border-b border-white/5 flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-bold text-white">Hook Bank</h1>
          <p className="text-[10px] text-white/35 mt-0.5">
            Searchable hook intelligence database · Integrity Reforestation
          </p>
        </div>
        <div className="flex items-center gap-2 text-[9px] text-white/25 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </div>
      </div>

      {/* Full-height bank panel */}
      <div className="flex-1 overflow-hidden">
        <HookBankPanel />
      </div>
    </div>
  );
}
