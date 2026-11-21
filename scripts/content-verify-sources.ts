/**
 * Verifies every external identifier in the content against its registry:
 *   DOI      -> Crossref (title must match the cited title)
 *   ISBN     -> Open Library, then Google Books (title must match)
 *   Wikidata -> Wikidata entity (label or alias must overlap the entity name)
 *   Commons  -> Wikimedia Commons file (must exist; licence and thumbnail URL are recorded)
 *
 * Results are cached in content/verification.json (committed) so builds are reproducible offline.
 * A cached failure is retried; a cached success is trusted unless --refresh is passed.
 *
 * Usage: tsx scripts/content-verify-sources.ts [--refresh] [--offline]
 * Exit code 1 when any identifier fails verification.
 */

import fs from 'node:fs';
import path from 'node:path';
import { loadContentUncached, CONTENT_DIR } from '../src/lib/content/load';
import { titleSimilarity } from './lib/similarity';

const CACHE_FILE = process.env.VERIFY_CACHE ? path.resolve(process.env.VERIFY_CACHE) : path.join(CONTENT_DIR, 'verification.json');
const UA = 'TheBharatRepo-SourceVerifier/1.0 (+https://www.thebharatrepo.com)';
const TITLE_THRESHOLD = 0.6;

interface CacheEntry {
  ok: boolean;
  checkedAt: string;
  matched?: string;
  detail?: string;
  license?: string;
  thumb?: string;
  pageUrl?: string;
  artist?: string;
}
type Cache = Record<string, CacheEntry>;

const args = new Set(process.argv.slice(2));
const refresh = args.has('--refresh');
const offline = args.has('--offline');

function loadCache(): Cache {
  if (!fs.existsSync(CACHE_FILE)) return {};
  return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) as Cache;
}

function saveCache(cache: Cache) {
  const sorted = Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(CACHE_FILE, JSON.stringify(sorted, null, 2) + '\n');
}

async function getJson(url: string, attempt = 0): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, redirect: 'follow' });
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    return getJson(url, attempt + 1);
  }
  if (!res.ok) return { status: res.status, body: null };
  return { status: res.status, body: await res.json() };
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').trim();
}

async function verifyDoi(doi: string, title: string): Promise<CacheEntry> {
  const { status, body } = await getJson(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
  const now = new Date().toISOString();
  if (!body) return { ok: false, checkedAt: now, detail: `Crossref HTTP ${status}` };
  const msg = (body as { message: { title?: string[]; subtitle?: string[] } }).message;
  const found = [msg.title?.[0] ?? '', msg.subtitle?.[0] ?? ''].filter(Boolean).join(': ');
  const sim = titleSimilarity(title, found);
  return sim >= TITLE_THRESHOLD
    ? { ok: true, checkedAt: now, matched: found }
    : { ok: false, checkedAt: now, matched: found, detail: `DOI resolves to a different work (similarity ${sim.toFixed(2)})` };
}

async function verifyIsbn(isbn: string, title: string): Promise<CacheEntry> {
  const now = new Date().toISOString();
  const candidates: string[] = [];
  const ol = await getJson(`https://openlibrary.org/isbn/${isbn}.json`);
  if (ol.body) {
    const b = ol.body as { title?: string; subtitle?: string };
    candidates.push([b.title, b.subtitle].filter(Boolean).join(': '));
  }
  if (!candidates.some((c) => titleSimilarity(title, c) >= TITLE_THRESHOLD)) {
    const gb = await getJson(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    const items = (gb.body as { items?: { volumeInfo: { title?: string; subtitle?: string } }[] } | null)?.items ?? [];
    for (const it of items) candidates.push([it.volumeInfo.title, it.volumeInfo.subtitle].filter(Boolean).join(': '));
  }
  if (candidates.length === 0) return { ok: false, checkedAt: now, detail: 'ISBN not found in Open Library or Google Books' };
  const best = candidates.reduce((a, b) => (titleSimilarity(title, b) > titleSimilarity(title, a) ? b : a));
  const sim = titleSimilarity(title, best);
  return sim >= TITLE_THRESHOLD
    ? { ok: true, checkedAt: now, matched: best }
    : { ok: false, checkedAt: now, matched: best, detail: `ISBN belongs to a different book (similarity ${sim.toFixed(2)})` };
}

async function verifyQid(qid: string, names: string[]): Promise<CacheEntry> {
  const now = new Date().toISOString();
  const { status, body } = await getJson(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`);
  if (!body) return { ok: false, checkedAt: now, detail: `Wikidata HTTP ${status}` };
  const ent = Object.values((body as { entities: Record<string, { labels?: Record<string, { value: string }>; aliases?: Record<string, { value: string }[]> }> }).entities)[0];
  const labels = [ent.labels?.en?.value ?? '', ...(ent.aliases?.en ?? []).map((a) => a.value)].filter(Boolean);
  const label = labels[0] ?? '(no English label)';
  const ok = labels.some((l) => names.some((n) => titleSimilarity(n, l) > 0));
  return ok ? { ok: true, checkedAt: now, matched: label } : { ok: false, checkedAt: now, matched: label, detail: `QID label "${label}" does not match the entity name` };
}

async function verifyCommons(file: string): Promise<CacheEntry> {
  const now = new Date().toISOString();
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=960&titles=${encodeURIComponent(file)}`;
  const { status, body } = await getJson(url);
  if (!body) return { ok: false, checkedAt: now, detail: `Commons HTTP ${status}` };
  const pages = (body as { query?: { pages?: Record<string, { missing?: string; imageinfo?: { thumburl?: string; descriptionurl?: string; extmetadata?: Record<string, { value: string }> }[] }> } }).query?.pages ?? {};
  const page = Object.values(pages)[0];
  if (!page || page.missing !== undefined || !page.imageinfo?.[0]) return { ok: false, checkedAt: now, detail: 'file does not exist on Commons' };
  const info = page.imageinfo[0];
  const meta = info.extmetadata ?? {};
  return {
    ok: true,
    checkedAt: now,
    license: stripHtml(meta.LicenseShortName?.value ?? 'unknown'),
    artist: stripHtml(meta.Artist?.value ?? '').slice(0, 200),
    thumb: info.thumburl,
    pageUrl: info.descriptionurl,
  };
}

async function main() {
  const g = loadContentUncached();
  if (g.errors.length > 0) {
    console.error(`content:validate reports ${g.errors.length} problem(s); fix those first (npm run content:validate).`);
    process.exit(1);
  }
  const cache = loadCache();
  // Shared cache from published content is read (never written) by staging runs.
  const shared = path.join(CONTENT_DIR, 'verification.json');
  if (CACHE_FILE !== shared && fs.existsSync(shared)) {
    for (const [k, v] of Object.entries(JSON.parse(fs.readFileSync(shared, 'utf8')) as Cache)) if (!cache[k] && v.ok) cache[k] = v;
  }
  type Job = { key: string; where: string; run: () => Promise<CacheEntry> };
  const jobs: Job[] = [];

  for (const s of g.sources.values()) {
    if (s.doi) jobs.push({ key: `doi:${s.doi.toLowerCase()}`, where: s.id, run: () => verifyDoi(s.doi!, s.title) });
    if (s.isbn) jobs.push({ key: `isbn:${s.isbn}`, where: s.id, run: () => verifyIsbn(s.isbn!, s.title) });
  }
  for (const e of g.entities.values()) {
    if (e.wikidata) {
      const names = [e.names.en, e.names.iast ?? ''].filter(Boolean);
      jobs.push({ key: `qid:${e.wikidata}:${e.id}`, where: e.id, run: () => verifyQid(e.wikidata!, names) });
    }
    if (e.image) jobs.push({ key: `commons:${e.image.commons}`, where: e.id, run: () => verifyCommons(e.image!.commons) });
  }

  const failures: { where: string; key: string; detail: string; matched?: string }[] = [];
  let fetched = 0;
  let cached = 0;
  const queue = [...jobs];
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const hit = cache[job.key];
      let entry: CacheEntry;
      if (hit && hit.ok && !refresh) {
        entry = hit;
        cached++;
      } else if (offline) {
        entry = hit ?? { ok: false, checkedAt: new Date().toISOString(), detail: 'not verified (offline)' };
      } else {
        try {
          entry = await job.run();
        } catch (e) {
          entry = { ok: false, checkedAt: new Date().toISOString(), detail: `network error: ${(e as Error).message}` };
        }
        cache[job.key] = entry;
        fetched++;
      }
      if (!entry.ok) failures.push({ where: job.where, key: job.key, detail: entry.detail ?? 'failed', matched: entry.matched });
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  if (!offline) saveCache(cache);

  console.log(`verify-sources: ${jobs.length} identifiers, ${cached} cached, ${fetched} fetched, ${failures.length} failed`);
  for (const f of failures.sort((a, b) => a.where.localeCompare(b.where))) {
    console.log(`  FAIL ${f.where} ${f.key}: ${f.detail}${f.matched ? ` [found: "${f.matched}"]` : ''}`);
  }
  if (failures.length > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
