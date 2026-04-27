"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_SECTIONS = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Growth Command", icon: "⌘" },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/assets", label: "Asset Library", icon: "◫" },
      { href: "/stories/new", label: "New Story", icon: "▣" },
      { href: "/reels/new", label: "New Reel", icon: "▶" },
      { href: "/carousels", label: "Carousels", icon: "⊞" },
      { href: "/hooks", label: "Hook Bank", icon: "⚡" },
    ],
  },
  {
    label: "Workflow",
    items: [
      { href: "/queue", label: "Approval Queue", icon: "☑" },
      { href: "/calendar", label: "Calendar", icon: "▦" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/intelligence", label: "Growth Flywheel", icon: "◎" },
      { href: "/intelligence?tab=radar", label: "Opportunity Radar", icon: "⊙" },
      { href: "/intelligence?tab=hook", label: "Hook Analyzer", icon: "⚗" },
      { href: "/intelligence?tab=portfolio", label: "Portfolio Mix", icon: "◑" },
      { href: "/intelligence?tab=instagram", label: "Instagram Account", icon: "◈" },
    ],
  },
  {
    label: "Narrative Engine",
    items: [
      { href: "/narrative", label: "Narrative Radar", icon: "◉" },
      { href: "/narrative?tab=opportunities", label: "Opportunity Engine", icon: "⬡" },
      { href: "/narrative?tab=builder", label: "Narrative Builder", icon: "◧" },
      { href: "/narrative?tab=threads", label: "Thread Studio", icon: "≡" },
      { href: "/narrative?tab=media", label: "Media Intelligence", icon: "▤" },
      { href: "/narrative?tab=map", label: "Forest Map", icon: "⬢" },
      { href: "/narrative?tab=warroom", label: "Content War Room", icon: "⊛" },
      { href: "/narrative?tab=multiply", label: "Cross-Platform", icon: "⊕" },
      { href: "/narrative?tab=planters", label: "Planter Stories", icon: "◍" },
    ],
  },
  {
    label: "X Studio",
    items: [
      { href: "/x-studio", label: "Post Composer", icon: "◧" },
      { href: "/x-studio?tab=thread", label: "Thread Builder", icon: "≡" },
      { href: "/x-studio?tab=drafts", label: "Drafts", icon: "◫" },
      { href: "/x-studio?tab=scheduled", label: "Scheduled", icon: "▦" },
      { href: "/x-studio?tab=performance", label: "Performance", icon: "△" },
      { href: "/x-studio/account", label: "Connect Account", icon: "⬡" },
    ],
  },
  {
    label: "YouTube Studio",
    items: [
      { href: "/youtube-studio",                    label: "Post Composer",  icon: "▶" },
      { href: "/youtube-studio?tab=drafts",          label: "Drafts",         icon: "◫" },
      { href: "/youtube-studio?tab=scheduled",       label: "Scheduled",      icon: "▦" },
      { href: "/youtube-studio?tab=performance",     label: "Performance",    icon: "△" },
    ],
  },
  {
    label: "LinkedIn Studio",
    items: [
      { href: "/linkedin",                    label: "Post Composer",  icon: "✍" },
      { href: "/linkedin?tab=drafts",         label: "Drafts",         icon: "◫" },
      { href: "/linkedin?tab=scheduled",      label: "Scheduled",      icon: "▦" },
      { href: "/linkedin?tab=performance",    label: "Performance",    icon: "△" },
      { href: "/linkedin/account",            label: "Connect Account", icon: "⬡" },
    ],
  },
  {
    label: "Pinterest Studio",
    items: [
      { href: "/pinterest",                   label: "Pin Composer",   icon: "📌" },
      { href: "/pinterest?tab=drafts",        label: "Drafts",         icon: "◫" },
      { href: "/pinterest?tab=scheduled",     label: "Scheduled",      icon: "▦" },
      { href: "/pinterest?tab=performance",   label: "Performance",    icon: "△" },
      { href: "/pinterest/account",           label: "Connect Account", icon: "⬡" },
    ],
  },
  {
    label: "Paid Growth",
    items: [
      { href: "/ad-lab", label: "Ad Lab", icon: "◈" },
      { href: "/performance", label: "Performance", icon: "△" },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/admin", label: "Admin Console", icon: "⚙" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  // Admin console owns its own full-screen layout
  if (pathname.startsWith("/admin")) return null;

  return (
    <aside className="w-56 bg-sidebar text-white flex flex-col shrink-0 h-screen">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-white/10">
        <Image
          src="/integrity-logo.png"
          alt="Integrity Reforestation"
          width={140}
          height={56}
          className="brightness-0 invert"
          priority
        />
        <div className="text-[10px] text-white/40 mt-1.5">Social Media Machine</div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-white/30 px-2 mb-1.5">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href.split("?")[0]) && !item.href.includes("?"));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[13px] transition-colors ${
                      isActive
                        ? "bg-sidebar-active text-white font-medium"
                        : "text-white/60 hover:bg-sidebar-hover hover:text-white/90"
                    }`}
                  >
                    <span className="text-xs w-4 text-center opacity-70">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/10 text-[10px] text-white/25">
        v0.1.0
      </div>
    </aside>
  );
}
