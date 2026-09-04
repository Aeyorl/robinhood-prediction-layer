import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pl/ui", "@pl/types", "@pl/config", "@pl/chain-config", "@pl/sdk"],
  // The E2E suite and local dev hit the dev server via 127.0.0.1 (Next binds
  // localhost). Next 16 blocks cross-origin dev resources by default, which
  // breaks the HMR client and stalls hydration.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
