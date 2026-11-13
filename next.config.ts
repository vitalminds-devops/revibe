import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static files in out/, loaded by the Tauri window; the Rust side does all server work.
  output: "export",
  poweredByHeader: false,
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
