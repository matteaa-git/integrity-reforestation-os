"use client";

import { usePathname } from "next/navigation";

export default function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  return (
    <main className={`flex-1 ${isAdmin ? "overflow-hidden" : "overflow-y-auto"}`}>
      {children}
    </main>
  );
}
