/// <reference lib="webworker" />

import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, CacheFirst, ExpirationPlugin, CacheableResponsePlugin } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // PDFs (block maps, quality forms, etc) — cache-first, large but very
    // static once uploaded. Worth offline because each crew opens the same
    // few block maps repeatedly.
    {
      matcher: ({ request, url }) =>
        request.destination === "document" ? false :
        /\.pdf(\?.*)?$/i.test(url.pathname),
      handler: new CacheFirst({
        cacheName: "pdfs",
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 90 * 24 * 60 * 60 }),
        ],
      }),
    },
    // The pdf.js worker is self-hosted under /pdf.worker.min.mjs — make sure
    // it stays cached even when offline so opening a map doesn't 404.
    {
      matcher: ({ url }) => url.pathname === "/pdf.worker.min.mjs",
      handler: new CacheFirst({
        cacheName: "pdfjs-worker",
        plugins: [new CacheableResponsePlugin({ statuses: [0, 200] })],
      }),
    },
    // Logo + other static images.
    {
      matcher: ({ request, url }) =>
        request.destination === "image"
        && (url.origin === self.location.origin),
      handler: new CacheFirst({
        cacheName: "images",
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({ maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 }),
        ],
      }),
    },
    // Everything else (Next chunks, fonts, etc) — defaults from @serwist/next.
    ...defaultCache,
  ],
});

serwist.addEventListeners();
