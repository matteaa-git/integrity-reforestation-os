"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import MainContent from "./MainContent";

// Routes that render full-screen without the sidebar/nav chrome
const FULL_SCREEN_PATHS = [
  "/carousels/new",
  "/stories/new",
  "/reels/new",
  "/admin",
  "/login",
  "/auth",
  "/sign",
];

export default function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullScreen = FULL_SCREEN_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p + "?"));

  if (isFullScreen) {
    return <div className="w-full h-screen overflow-hidden">{children}</div>;
  }

  return (
    <>
      <Sidebar />
      <MainContent>{children}</MainContent>
    </>
  );
}
