import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@pl/ui", "@pl/types", "@pl/config", "@pl/chain-config", "@pl/sdk"],
};

export default nextConfig;
