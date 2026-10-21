/** @type {import('next').NextConfig} */
const backend = process.env.BACKEND_URL || "http://127.0.0.1:8000";

const nextConfig = {
  reactStrictMode: true,
  // Optional separate build folder, so a preview or verification build never overwrites a running `next start`.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Analysis with AI enabled can take longer than the default 30 s proxy timeout.
  experimental: { proxyTimeout: 120_000 },
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
};

export default nextConfig;
