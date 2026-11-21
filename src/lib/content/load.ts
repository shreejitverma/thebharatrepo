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
import type { z } from 'zod';
import {
  ArticleFrontmatterSchema,
  CATEGORIES,
  CorrectionSchema,
  EntitySchema,
  SourceSchema,
  citationId,
  type ArticleFrontmatter,
  type Correction,
  type Entity,
  type Source,
} from './schema';

export interface Article extends ArticleFrontmatter {
  slug: string;
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

function walk(dir: string, ext: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p, ext));
    else if (entry.isFile() && entry.name.endsWith(ext)) out.push(p);
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
    if (sources.has(parsed.data.id)) errors.push({ file: rel(file), message: `duplicate source id ${parsed.data.id}` });
    sources.set(parsed.data.id, parsed.data);
  }

  for (const file of roots.flatMap((r) => walk(path.join(r, 'entities'), '.yaml'))) {
    const raw = readYaml(file, errors);
    if (raw === undefined) continue;
    const parsed = EntitySchema.safeParse(raw);
    if (!parsed.success) {
      for (const m of formatZod(parsed.error)) errors.push({ file: rel(file), message: m });
      continue;
    }
    const e = parsed.data;
    const expected = `${path.basename(path.dirname(file))}.${path.basename(file, '.yaml')}`;
    if (e.id !== expected) errors.push({ file: rel(file), message: `id ${e.id} must match path (${expected})` });
    if (entities.has(e.id)) errors.push({ file: rel(file), message: `duplicate entity id ${e.id}` });
    entities.set(e.id, e);
  }

  for (const category of artDir ? CATEGORIES : []) {
    for (const file of walk(path.join(artDir!, category), '.md')) {
      const { data, content } = matter(fs.readFileSync(file, 'utf8'));
      const parsed = ArticleFrontmatterSchema.safeParse(data);
      if (!parsed.success) {
        for (const m of formatZod(parsed.error)) errors.push({ file: rel(file), message: m });
        continue;
      }
      const inlineCitations = extractCitations(content);
      if (inlineCitations.length === 0) errors.push({ file: rel(file), message: 'article body cites no sources; use [@src.id, locator]' });
      articles.push({ ...parsed.data, slug: path.basename(file, '.md'), category, body: content, inlineCitations });
    }
  }

  for (const correctionsFile of roots.map((r) => path.join(r, 'corrections.yaml')).filter((f) => fs.existsSync(f))) {
    const raw = readYaml(correctionsFile, errors);
    if (raw === undefined || raw === null) continue;
    if (!Array.isArray(raw)) {
      errors.push({ file: rel(correctionsFile), message: 'corrections.yaml must be a list' });
      continue;
    }
    raw.forEach((c, i) => {
      const parsed = CorrectionSchema.safeParse(c);
      if (parsed.success) corrections.push(parsed.data);
      else for (const m of formatZod(parsed.error)) errors.push({ file: rel(correctionsFile), message: `[${i}] ${m}` });
    });
  }
  corrections = corrections.sort((a, b) => b.date.localeCompare(a.date));

  // Cross-reference checks.
  const checkSource = (file: string, where: string, id: string) => {
    if (id.startsWith('!invalid:')) errors.push({ file, message: `${where}: malformed citation "${id.slice(9)}"` });
    else if (!sources.has(id)) errors.push({ file, message: `${where}: unknown source ${id}` });
  };

  const entityFile = new Map<string, string>();
  for (const file of roots.flatMap((r) => walk(path.join(r, 'entities'), '.yaml'))) {
    entityFile.set(`${path.basename(path.dirname(file))}.${path.basename(file, '.yaml')}`, rel(file));
  }
  const inbound = new Map<string, { from: string; kind: string }[]>();
  for (const e of entities.values()) {
    const file = entityFile.get(e.id) ?? e.id;
    e.datings.forEach((d, i) => d.sources.forEach((s) => checkSource(file, `datings[${i}]`, citationId(s))));
    e.claims.forEach((c, i) => c.sources.forEach((s) => checkSource(file, `claims[${i}]`, citationId(s))));
    for (const r of e.relations) {
      if (!entities.has(r.target)) errors.push({ file, message: `relation ${r.kind} -> unknown entity ${r.target}` });
      else {
        const list = inbound.get(r.target) ?? [];
        list.push({ from: e.id, kind: r.kind });
        inbound.set(r.target, list);
      }
    }
  }

  const articlesByEntity = new Map<string, Article[]>();
  for (const a of articles) {
    const file = `_content/${a.category}/${a.slug}.md`;
    a.datings.forEach((d, i) => d.sources.forEach((s) => checkSource(file, `datings[${i}]`, citationId(s))));
    a.inlineCitations.forEach((c) => checkSource(file, 'body', c.id));
    for (const id of a.entities) {
      if (!entities.has(id)) errors.push({ file, message: `unknown entity ${id}` });
      const list = articlesByEntity.get(id) ?? [];
      list.push(a);
      articlesByEntity.set(id, list);
    }
  }

  corrections.forEach((c, i) => c.sources.forEach((s) => checkSource('corrections.yaml', `[${i}] ${c.target}`, citationId(s))));

  return { entities, sources, articles, corrections, articlesByEntity, inbound, errors };
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
