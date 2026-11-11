import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phones reach the backend through this app, so FastAPI can stay bound to 127.0.0.1.
  // `fallback` runs after app routes, so Better Auth's /api/auth/* is not forwarded to FastAPI.
  async rewrites() {
    return {
      beforeFiles: [],
      afterFiles: [],
      fallback: [{ source: "/api/:path*", destination: `${process.env.API_URL ?? "http://127.0.0.1:8000"}/:path*` }],
    };
  },
  experimental: {
    proxyTimeout: 10 * 60 * 1000, // CPU report generation can take minutes
    // proxy.ts buffers request bodies; uploads are up to 10 MB plus multipart overhead.
    proxyClientMaxBodySize: "12mb",
  },
  poweredByHeader: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
