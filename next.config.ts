import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [{ source: '/data', destination: '/data/index.html' }];
  },
};

export default nextConfig;
