import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";
import { assertPreviewNotDeployed } from "./src/lib/content/debates";
import { contentRoots, loadContentUncached } from "./src/lib/content/load";
import { aliasRedirects } from "./src/lib/content/redirects";

/** Pagefind names its index, filter and fragment chunks by content hash, and fonts sit in versioned directories, so a URL never changes meaning. */
const immutable = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }];

/**
 * Unpublished debate drafts (owner rule, see src/lib/content/debates.ts). Every page is prerendered, but the
 * content loader's file reads make the tracer copy the whole content tree into each server bundle, so drafts
 * are excluded from the traced files and never ship in a production deployment, even as unserved files.
 * Every content root is covered (CONTENT_ROOTS, for example the e2e fixture draft in a `build:e2e` build).
 * The schema check stays in content:validate; this only reads the `published` flag.
 */
function unpublishedDebateFiles(): string[] {
  if (process.env.DEBATES_PREVIEW === "1") return [];
  return contentRoots().flatMap((root) => {
    const dir = path.join(root, "debates");
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".yaml") && !/^published:\s*true\s*(#.*)?$/m.test(fs.readFileSync(path.join(dir, f), "utf8")))
      .map((f) => path.relative(process.cwd(), path.join(dir, f)).split(path.sep).join("/"));
  });
}

assertPreviewNotDeployed();

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Old URLs of merged entities, generated from each surviving entity's `aliases`.
  async redirects() {
    return aliasRedirects(loadContentUncached().aliases);
  },
  async headers() {
    // Font files live in a versioned directory (public/fonts/v1) and are never edited in place.
    return ["/pagefind/fragment/:file*", "/pagefind/index/:file*", "/pagefind/filter/:file*", "/fonts/:version/:file*"].map((source) => ({ source, headers: immutable }));
  },
  outputFileTracingExcludes: { "*": [...unpublishedDebateFiles(), "src/lib/content/__fixtures__/**", "e2e/**"] },
};

export default nextConfig;
