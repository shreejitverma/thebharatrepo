import type { NextConfig } from "next";
import { loadContentUncached } from "./src/lib/content/load";
import { aliasRedirects } from "./src/lib/content/redirects";

/** Pagefind names its index, filter and fragment chunks by content hash, so a URL never changes meaning. */
const immutable = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Old URLs of merged entities, generated from each surviving entity's `aliases`.
  async redirects() {
    return aliasRedirects(loadContentUncached().aliases);
  },
  async headers() {
    return ["/pagefind/fragment/:file*", "/pagefind/index/:file*", "/pagefind/filter/:file*"].map((source) => ({ source, headers: immutable }));
  },
};

export default nextConfig;
