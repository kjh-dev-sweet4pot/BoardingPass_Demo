import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core", "pdf-parse", "@napi-rs/canvas"],
};

export default nextConfig;
