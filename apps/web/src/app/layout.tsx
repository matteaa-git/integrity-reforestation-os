import type { Metadata, Viewport } from "next";
import "./globals.css";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";

export const metadata: Metadata = {
  title: "Integrity Social Media Machine",
  description: "Content production and paid-growth operating system for Integrity Reforestation",
  // Lets the app be installed to the iOS home screen with full-screen chrome
  // hidden, which matters for field crews on iPads/phones.
  appleWebApp: {
    capable: true,
    title: "Integrity",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/integrity-logo.png",
  },
};

// viewport-fit=cover lets us read env(safe-area-inset-top) etc. on iPad
// Safari so fullscreen modals (e.g. the block map viewer) can avoid the
// status bar / dynamic browser chrome.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0d0d0d",
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
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
