/**
 * Loads, validates and cross-links all content.
 *
 * Content lives in git:
 *   content/entities/<type>/<slug>.yaml   one entity per file, id = <type>.<slug>
 *   content/sources/<slug>.yaml           one source per file, id = src.<slug>
 *   content/corrections.yaml              public corrections log
 *   _content/<category>/<slug>.md         articles (frontmatter + Markdown with [@src.id, locator] citations)
 *
 * loadContent() never throws on bad content: it returns every problem in `errors` so a single run
 * reports everything. Callers decide whether errors are fatal (the build and CI treat them as fatal).
 */

import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import YAML from 'yaml';
import { sameTitle } from './similarity';
import type { z } from 'zod';
import {
  ArticleFrontmatterSchema,
  CATEGORIES,
  CorrectionSchema,
  EntitySchema,
  SourceSchema,
  citationId,
  isTraditional,
  type ArticleFrontmatter,
  type DatingMethod,
  type Correction,
  type Entity,
  type Source,
} from './schema';

export interface Article extends ArticleFrontmatter {
  slug: string;
  /** Repo-relative path of the source file. */
  file: string;
  category: (typeof CATEGORIES)[number];
  body: string;
  /** Source ids cited inline in the body, in first-use order. */
  inlineCitations: { id: string; locator?: string }[];
}

export interface ContentProblem {
  file: string;
  message: string;
}

export interface ContentGraph {
  entities: Map<string, Entity>;
  sources: Map<string, Source>;
  articles: Article[];
  corrections: Correction[];
  /** entity id -> articles about it */
  articlesByEntity: Map<string, Article[]>;
  /** entity id -> entities pointing at it */
  inbound: Map<string, { from: string; kind: string }[]>;
  /** former entity id (alias) -> the live entity it was merged into */
  aliases: Map<string, string>;
  errors: ContentProblem[];
}

export const ROOT = process.cwd();
export const CONTENT_DIR = path.join(ROOT, 'content');

/**
 * Content roots, colon-separated, relative to the repo root. Default "content".
 * Staging batches validate with CONTENT_ROOTS=content:staging/<batch> so they see published content plus their own.
 */
export function contentRoots(): string[] {
  return (process.env.CONTENT_ROOTS ?? 'content')
    .split(':')
    .filter(Boolean)
    .map((r) => path.join(ROOT, r));
}

/** Articles root. ARTICLES_ROOT="" skips articles (used by entity-only staging batches). */
export function articlesDir(): string | null {
  const v = process.env.ARTICLES_ROOT ?? '_content';
  return v === '' ? null : path.join(ROOT, v);
}

/** Matches a citation group such as [@src.a, p. 4] or [@src.a; @src.b, verse 10.129.1]. */
export const CITATION_GROUP = /\[(@src\.[a-z0-9-]+[^\]]*)\]/g;

export function parseCitationGroup(inner: string): { id: string; locator?: string }[] {
  return inner
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = /^@(src\.[a-z0-9-]+)\s*(?:,\s*(.+))?$/.exec(part);
      if (!m) return { id: `!invalid:${part}` };
      return m[2] ? { id: m[1], locator: m[2].trim() } : { id: m[1] };
    });
}

export function extractCitations(body: string): { id: string; locator?: string }[] {
  const out: { id: string; locator?: string }[] = [];
  for (const m of body.matchAll(CITATION_GROUP)) out.push(...parseCitationGroup(m[1]));
  return out;
}

/** Citation-like text that is not a well-formed group, e.g. "[see @src.x]", "[@ src.x]", a bare "@src.x". */
export function findMalformedCitations(body: string): string[] {
  const stripped = body.replace(CITATION_GROUP, '');
  const out: string[] = [];
  for (const m of stripped.matchAll(/\[[^\]\n]*@\s*src[^\]\n]*\]|@\s*src[._-][\w.-]*/gi)) out.push(m[0]);
  return out;
}

/** Site-internal Markdown link targets in a body (`[text](/path)`), without query or fragment, outside code. */
export function internalLinks(body: string): string[] {
  const visible = body.replace(/```[\s\S]*?```|`[^`\n]*`/g, '');
  return [...visible.matchAll(/\]\((\/[^)\s?#]*)[^)]*\)/g)].map((m) => m[1].replace(/\/+$/, '') || '/');
}

/** Citations inside HTML comments or code are invisible to readers and must not count. */
export function findHiddenCitations(body: string): string[] {
  const hidden: string[] = [];
  const regions = [...body.matchAll(/<!--[\s\S]*?-->|```[\s\S]*?```|`[^`\n]*`/g)].map((m) => m[0]);
  for (const r of regions) for (const m of r.matchAll(CITATION_GROUP)) hidden.push(m[0]);
  return hidden;
}

/**
 * Detects a BCE endpoint one year earlier than the text says: an endpoint equal to -N (that is,
 * "N+1 BCE") while the accompanying text names "N BCE" and no endpoint equals 1 - N. Returns each such N.
 */
export function bceOffByOne(range: { earliest: number; latest: number; best?: number }, text: string): number[] {
  const ends = [range.earliest, range.latest, range.best].filter((x): x is number => x !== undefined);
  const flagged = new Set<number>();
  for (const m of text.replace(/,/g, '').matchAll(/\b(\d{2,6})\s*(?:BCE|BC)\b/g)) {
    const n = Number(m[1]);
    if (ends.includes(-n) && !ends.includes(1 - n)) flagged.add(n);
  }
  return [...flagged];
}

const LABEL_RANGE = /\b(\d{2,5})\s*(BCE|BC|CE|AD)?\s*(?:to|-|–)\s*(\d{2,5})\s*(BCE|BC|CE|AD)\b/gi;

/**
 * A dating label that states one span and no other year, such as "Reign (about 268 to 232 BCE)", is what
 * readers see beside the range, so it must name the range's own endpoints. Labels that name several
 * phases or alternatives are left alone. Returns a message when they disagree.
 */
export function labelRangeMismatch(dating: { label?: string; range: { earliest: number; latest: number } }): string | null {
  const label = (dating.label ?? '').replace(/,(?=\d{3})/g, '');
  const spans = [...label.matchAll(LABEL_RANGE)];
  if (spans.length !== 1 || /\d/.test(label.replace(spans[0][0], ''))) return null;
  const [, a, eraA, b, eraB] = spans[0];
  const astro = (n: string, era: string | undefined) => (era && /^B/i.test(era) ? 1 - Number(n) : Number(n));
  const earliest = astro(a, eraA ?? eraB);
  const latest = astro(b, eraB);
  if (earliest === dating.range.earliest && latest === dating.range.latest) return null;
  return `label "${dating.label}" names a different span from the range; make the label and the range agree`;
}

const CENTURY_ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth', 'twenty-first'];

function ordinalSuffix(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th';
  return ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th';
}

/**
 * Detects a CE end year one short of the round year the text gives: a non-traditional latest
 * endpoint of the form N99 CE while the text names "(N+1)00 CE" or the century ending there
 * ("fifth century CE" for 500), and never names the N99 year itself. Returns the round year.
 */
export function ceOffByOne(dating: { method: DatingMethod; range: { latest: number } }, text: string): number[] {
  const { latest } = dating.range;
  if (isTraditional(dating.method) || latest <= 0 || latest % 100 !== 99) return [];
  const round = latest + 1;
  const flat = text.replace(/,/g, '');
  const names = (year: number) => new RegExp(`\\b${year}\\s*(?:CE|AD)\\b`).test(flat);
  if (names(latest)) return [];
  const century = round / 100;
  const ordinals = [`${century}${ordinalSuffix(century)}`, CENTURY_ORDINALS[century - 1]].filter(Boolean).join('|');
  const namesCentury = new RegExp(`\\b(?:${ordinals})[- ]centur(?:y|ies)(?![- ]*(?:BCE|BC)\\b)`, 'i').test(flat);
  return names(round) || namesCentury ? [round] : [];
}

/**
 * Authored datings must write BCE years as strings ("7000 BCE"), never as raw negative numbers.
 * A raw -7000 is the astronomical year 7001 BCE, and authors repeatedly wrote -N meaning N BCE,
 * which no text heuristic can catch reliably. Returns one message per offending endpoint.
 */
export function rawNegativeYears(datings: unknown): string[] {
  if (!Array.isArray(datings)) return [];
  const out: string[] = [];
  datings.forEach((d, i) => {
    const range = (d as { range?: Record<string, unknown> } | null)?.range;
    if (!range || typeof range !== 'object') return;
    for (const key of ['earliest', 'latest', 'best']) {
      const v = range[key];
      if (typeof v === 'number' && v < 0) {
        out.push(`datings[${i}].range.${key}: write "${-v} BCE" or "${1 - v} BCE" as a string, not the raw astronomical year ${v} (${1 - v} BCE)`);
      }
    }
  });
  return out;
}

/**
 * Scholarly deep-time dates are reported as years before present, so they must be written "385 ka" or
 * "1.5 Ma". A string such as "385000 BCE" is read as a calendar year and lands about 2,025 years too
 * early. Calendar figures up to "10000 BCE" stay allowed; traditional reckonings count from 3102 BCE and
 * are exempt. Returns one message per offending endpoint.
 */
export function deepTimeBceYears(datings: unknown): string[] {
  if (!Array.isArray(datings)) return [];
  const out: string[] = [];
  datings.forEach((d, i) => {
    const { method, range } = (d ?? {}) as { method?: unknown; range?: Record<string, unknown> };
    if (!range || typeof range !== 'object' || (typeof method === 'string' && isTraditional(method as DatingMethod))) return;
    for (const key of ['earliest', 'latest', 'best']) {
      const v = range[key];
      const m = typeof v === 'string' ? /^(\d+(?:\.\d+)?)\s*(?:BCE|BC)$/i.exec(v.trim().replace(/,/g, '')) : null;
      if (m && Number(m[1]) > 10000) {
        out.push(`datings[${i}].range.${key}: "${v}" is a deep-time date; write it as years before present ("N ka" or "N Ma") as the cited source reports it`);
      }
    }
  });
  return out;
}

/**
 * Two source records describe the same work: no identifier of the same type conflicts (archive.org and
 * other URLs compare by host and first path segment pair) and the titles match.
 */
export function sameWork(a: Source, b: Source): boolean {
  const urlKey = (u?: string) => {
    if (!u) return '';
    try {
      const x = new URL(u);
      return `${x.hostname}/${x.pathname.split('/').filter(Boolean).slice(0, 2).join('/')}`.toLowerCase();
    } catch {
      return u;
    }
  };
  const pairs: [string, string][] = [
    [a.doi?.toLowerCase() ?? '', b.doi?.toLowerCase() ?? ''],
    [a.isbn ?? '', b.isbn ?? ''],
    [a.oclc ?? '', b.oclc ?? ''],
    [urlKey(a.url), urlKey(b.url)],
  ];
  if (pairs.some(([x, y]) => x && y && x !== y)) return false;
  return sameTitle(a.title, b.title);
}

/** Registry identifiers of a source; two source ids sharing one are the same work registered twice. */
function identifierKeys(s: Source): string[] {
  return [s.doi && `doi:${s.doi.toLowerCase()}`, s.isbn && `isbn:${s.isbn}`, s.oclc && `oclc:${s.oclc}`, s.url && `url:${s.url.replace(/\/+$/, '')}`].filter((k): k is string => Boolean(k));
}

/**
 * Maps every alias to the entity that declares it. An alias is a former id, so it must not be a live
 * entity id (the redirect would hide that page) and only one entity may claim it.
 */
export function resolveAliases(entities: Iterable<Pick<Entity, 'id' | 'aliases'>>): { aliases: Map<string, string>; problems: { id: string; message: string }[] } {
  const list = [...entities];
  const live = new Set(list.map((e) => e.id));
  const aliases = new Map<string, string>();
  const problems: { id: string; message: string }[] = [];
  for (const e of list) {
    for (const a of e.aliases) {
      if (live.has(a)) problems.push({ id: e.id, message: `alias ${a} collides with a live entity id; an alias names an entity that no longer exists` });
      else if (aliases.has(a) && aliases.get(a) !== e.id) problems.push({ id: e.id, message: `alias ${a} is already claimed by ${aliases.get(a)}` });
      else aliases.set(a, e.id);
    }
  }
  return { aliases, problems };
}

/**
 * The entity page lists outbound relations and, automatically, inbound ones, so each pair of entities
 * takes at most one relation: a second relation between the same two entities, in either direction and
 * of any kind, shows the other entity twice on both pages. Also rejects an entity relating to itself.
 * Each problem is filed against the entity that carries the redundant relation.
 */
export function duplicateRelations(entities: Iterable<Pick<Entity, 'id' | 'relations'>>): { id: string; message: string }[] {
  const problems: { id: string; message: string }[] = [];
  const first = new Map<string, { from: string; kind: string; target: string }>();
  for (const e of entities) {
    for (const r of e.relations) {
      if (r.target === e.id) {
        problems.push({ id: e.id, message: `relation ${r.kind} -> ${r.target} points at the entity itself` });
        continue;
      }
      const key = [e.id, r.target].sort().join(' ');
      const prev = first.get(key);
      if (!prev) {
        first.set(key, { from: e.id, kind: r.kind, target: r.target });
        continue;
      }
      if (prev.from === e.id && prev.kind === r.kind) problems.push({ id: e.id, message: `relation ${r.kind} -> ${r.target} is listed twice` });
      else if (prev.from === e.id) problems.push({ id: e.id, message: `relations ${prev.kind} and ${r.kind} both link to ${r.target}; keep one relation per pair of entities and put any detail in its note` });
      else problems.push({ id: e.id, message: `relation ${r.kind} -> ${r.target} duplicates ${prev.from}'s relation ${prev.kind} -> ${e.id}; the site shows inbound relations on both pages, so keep one` });
    }
  }
  return problems;
}

let strays: string[] = [];

function walk(dir: string, ext: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p, ext));
    else if (entry.isFile() && entry.name.endsWith(ext)) out.push(p);
    else if (!entry.name.startsWith('.')) strays.push(p);
  }
  return out.sort();
}

function rel(p: string): string {
  return path.relative(ROOT, p);
}

function formatZod(err: z.ZodError): string[] {
  return err.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
}

function readYaml(file: string, errors: ContentProblem[]): unknown {
  try {
    return YAML.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    errors.push({ file: rel(file), message: `YAML parse error: ${(e as Error).message}` });
    return undefined;
  }
}

export function loadContentUncached(): ContentGraph {
  const errors: ContentProblem[] = [];
  const entities = new Map<string, Entity>();
  const sources = new Map<string, Source>();
  const articles: Article[] = [];
  let corrections: Correction[] = [];

  const roots = contentRoots();
  const artDir = articlesDir();
  strays = [];
  const workIds = new Map<string, string>();

  for (const file of roots.flatMap((r) => walk(path.join(r, 'sources'), '.yaml'))) {
    const raw = readYaml(file, errors);
    if (raw === undefined) continue;
    const parsed = SourceSchema.safeParse(raw);
    if (!parsed.success) {
      for (const m of formatZod(parsed.error)) errors.push({ file: rel(file), message: m });
      continue;
    }
    const expected = `src.${path.basename(file, '.yaml')}`;
    if (parsed.data.id !== expected) errors.push({ file: rel(file), message: `id ${parsed.data.id} must match filename (${expected})` });
    const prev = sources.get(parsed.data.id);
    if (prev) {
      // The same work cited independently by two roots (published and staging) is not an error;
      // a different work under the same id is.
      if (!sameWork(prev, parsed.data)) errors.push({ file: rel(file), message: `source id ${parsed.data.id} already names a different work (identifiers or title differ)` });
      continue;
    }
    sources.set(parsed.data.id, parsed.data);
    for (const key of identifierKeys(parsed.data)) {
      const other = workIds.get(key);
      if (other) errors.push({ file: rel(file), message: `${key} already identifies ${other}; cite one source id per work` });
      else workIds.set(key, parsed.data.id);
    }
  }

  const entityFile = new Map<string, string>();
  for (const file of roots.flatMap((r) => walk(path.join(r, 'entities'), '.yaml'))) {
    const raw = readYaml(file, errors);
    if (raw === undefined) continue;
    const rawDatings = (raw as { datings?: unknown } | null)?.datings;
    for (const m of [...rawNegativeYears(rawDatings), ...deepTimeBceYears(rawDatings)]) errors.push({ file: rel(file), message: m });
    const parsed = EntitySchema.safeParse(raw);
    if (!parsed.success) {
      for (const m of formatZod(parsed.error)) errors.push({ file: rel(file), message: m });
      continue;
    }
    const e = parsed.data;
    const text = [e.summary, e.summaries?.kids, e.summaries?.teen, ...e.claims.map((c) => c.text)].join(' ');
    e.datings.forEach((d, i) => {
      for (const n of bceOffByOne(d.range, `${text} ${d.label ?? ''} ${d.note ?? ''}`)) {
        errors.push({ file: rel(file), message: `datings[${i}]: endpoint is written as "${n + 1} BCE" but the text says "${n} BCE"; check which is meant` });
      }
      for (const n of ceOffByOne(d, `${text} ${d.label ?? ''} ${d.note ?? ''}`)) {
        errors.push({ file: rel(file), message: `datings[${i}]: latest is written as "${n - 1} CE" but the text gives ${n} CE (or the century ending then); a CE year needs no BCE-style shift` });
      }
      const mismatch = labelRangeMismatch(d);
      if (mismatch) errors.push({ file: rel(file), message: `datings[${i}]: ${mismatch}` });
    });
    const expected = `${path.basename(path.dirname(file))}.${path.basename(file, '.yaml')}`;
    if (e.id !== expected) errors.push({ file: rel(file), message: `id ${e.id} must match path (${expected})` });
    if (entities.has(e.id)) errors.push({ file: rel(file), message: `duplicate entity id ${e.id}` });
    entities.set(e.id, e);
    entityFile.set(e.id, rel(file));
  }

  if (artDir && fs.existsSync(artDir)) {
    for (const entry of fs.readdirSync(artDir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      if (!entry.isDirectory() || !(CATEGORIES as readonly string[]).includes(entry.name)) {
        errors.push({ file: rel(path.join(artDir, entry.name)), message: `not a category directory; categories are ${CATEGORIES.join(', ')}` });
      }
    }
  }
  for (const category of artDir ? CATEGORIES : []) {
    for (const file of walk(path.join(artDir!, category), '.md')) {
      const relFile = rel(file);
      if (path.dirname(file) !== path.join(artDir!, category)) {
        errors.push({ file: relFile, message: 'articles must sit directly in their category directory' });
        continue;
      }
      const { data, content } = matter(fs.readFileSync(file, 'utf8'));
      for (const m of [...rawNegativeYears(data.datings), ...deepTimeBceYears(data.datings)]) errors.push({ file: relFile, message: m });
      const parsed = ArticleFrontmatterSchema.safeParse(data);
      if (!parsed.success) {
        for (const m of formatZod(parsed.error)) errors.push({ file: relFile, message: m });
        continue;
      }
      for (const h of findHiddenCitations(content)) errors.push({ file: relFile, message: `citation inside a comment or code is invisible to readers: ${h}` });
      const visible = content.replace(/<!--[\s\S]*?-->|```[\s\S]*?```|`[^`\n]*`/g, '');
      for (const m of findMalformedCitations(visible)) errors.push({ file: relFile, message: `malformed citation "${m}"; use [@src.id] or [@src.id, locator]` });
      const inlineCitations = extractCitations(visible);
      if (inlineCitations.length === 0) errors.push({ file: relFile, message: 'article body cites no sources; use [@src.id, locator]' });
      parsed.data.datings.forEach((d, i) => {
        for (const n of bceOffByOne(d.range, `${parsed.data.summary} ${d.label ?? ''} ${d.note ?? ''}`)) {
          errors.push({ file: relFile, message: `datings[${i}]: endpoint is written as "${n + 1} BCE" but the text says "${n} BCE"; check which is meant` });
        }
        for (const n of ceOffByOne(d, `${parsed.data.summary} ${d.label ?? ''} ${d.note ?? ''}`)) {
          errors.push({ file: relFile, message: `datings[${i}]: latest is written as "${n - 1} CE" but the text gives ${n} CE (or the century ending then); a CE year needs no BCE-style shift` });
        }
        const mismatch = labelRangeMismatch(d);
        if (mismatch) errors.push({ file: relFile, message: `datings[${i}]: ${mismatch}` });
      });
      articles.push({ ...parsed.data, slug: path.basename(file, '.md'), file: relFile, category, body: content, inlineCitations });
    }
  }

  const correctionFiles: string[] = [];
  for (const correctionsFile of roots.map((r) => path.join(r, 'corrections.yaml')).filter((f) => fs.existsSync(f))) {
    const raw = readYaml(correctionsFile, errors);
    if (raw === undefined || raw === null) continue;
    if (!Array.isArray(raw)) {
      errors.push({ file: rel(correctionsFile), message: 'corrections.yaml must be a list' });
      continue;
    }
    raw.forEach((c, i) => {
      const parsed = CorrectionSchema.safeParse(c);
      if (parsed.success) {
        corrections.push(parsed.data);
        correctionFiles.push(rel(correctionsFile));
      }
      else for (const m of formatZod(parsed.error)) errors.push({ file: rel(correctionsFile), message: `[${i}] ${m}` });
    });
  }
  // Check sources before sorting so each correction keeps its file.
  const correctionSourceChecks = corrections.map((c, i) => ({ c, file: correctionFiles[i] }));
  corrections = [...corrections].sort((a, b) => b.date.localeCompare(a.date));

  // Cross-reference checks.
  const checkSource = (file: string, where: string, id: string) => {
    if (id.startsWith('!invalid:')) errors.push({ file, message: `${where}: malformed citation "${id.slice(9)}"` });
    else if (!sources.has(id)) errors.push({ file, message: `${where}: unknown source ${id}` });
  };

  const { aliases, problems: aliasProblems } = resolveAliases(entities.values());
  for (const p of [...aliasProblems, ...duplicateRelations(entities.values())]) errors.push({ file: entityFile.get(p.id) ?? p.id, message: p.message });
  const unknownEntity = (id: string) => (aliases.has(id) ? `${id} (merged into ${aliases.get(id)}; link to that id)` : id);

  const inbound = new Map<string, { from: string; kind: string }[]>();
  for (const e of entities.values()) {
    const file = entityFile.get(e.id) ?? e.id;
    e.datings.forEach((d, i) => d.sources.forEach((s) => checkSource(file, `datings[${i}]`, citationId(s))));
    e.claims.forEach((c, i) => c.sources.forEach((s) => checkSource(file, `claims[${i}]`, citationId(s))));
    for (const r of e.relations) {
      if (!entities.has(r.target)) errors.push({ file, message: `relation ${r.kind} -> unknown entity ${unknownEntity(r.target)}` });
      else {
        const list = inbound.get(r.target) ?? [];
        list.push({ from: e.id, kind: r.kind });
        inbound.set(r.target, list);
      }
    }
  }

  const articlesByEntity = new Map<string, Article[]>();
  for (const a of articles) {
    const file = a.file;
    a.datings.forEach((d, i) => d.sources.forEach((s) => checkSource(file, `datings[${i}]`, citationId(s))));
    a.inlineCitations.forEach((c) => checkSource(file, 'body', c.id));
    for (const id of a.entities) {
      if (!entities.has(id)) errors.push({ file, message: `unknown entity ${unknownEntity(id)}` });
      const list = articlesByEntity.get(id) ?? [];
      list.push(a);
      articlesByEntity.set(id, list);
    }
  }

  // Internal links in article bodies must reach a live entity or article.
  const articlePaths = new Set(articles.map((a) => `/${a.category}/${a.slug}`));
  for (const a of articles) {
    for (const href of internalLinks(a.body)) {
      const m = /^\/archive\/([a-z]+)\/([a-z0-9-]+)$/.exec(href);
      if (m) {
        const id = `${m[1]}.${m[2]}`;
        if (!entities.has(id)) errors.push({ file: a.file, message: `link ${href} -> unknown entity ${unknownEntity(id)}` });
      } else if (href.startsWith('/archive/') || ((CATEGORIES as readonly string[]).includes(href.split('/')[1]) && !articlePaths.has(href))) {
        errors.push({ file: a.file, message: `link ${href} does not reach an entity or article` });
      }
    }
  }

  correctionSourceChecks.forEach(({ c, file }) => c.sources.forEach((s) => checkSource(file, c.target, citationId(s))));

  for (const p of strays) errors.push({ file: rel(p), message: 'unexpected file: entities and sources must be .yaml, articles must be .md' });

  return { entities, sources, articles, corrections, articlesByEntity, inbound, aliases, errors };
}

let cache: ContentGraph | undefined;

/** Cached loader for build-time use inside Next.js. */
export function loadContent(): ContentGraph {
  if (!cache || process.env.NODE_ENV === 'development') cache = loadContentUncached();
  return cache;
}

/** Throws with every problem listed when content is invalid. Used by the Next.js build. */
export function loadContentOrThrow(): ContentGraph {
  const g = loadContent();
  if (g.errors.length > 0) {
    const lines = g.errors.slice(0, 50).map((e) => `  ${e.file}: ${e.message}`);
    const more = g.errors.length > 50 ? `\n  ...and ${g.errors.length - 50} more` : '';
    throw new Error(`Content validation failed with ${g.errors.length} problem(s):\n${lines.join('\n')}${more}\nRun npm run content:validate`);
  }
  return g;
}
