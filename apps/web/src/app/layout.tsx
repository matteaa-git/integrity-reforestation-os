import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Instagram Growth OS",
  description: "Content production and paid-growth operating system for Integrity Reforestation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
