/**
 * Verifies every external identifier in the content against its registry:
 *   DOI      -> Crossref (resolved title must match the cited title)
 *   ISBN     -> Open Library, then Google Books (title must match)
 *   OCLC     -> Open Library bibkeys API (title must match)
 *   URL      -> archive.org / Open Library metadata, or the page's own title (must carry the cited title)
 *   Wikidata -> label or alias must identify the entity (exact or near-exact name)
 *   Commons  -> file must exist on Wikimedia Commons; licence, author and thumbnail are recorded
 *
 * Results are cached in content/verification.json (committed) so builds are reproducible offline.
 * Every cache hit is re-checked against the current title or names, so editing a title or reusing an
 * identifier for a different work cannot ride on an old success. Only this script writes the cache.
 *
 * Usage: tsx scripts/content-verify-sources.ts [--refresh] [--offline]
 *   --offline   never touch the network; fail on any identifier without a matching cached success
 *               (this is the build gate)
 * Exit code 1 when any identifier fails verification.
 */

import fs from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { loadContentUncached, CONTENT_DIR } from '../src/lib/content/load';
import { checkArguments, scopedContent } from './content-check';
import type { Entity, Source } from '../src/lib/content/schema';
import { cachedTitleMatches, registryRecord, sameName, sameTitle, urlMatchKind } from '../src/lib/content/similarity';

const CACHE_FILE = process.env.VERIFY_CACHE ? path.resolve(process.env.VERIFY_CACHE) : path.join(CONTENT_DIR, 'verification.json');
const UA = 'TheBharatRepo-SourceVerifier/1.0 (+https://www.thebharatrepo.com)';

interface CacheEntry {
  ok: boolean;
  checkedAt: string;
  /** Title found at the registry. */
  matched?: string;
  /** Wikidata English label and aliases. */
  labels?: string[];
  detail?: string;
  license?: string;
  thumb?: string;
  thumbWidth?: number;
  thumbHeight?: number;
  pageUrl?: string;
  artist?: string;
}
type Cache = Record<string, CacheEntry>;

const argv = process.argv.slice(2);
const args = new Set(argv);
const refresh = args.has('--refresh');
const offline = args.has('--offline');

function loadCache(file: string): Cache {
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Cache;
}

function saveCache(cache: Cache) {
  const sorted = Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(CACHE_FILE, JSON.stringify(sorted, null, 2) + '\n');
}

const now = () => new Date().toISOString();

async function get(url: string, accept: string, attempt = 0): Promise<{ status: number; text: string | null }> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept }, redirect: 'follow', signal: AbortSignal.timeout(45_000) });
  } catch (e) {
    if (attempt < 2) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      return get(url, accept, attempt + 1);
    }
    throw e;
  }
  if ((res.status === 429 || res.status >= 500) && attempt < 3) {
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    return get(url, accept, attempt + 1);
  }
  return { status: res.status, text: res.ok ? await res.text() : null };
}

async function getJson<T>(url: string): Promise<{ status: number; body: T | null }> {
  const { status, text } = await get(url, 'application/json');
  if (text === null) return { status, body: null };
  try {
    return { status, body: JSON.parse(text) as T };
  } catch {
    return { status, body: null };
  }
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleVerdict(cited: string, found: string, what: string): CacheEntry {
  return cachedTitleMatches('record', cited, found)
    ? { ok: true, checkedAt: now(), matched: found }
    : { ok: false, checkedAt: now(), matched: found, detail: `${what} resolves to a different work` };
}

async function verifyDoi(doi: string, title: string): Promise<CacheEntry> {
  const { status, body } = await getJson<{ message: { title?: string[]; subtitle?: string[] } }>(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
  if (!body) return { ok: false, checkedAt: now(), detail: `Crossref HTTP ${status}` };
  const found = [body.message.title?.[0] ?? '', body.message.subtitle?.[0] ?? ''].filter(Boolean).join(': ');
  return titleVerdict(title, stripHtml(found), 'DOI');
}

async function verifyIsbn(isbn: string, title: string): Promise<CacheEntry> {
  const candidates: string[] = [];
  const ol = await getJson<{ title?: string; subtitle?: string }>(`https://openlibrary.org/isbn/${isbn}.json`);
  if (ol.body?.title) candidates.push([ol.body.title, ol.body.subtitle].filter(Boolean).join(': '));
  if (!candidates.some((c) => sameTitle(title, c))) {
    const gb = await getJson<{ items?: { volumeInfo: { title?: string; subtitle?: string } }[] }>(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`);
    for (const it of gb.body?.items ?? []) candidates.push([it.volumeInfo.title, it.volumeInfo.subtitle].filter(Boolean).join(': '));
  }
  if (candidates.length === 0) return { ok: false, checkedAt: now(), detail: 'ISBN not found in Open Library or Google Books' };
  const hit = candidates.find((c) => sameTitle(title, c));
  return hit ? { ok: true, checkedAt: now(), matched: hit } : { ok: false, checkedAt: now(), matched: candidates[0], detail: 'ISBN belongs to a different book' };
}

async function verifyOclc(oclc: string, title: string): Promise<CacheEntry> {
  const { body } = await getJson<Record<string, { title?: string; subtitle?: string }>>(`https://openlibrary.org/api/books?bibkeys=OCLC:${oclc}&format=json&jscmd=data`);
  const rec = body?.[`OCLC:${oclc}`];
  if (!rec?.title) return { ok: false, checkedAt: now(), detail: 'OCLC number not found in Open Library; use an ISBN, DOI or archive.org URL instead' };
  return titleVerdict(title, [rec.title, rec.subtitle].filter(Boolean).join(': '), 'OCLC number');
}

async function verifyUrl(url: string, title: string): Promise<CacheEntry> {
  if (!URL.canParse(url)) return { ok: false, checkedAt: now(), detail: 'invalid URL' };
  const record = registryRecord(url);
  if (record?.site === 'archive.org') {
    const { body } = await getJson<{ metadata?: { title?: string } }>(`https://archive.org/metadata/${record.id}`);
    const t = body?.metadata?.title;
    if (!t) return { ok: false, checkedAt: now(), detail: 'archive.org item not found' };
    return titleVerdict(title, t, 'archive.org item');
  }
  if (record?.site === 'openlibrary.org') {
    const { body } = await getJson<{ title?: string; subtitle?: string }>(`https://openlibrary.org/${record.path}.json`);
    if (!body?.title) return { ok: false, checkedAt: now(), detail: 'Open Library record not found' };
    return titleVerdict(title, [body.title, body.subtitle].filter(Boolean).join(': '), 'Open Library record');
  }
  const { status, text } = await get(url, 'text/html,application/xhtml+xml');
  if (text === null) return { ok: false, checkedAt: now(), detail: `URL HTTP ${status}; use an identifier the verifier can check (DOI, ISBN, OCLC, archive.org)` };
  const head = text.slice(0, 200_000);
  const bits = [
    /<title[^>]*>([\s\S]*?)<\/title>/i.exec(head)?.[1],
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i.exec(head)?.[1],
    /<meta[^>]+name=["']citation_title["'][^>]+content=["']([^"']+)/i.exec(head)?.[1],
    /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(head)?.[1],
  ]
    .filter((x): x is string => Boolean(x))
    .map(stripHtml);
  const hit = bits.find((b) => cachedTitleMatches('page', title, b));
  return hit ? { ok: true, checkedAt: now(), matched: hit } : { ok: false, checkedAt: now(), matched: bits[0], detail: 'page does not carry the cited title' };
}

async function verifyQid(qid: string, names: string[], namedThing: boolean): Promise<CacheEntry> {
  const { status, body } = await getJson<{ entities: Record<string, { labels?: Record<string, { value: string }>; aliases?: Record<string, { value: string }[]> }> }>(
    `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`,
  );
  if (!body) return { ok: false, checkedAt: now(), detail: `Wikidata HTTP ${status}` };
  const ent = Object.values(body.entities)[0];
  const labels = [ent.labels?.en?.value ?? '', ...(ent.aliases?.en ?? []).map((a) => a.value)].filter(Boolean);
  const ok = sameName(names, labels, { namedThing });
  return {
    ok,
    checkedAt: now(),
    labels,
    matched: labels[0] ?? '(no English label)',
    detail: ok ? undefined : `QID label "${labels[0] ?? ''}" does not identify this entity; remove the wikidata field or use the QID of this exact thing`,
  };
}

async function verifyCommons(file: string): Promise<CacheEntry> {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=640&titles=${encodeURIComponent(file)}`;
  type Info = { thumburl?: string; thumbwidth?: number; thumbheight?: number; descriptionurl?: string; extmetadata?: Record<string, { value: string }> };
  const { status, body } = await getJson<{ query?: { pages?: Record<string, { missing?: string; imageinfo?: Info[] }> } }>(url);
  if (!body) return { ok: false, checkedAt: now(), detail: `Commons HTTP ${status}` };
  const page = Object.values(body.query?.pages ?? {})[0];
  if (!page || page.missing !== undefined || !page.imageinfo?.[0]) return { ok: false, checkedAt: now(), detail: 'file does not exist on Commons' };
  const info = page.imageinfo[0];
  const meta = info.extmetadata ?? {};
  return {
    ok: true,
    checkedAt: now(),
    license: stripHtml(meta.LicenseShortName?.value ?? 'unknown'),
    artist: stripHtml(meta.Artist?.value ?? '').slice(0, 200),
    thumb: info.thumburl?.split('?')[0],
    thumbWidth: info.thumbwidth,
    thumbHeight: info.thumbheight,
    pageUrl: info.descriptionurl,
  };
}

interface Job {
  key: string;
  where: string;
  run: () => Promise<CacheEntry>;
  /** Re-checks a cached success against current content; returns a failure reason or null. */
  recheck: (e: CacheEntry) => string | null;
}

function sourceJobs(s: Source): Job[] {
  const jobs: Job[] = [];
  const titleCheck = (e: CacheEntry) => (e.matched && cachedTitleMatches('record', s.title, e.matched) ? null : `cached record "${e.matched ?? ''}" does not match the cited title`);
  if (s.doi) jobs.push({ key: `doi:${s.doi.toLowerCase()}`, where: s.id, run: () => verifyDoi(s.doi!, s.title), recheck: titleCheck });
  if (s.isbn) jobs.push({ key: `isbn:${s.isbn}`, where: s.id, run: () => verifyIsbn(s.isbn!, s.title), recheck: titleCheck });
  if (s.oclc) jobs.push({ key: `oclc:${s.oclc}`, where: s.id, run: () => verifyOclc(s.oclc!, s.title), recheck: titleCheck });
  if (s.url && !s.doi && !s.isbn && !s.oclc) {
    jobs.push({
      key: `url:${s.url}`,
      where: s.id,
      run: () => verifyUrl(s.url!, s.title),
      recheck: (e) => (e.matched && cachedTitleMatches(urlMatchKind(s.url!), s.title, e.matched) ? null : `cached title "${e.matched ?? ''}" does not match the cited title`),
    });
  }
  return jobs;
}

function entityJobs(e: Entity): Job[] {
  const jobs: Job[] = [];
  if (e.wikidata) {
    const names = [e.names.en, e.names.iast ?? '', e.id.split('.')[1].replace(/-/g, ' ')].filter(Boolean);
    const namedThing = ['site', 'person', 'polity', 'text'].includes(e.type);
    jobs.push({
      key: `qid:${e.wikidata}:${e.id}`,
      where: e.id,
      run: () => verifyQid(e.wikidata!, names, namedThing),
      recheck: (c) => (c.labels && sameName(names, c.labels, { namedThing }) ? null : 'cached Wikidata labels do not identify this entity'),
    });
  }
  if (e.image) {
    jobs.push({
      key: `commons:${e.image.commons}`,
      where: e.id,
      run: () => verifyCommons(e.image!.commons),
      recheck: (c) =>
        /^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(c.thumb ?? '') && c.pageUrl?.startsWith('https://commons.wikimedia.org/') && c.thumbWidth && c.thumbHeight
          ? null
          : 'cached image record is incomplete or not from Wikimedia',
    });
  }
  return jobs;
}

function cacheCheckedJobs(checked: Cache) {
  const cache = loadCache(CACHE_FILE);
  let changed = false;
  for (const [key, entry] of Object.entries(checked)) {
    const previous = cache[key];
    const comparable = Object.fromEntries(Object.entries(entry).filter(([, value]) => value !== undefined));
    if (!previous || !isDeepStrictEqual(previous, { ...comparable, checkedAt: previous.checkedAt })) {
      cache[key] = entry;
      changed = true;
    }
  }
  if (!changed) return;
  const dir = fs.mkdtempSync(path.join(path.dirname(CACHE_FILE), '.verification-'));
  const file = path.join(dir, 'verification.json');
  try {
    const sorted = Object.fromEntries(Object.entries(cache).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(file, JSON.stringify(sorted, null, 2) + '\n');
    fs.renameSync(file, CACHE_FILE);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function checkFiles(args: string[]) {
  const options = checkArguments(args);
  if (!options) return;
  const { errors, entities, sources } = scopedContent(options.files);
  if (errors.length) {
    console.log(`error: Fix ${errors.length} content problem(s), then rerun content:check.`);
    for (const { file, message } of errors) console.log(`  ${file}: ${message}`);
    process.exitCode = 1;
    return;
  }

  const jobs = [...sources.flatMap(sourceJobs), ...entities.flatMap(entityJobs)];
  const checked: Cache = {};
  let failed = 0;
  for (const job of jobs) {
    let entry: CacheEntry;
    try {
      entry = checked[job.key] ?? await job.run();
    } catch (error) {
      entry = { ok: false, checkedAt: now(), detail: `network error: ${(error as Error).message}. Check your connection and retry.` };
    }
    const detail = entry.ok ? job.recheck(entry) : entry.detail ?? 'could not verify this identifier';
    if (detail) {
      failed++;
      console.log(`  ${job.where} (${job.key}): ${detail}${entry.matched ? `; found "${entry.matched}"` : ''}`);
    } else {
      checked[job.key] = entry;
    }
  }
  if (failed) {
    console.log(`error: ${failed} online check(s) failed. Check the identifier and cited title or name, then rerun content:check.`);
    process.exitCode = 1;
    return;
  }
  if (options.writeCache) cacheCheckedJobs(checked);
  console.log(`content:check ok: ${new Set(options.files.map((file) => path.resolve(file))).size} file(s), ${Object.keys(checked).length} identifier(s) verified online`);
}

async function main() {
  const g = loadContentUncached();
  // A staging run (CONTENT_ROOTS=content:staging/<batch>) is blocked only by problems in its own files,
  // so known issues in published content do not stop a batch from verifying its sources.
  const stagingRoots = (process.env.CONTENT_ROOTS ?? '').split(':').filter((r) => r && r !== 'content');
  const blocking = stagingRoots.length ? g.errors.filter((e) => stagingRoots.some((r) => e.file.startsWith(r))) : g.errors;
  g.errors = blocking;
  if (g.errors.length > 0) {
    console.error(`content:validate reports ${g.errors.length} problem(s); fix those first:`);
    for (const e of g.errors.slice(0, 40)) console.error(`  ${e.file}: ${e.message}`);
    if (g.errors.length > 40) console.error(`  ...and ${g.errors.length - 40} more`);
    process.exit(1);
  }
  const cache = loadCache(CACHE_FILE);
  // A staging run may read published successes; they are re-checked like any other hit.
  const shared = path.join(CONTENT_DIR, 'verification.json');
  if (CACHE_FILE !== shared) for (const [k, v] of Object.entries(loadCache(shared))) if (!cache[k] && v.ok) cache[k] = v;

  // Staging runs verify only the sources and entities defined in their own roots.
  const own = new Set<string>();
  for (const r of stagingRoots) {
    for (const sub of ['sources', 'entities']) {
      const walk = (d: string): string[] =>
        !fs.existsSync(d) ? [] : fs.readdirSync(d, { withFileTypes: true }).flatMap((x) => (x.isDirectory() ? walk(path.join(d, x.name)) : x.name.endsWith('.yaml') ? [path.join(d, x.name)] : []));
      for (const f of walk(path.join(process.cwd(), r, sub))) own.add(sub === 'sources' ? `src.${path.basename(f, '.yaml')}` : `${path.basename(path.dirname(f))}.${path.basename(f, '.yaml')}`);
    }
  }
  const inScope = (id: string) => stagingRoots.length === 0 || own.has(id);

  const jobs: Job[] = [];
  for (const s of g.sources.values()) if (inScope(s.id)) jobs.push(...sourceJobs(s));
  for (const e of g.entities.values()) if (inScope(e.id)) jobs.push(...entityJobs(e));

  const failures: { where: string; key: string; detail: string; matched?: string }[] = [];
  let fetched = 0;
  let cached = 0;
  const queue = [...jobs];
  const worker = async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      const hit = cache[job.key];
      const recheckFail = hit?.ok ? job.recheck(hit) : 'no cached success';
      let entry: CacheEntry;
      if (hit?.ok && !recheckFail && !refresh) {
        entry = hit;
        cached++;
      } else if (offline) {
        failures.push({ where: job.where, key: job.key, detail: `not verified (${recheckFail ?? 'refresh requested'}); run npm run content:verify-sources` });
        continue;
      } else {
        try {
          entry = await job.run();
        } catch (e) {
          entry = { ok: false, checkedAt: now(), detail: `network error: ${(e as Error).message}` };
        }
        cache[job.key] = entry;
        fetched++;
      }
      if (!entry.ok) failures.push({ where: job.where, key: job.key, detail: entry.detail ?? 'failed', matched: entry.matched });
    }
  };
  await Promise.all(Array.from({ length: offline ? 1 : 4 }, worker));
  // A full run also drops Wikidata results kept for entity ids that no longer exist, such as merged-away records.
  if (!stagingRoots.length) for (const key of Object.keys(cache)) if (key.startsWith('qid:') && !g.entities.has(key.slice(key.lastIndexOf(':') + 1))) delete cache[key];
  if (!offline) saveCache(cache);

  console.log(`verify-sources${offline ? ' (offline)' : ''}: ${jobs.length} identifiers, ${cached} cached, ${fetched} fetched, ${failures.length} failed`);
  for (const f of failures.sort((a, b) => a.where.localeCompare(b.where))) {
    console.log(`  FAIL ${f.where} ${f.key}: ${f.detail}${f.matched ? ` [found: "${f.matched}"]` : ''}`);
  }
  if (failures.length > 0) process.exit(1);
}

const check = argv[0] === '--check';
(check ? checkFiles(argv.slice(1)) : main()).catch((error: Error) => {
  if (check) console.log(`error: ${JSON.stringify(error.message)}`);
  else console.error(error);
  process.exitCode = 1;
});
