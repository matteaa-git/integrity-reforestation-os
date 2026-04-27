"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import LinkedInComposer from "@/components/linkedin/LinkedInComposer";
import DraftsTab from "@/components/linkedin/DraftsTab";
import PerformanceTab from "@/components/linkedin/PerformanceTab";

const TABS = [
  { id: "compose",     label: "Compose",     icon: "✍" },
  { id: "drafts",      label: "Drafts",       icon: "◫" },
  { id: "scheduled",   label: "Scheduled",    icon: "▦" },
  { id: "performance", label: "Performance",  icon: "△" },
] as const;

type TabId = typeof TABS[number]["id"];

function LinkedInStudioInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const activeTab = (searchParams.get("tab") as TabId) ?? "compose";

  const setTab = (tab: TabId) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.push(`/linkedin?${params.toString()}`);
  };

  return (
    <div className="flex flex-col h-screen bg-[#f3f2ef]">
      {/* ── Top bar ── */}
      <div className="shrink-0 bg-white border-b border-border px-5 py-0 flex items-stretch">
        {/* Brand */}
        <div className="flex items-center gap-2.5 pr-6 border-r border-border mr-2">
          <div className="w-7 h-7 rounded bg-[#0a66c2] flex items-center justify-center">
            <span className="text-white text-[11px] font-black">in</span>
          </div>
          <div>
            <div className="text-[12px] font-bold text-text-primary leading-tight">LinkedIn Studio</div>
            <div className="text-[9px] text-text-tertiary">Integrity Reforestation</div>
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
                  ? "border-[#0a66c2] text-[#0a66c2]"
                  : "border-transparent text-text-tertiary hover:text-text-secondary hover:border-border"
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
            <div className="text-[11px] font-semibold text-text-primary leading-tight">Integrity Reforestation</div>
            <div className="text-[9px] text-text-tertiary">Tree Planting Services · 1st</div>
          </div>
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {activeTab === "compose" && <LinkedInComposer />}
        {activeTab === "drafts" && (
          <div className="flex-1 overflow-y-auto">
            <DraftsTab />
          </div>
        )}
        {activeTab === "scheduled" && (
          <div className="flex-1 overflow-y-auto p-6 max-w-4xl">
            <div className="text-center py-16 text-text-tertiary">
              <div className="text-3xl mb-3 opacity-30">▦</div>
              <div className="text-sm font-medium">No scheduled posts yet</div>
              <div className="text-[11px] mt-1">Schedule posts from the Compose tab.</div>
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

export default function LinkedInStudioPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="w-7 h-7 border-2 border-[#0a66c2]/30 border-t-[#0a66c2] rounded-full animate-spin" />
      </div>
    }>
      <LinkedInStudioInner />
    </Suspense>
  );
}
