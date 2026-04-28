/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@igrowth/shared-types"],
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
