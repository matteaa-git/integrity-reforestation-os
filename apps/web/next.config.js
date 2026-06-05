// Service-worker wrapper for offline support. In development we still want
// fast iteration, so the SW only registers in production builds.
const withSerwist = require("@serwist/next").default({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  cacheOnNavigation: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@igrowth/shared-types"],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Surface the commit sha + build time so the in-app diagnostic page can
  // tell us which version is actually running on a given device.
  env: {
    NEXT_PUBLIC_BUILD_SHA:  process.env.VERCEL_GIT_COMMIT_SHA  ?? "local",
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
};

module.exports = withSerwist(nextConfig);
