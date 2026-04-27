import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Integrity Social Media Machine",
  description: "Content production and paid-growth operating system for Integrity Reforestation",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans:wght@400;700;900&family=Montserrat:wght@700;900&family=Anton&display=swap" rel="stylesheet" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
