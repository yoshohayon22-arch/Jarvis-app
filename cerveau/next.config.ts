import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3", "mammoth", "unpdf", "sharp"],
  devIndicators: false,
  experimental: { serverActions: { bodySizeLimit: "30mb" } },
};

export default nextConfig;
