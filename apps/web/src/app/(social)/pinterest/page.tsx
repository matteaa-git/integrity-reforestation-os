"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import PinterestComposer from "@/components/pinterest/PinterestComposer";
import DraftsTab from "@/components/pinterest/DraftsTab";
import PerformanceTab from "@/components/pinterest/PerformanceTab";

const TABS = [
  { id: "compose",     label: "Compose",     icon: "📌" },
  { id: "drafts",      label: "Drafts",      icon: "◫" },
  { id: "scheduled",   label: "Scheduled",   icon: "▦" },
  { id: "performance", label: "Performance", icon: "△" },
] as const;

type TabId = typeof TABS[number]["id"];

function PinterestStudioInner() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const activeTab    = (searchParams.get("tab") as TabId) ?? "compose";

  const setTab = (tab: TabId) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`/pinterest?${params.toString()}`);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* ── Top bar ── */}
      <div className="shrink-0 bg-white border-b border-gray-200 px-5 py-0 flex items-stretch">
        {/* Brand */}
        <div className="flex items-center gap-2.5 pr-6 border-r border-gray-200 mr-2">
          <div className="w-7 h-7 rounded-lg bg-[#E60023] flex items-center justify-center shadow-sm">
            <span className="text-white text-[14px]">P</span>
          </div>
          <div>
            <div className="text-[12px] font-bold text-gray-900 leading-tight">Pinterest Studio</div>
            <div className="text-[9px] text-gray-400">Integrity Reforestation</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-stretch gap-0.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-3.5 text-[12px] font-semibold border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-[#E60023] text-[#E60023]"
                  : "border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200"
              }`}
            >
              <span className="text-[11px] opacity-70">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Profile chip */}
        <div className="flex items-center gap-2.5 pl-4">
          <div className="w-7 h-7 rounded-full bg-[#002a27] flex items-center justify-center text-white text-[10px] font-bold">
            IR
          </div>
          <div className="hidden sm:block">
            <div className="text-[11px] font-semibold text-gray-800 leading-tight">Integrity Reforestation</div>
            <div className="text-[9px] text-gray-400">Tree Planting · Conservation</div>
          </div>
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {activeTab === "compose" && <PinterestComposer />}
        {activeTab === "drafts" && (
          <div className="flex-1 overflow-y-auto">
            <DraftsTab />
          </div>
        )}
        {activeTab === "scheduled" && (
          <div className="flex-1 overflow-y-auto p-6 max-w-4xl">
            <div className="text-center py-16 text-gray-400">
              <div className="text-3xl mb-3 opacity-30">▦</div>
              <div className="text-[13px] font-medium">No scheduled pins yet</div>
              <div className="text-[11px] mt-1">Schedule pins from the Compose tab.</div>
            </div>
          </div>
        )}
        {activeTab === "performance" && (
          <div className="flex-1 overflow-y-auto">
            <PerformanceTab />
          </div>
        )}
      </div>
    </div>
  );
}

export default function PinterestStudioPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="w-7 h-7 border-2 border-[#E60023]/30 border-t-[#E60023] rounded-full animate-spin" />
      </div>
    }>
      <PinterestStudioInner />
    </Suspense>
  );
}
