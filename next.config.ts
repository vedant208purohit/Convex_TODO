import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/organizations/provision": [
      "./node_modules/convex/dist/cli.bundle.cjs",
      "./node_modules/convex/bin/main.js",
      "./node_modules/esbuild/**/*",
      "./node_modules/@esbuild/**/*",
      "./default-app-convex/**/*",
    ],
    "/api/organizations/retry": [
      "./node_modules/convex/dist/cli.bundle.cjs",
      "./node_modules/convex/bin/main.js",
      "./node_modules/esbuild/**/*",
      "./node_modules/@esbuild/**/*",
      "./default-app-convex/**/*",
    ],
  },
};

export default nextConfig;
