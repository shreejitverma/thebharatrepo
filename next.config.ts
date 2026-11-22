import fs from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

/**
 * Unpublished debate drafts (owner rule, see src/lib/content/debates.ts). Every page is prerendered, but the
 * content loader's file reads make the tracer copy the whole content tree into each server bundle, so drafts
 * are excluded from the traced files and never ship in a production deployment, even as unserved files.
 * The schema check stays in content:validate; this only reads the `published` flag.
 */
function unpublishedDebateFiles(): string[] {
  if (process.env.DEBATES_PREVIEW === "1") return [];
  const dir = path.join(process.cwd(), "content", "debates");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".yaml") && !/^published:\s*true\s*(#.*)?$/m.test(fs.readFileSync(path.join(dir, f), "utf8")))
    .map((f) => `content/debates/${f}`);
}

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  outputFileTracingExcludes: { "*": [...unpublishedDebateFiles(), "src/lib/content/__fixtures__/**", "e2e/**"] },
};

export default nextConfig;
