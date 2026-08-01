import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.exe.xyz", "*.edtechathon.com"],
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
