import type { NextConfig } from "next";
import { loadContentUncached } from "./src/lib/content/load";
import { aliasRedirects } from "./src/lib/content/redirects";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Old URLs of merged entities, generated from each surviving entity's `aliases`.
  async redirects() {
    return aliasRedirects(loadContentUncached().aliases);
  },
};

export default nextConfig;
