/**
 * Pagefind index, built by `npm run build` right after `next build` (part of the build script itself, not a
 * lifecycle hook, so no package manager setting can skip it).
 *
 * Reads the prerendered HTML that `next build` writes to .next/server/app, indexes every entity, article,
 * source, learning path and published debate page under its real route (Next serves /archive/event/x, not /archive/event/x.html), and
 * writes the browser index to public/pagefind. The Vercel Next.js builder collects public/ after the build
 * command exits (vercel.json pins that command to `npm run build`), and `next start` serves it, so the
 * index ships with the deployment without a static export.
 *
 * What is indexed, and with which filters, is declared on the pages themselves (data-pagefind-body and
 * SearchIndexMeta). The build fails if any expected page is missing, unmarked or fails to index, so a
 * stale or partial index can never ship silently.
 *
 * Owner rule, checked on the build output itself: outside a DEBATES_PREVIEW build the build also fails if any
 * unpublished debate has a prerendered page. It then records which debates the build loaded in
 * .next/debates-build.json (not served), so the e2e suite can confirm that its fixture draft was in the build
 * it is testing (npm run build:e2e) before it proves the draft is unreachable.
 */

import fs from 'node:fs';
import path from 'node:path';
import { contentRoots, loadContentUncached } from '../src/lib/content/load';
import { debateSearchHrefs, debatesPreview } from '../src/lib/content/debates';
import { entityHref, sourceHref } from '../src/lib/content/kaalchakra';
import { learningSearchHrefs } from '../src/lib/content/learning';

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, '.next', 'server', 'app');
const OUT_DIR = path.join(ROOT, 'public', 'pagefind');
const DEBATES_BUILD = path.join(ROOT, '.next', 'debates-build.json');

function fail(message: string): never {
  console.error(`build-search: ${message}`);
  process.exit(1);
}

function dirSize(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      const s = dirSize(p);
      files += s.files;
      bytes += s.bytes;
    } else {
      files++;
      bytes += fs.statSync(p).size;
    }
  }
  return { files, bytes };
}

// pagefind is ESM-only and this script runs as CommonJS under tsx, so load it with a dynamic import.
type PagefindModule = typeof import('pagefind');
let pagefind: PagefindModule | undefined;

async function main() {
  pagefind = await import('pagefind');
  if (!fs.existsSync(APP_DIR)) fail(`${path.relative(ROOT, APP_DIR)} not found; run next build first`);
  const g = loadContentUncached();
  if (g.errors.length) fail(`${g.errors.length} content problem(s); run npm run content:validate`);

  const preview = debatesPreview();
  if (!preview) {
    const debatesDir = path.join(APP_DIR, 'debates');
    const built = fs.existsSync(debatesDir) ? fs.readdirSync(debatesDir) : [];
    const leaked = g.debates.filter((d) => !d.published).flatMap((d) => built.filter((f) => f === d.slug || f.startsWith(`${d.slug}.`)).map((f) => `debates/${f} (${d.id})`));
    if (leaked.length) fail(`unpublished debate output in a public build, which must never ship:\n  ${leaked.join('\n  ')}`);
  }

  type PageType = 'entity' | 'article' | 'source' | 'learning' | 'debate';
  const expected = new Map<string, PageType>();
  for (const id of g.entities.keys()) expected.set(entityHref(id), 'entity');
  for (const a of g.articles) expected.set(`/${a.category}/${a.slug}`, 'article');
  for (const id of g.sources.keys()) expected.set(sourceHref(id), 'source');
  for (const href of learningSearchHrefs(g)) expected.set(href, 'learning');
  // Published debates only: a draft is never indexed, even when a DEBATES_PREVIEW build has rendered it.
  for (const href of debateSearchHrefs(g)) expected.set(href, 'debate');

  const { index, errors } = await pagefind.createIndex({ forceLanguage: 'en' });
  if (!index || errors.length) fail(`could not create the index: ${errors.join('; ')}`);

  const counts: Record<PageType, number> = { entity: 0, article: 0, source: 0, learning: 0, debate: 0 };
  const problems: string[] = [];
  for (const [url, type] of expected) {
    const file = path.join(APP_DIR, `${url.slice(1)}.html`);
    if (!fs.existsSync(file)) {
      problems.push(`${url}: no prerendered HTML at ${path.relative(ROOT, file)}`);
      continue;
    }
    const content = fs.readFileSync(file, 'utf8');
    if (!content.includes('data-pagefind-body')) {
      problems.push(`${url}: page has no data-pagefind-body`);
      continue;
    }
    const res = await index.addHTMLFile({ url, content });
    if (res.errors.length) problems.push(`${url}: ${res.errors.join('; ')}`);
    else if (!res.file.meta.title || !res.file.meta.kind) problems.push(`${url}: indexed without title or kind metadata`);
    else counts[type]++;
  }
  if (problems.length) {
    await pagefind.close();
    fail(`${problems.length} page(s) failed to index:\n  ${problems.slice(0, 30).join('\n  ')}${problems.length > 30 ? `\n  ...and ${problems.length - 30} more` : ''}`);
  }

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  const written = await index.writeFiles({ outputPath: OUT_DIR });
  await pagefind.close();
  if (written.errors.length) fail(`writing the index failed: ${written.errors.join('; ')}`);
  if (!fs.existsSync(path.join(OUT_DIR, 'pagefind.js'))) fail('pagefind.js was not written');

  const debates = { preview, roots: contentRoots().map((r) => path.relative(ROOT, r)), published: g.debates.filter((d) => d.published).map((d) => d.id), unpublished: g.debates.filter((d) => !d.published).map((d) => d.id) };
  fs.writeFileSync(DEBATES_BUILD, `${JSON.stringify(debates, null, 2)}\n`);

  const size = dirSize(OUT_DIR);
  console.log(
    `build-search: indexed ${counts.entity} entities, ${counts.article} articles, ${counts.source} sources, ${counts.learning} learning paths, ${counts.debate} published debates; ` +
      `${path.relative(ROOT, OUT_DIR)} has ${size.files} files, ${(size.bytes / 1024).toFixed(0)} KiB total`,
  );
}

main().catch(async (e) => {
  await pagefind?.close().catch(() => undefined);
  fail((e as Error).stack ?? String(e));
});
