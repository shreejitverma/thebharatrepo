/**
 * The references system: numbered, deduplicated reference lists for articles, the reverse index of
 * everything that cites a source, and the evidence-grade summary shown at the top of an article.
 *
 * Pure functions over the content graph, so the build and the unit tests share one implementation.
 */

import { GRADES, type DatingMethod, type Grade } from './labels';
import { citationId, type CitationRef, type Claim, type Correction, type Dating, type Entity } from './schema';
import type { Article } from './load';

export interface CitationUse {
  id: string;
  locator?: string;
}

export interface Reference {
  /** 1-based reference number, in order of first use. */
  n: number;
  id: string;
  /** Distinct locators in order of first use (compared ignoring case and whitespace). */
  locators: string[];
  /** 1-based positions of each in-text use, matching the `cite-<k>` anchors; empty when only a dating cites it. */
  uses: number[];
  /** True when the article's own frontmatter dating cites this source. */
  dating: boolean;
}

/** Collapses internal whitespace and trims; locators are otherwise kept exactly as written. */
export function normalizeLocator(locator: string): string {
  return locator.replace(/\s+/g, ' ').trim();
}

function locatorKey(locator: string): string {
  return normalizeLocator(locator).toLowerCase();
}

export function toCitationUse(ref: CitationRef): CitationUse {
  return typeof ref === 'string' ? { id: ref } : { id: ref.id, locator: ref.locator };
}

/**
 * Numbers sources by first in-text use, then appends sources cited only by the article's datings.
 * One entry per source; repeated citations add their locator (once) and their use position.
 */
export function buildReferences(inline: CitationUse[], dating: CitationUse[] = []): Reference[] {
  const byId = new Map<string, Reference>();
  const seenLocators = new Map<string, Set<string>>();
  const add = (c: CitationUse, use: number | null) => {
    let ref = byId.get(c.id);
    if (!ref) {
      ref = { n: byId.size + 1, id: c.id, locators: [], uses: [], dating: false };
      byId.set(c.id, ref);
      seenLocators.set(c.id, new Set());
    }
    if (use === null) ref.dating = true;
    else ref.uses.push(use);
    if (c.locator && normalizeLocator(c.locator)) {
      const seen = seenLocators.get(c.id)!;
      const key = locatorKey(c.locator);
      if (!seen.has(key)) {
        seen.add(key);
        ref.locators.push(normalizeLocator(c.locator));
      }
    }
  };
  inline.forEach((c, i) => add(c, i + 1));
  dating.forEach((c) => add(c, null));
  return [...byId.values()];
}

/** Letters for back-links from a reference to each of its uses: a, b, ..., z, aa, ab, ... */
export function backlinkLabel(i: number): string {
  let n = i;
  let s = '';
  do {
    s = String.fromCharCode(97 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

// ---------- Reverse index: what cites each source ----------

export type EntityContext = { kind: 'dating'; index: number; dating: Dating; locator?: string } | { kind: 'claim'; index: number; claim: Claim; locator?: string };

export interface EntityCitation {
  entity: Entity;
  contexts: EntityContext[];
}

export interface ArticleCitation {
  article: Article;
  /** Number of in-text uses. */
  inText: number;
  dating: boolean;
  locators: string[];
}

export interface CorrectionCitation {
  correction: Correction;
  anchor: string;
  locator?: string;
}

export interface CitedBy {
  entities: EntityCitation[];
  articles: ArticleCitation[];
  corrections: CorrectionCitation[];
}

export function citedByCount(c: CitedBy | undefined): number {
  return c ? c.entities.length + c.articles.length + c.corrections.length : 0;
}

/** 32-bit FNV-1a, hex. Stable across builds and platforms. */
function fnv1a(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Stable fragment ids for the corrections log, one per correction in the given order.
 * Derived from the correction's content, so adding a correction never moves another one's anchor.
 */
export function correctionAnchors(corrections: Correction[]): string[] {
  const used = new Map<string, number>();
  return corrections.map((c) => {
    const target = c.target.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const base = `correction-${c.date}-${target}-${fnv1a(`${c.before}\n${c.after}`).slice(0, 6)}`;
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  });
}

/** Every entity, article and correction citing each source id. Lists are sorted for display. */
export function buildCitationIndex(g: { entities: Map<string, Entity>; articles: Article[]; corrections: Correction[] }): Map<string, CitedBy> {
  const index = new Map<string, CitedBy>();
  const slot = (id: string) => {
    let c = index.get(id);
    if (!c) {
      c = { entities: [], articles: [], corrections: [] };
      index.set(id, c);
    }
    return c;
  };

  for (const e of g.entities.values()) {
    const perSource = new Map<string, EntityContext[]>();
    const push = (id: string, ctx: EntityContext) => (perSource.get(id) ?? perSource.set(id, []).get(id)!).push(ctx);
    e.datings.forEach((d, i) => d.sources.forEach((s) => push(citationId(s), { kind: 'dating', index: i, dating: d, locator: toCitationUse(s).locator })));
    e.claims.forEach((c, i) => c.sources.forEach((s) => push(citationId(s), { kind: 'claim', index: i, claim: c, locator: toCitationUse(s).locator })));
    for (const [id, contexts] of perSource) slot(id).entities.push({ entity: e, contexts });
  }

  for (const a of g.articles) {
    const refs = buildReferences(
      a.inlineCitations,
      a.datings.flatMap((d) => d.sources.map(toCitationUse)),
    );
    for (const r of refs) slot(r.id).articles.push({ article: a, inText: r.uses.length, dating: r.dating, locators: r.locators });
  }

  const anchors = correctionAnchors(g.corrections);
  g.corrections.forEach((c, i) => {
    const seen = new Set<string>();
    for (const ref of c.sources) {
      const use = toCitationUse(ref);
      if (seen.has(use.id)) continue;
      seen.add(use.id);
      slot(use.id).corrections.push({ correction: c, anchor: anchors[i], locator: use.locator });
    }
  });

  for (const c of index.values()) {
    c.entities.sort((x, y) => x.entity.names.en.localeCompare(y.entity.names.en));
    c.articles.sort((x, y) => x.article.title.localeCompare(y.article.title));
  }
  return index;
}

// ---------- Evidence-grade summary for an article ----------

export interface GradeSummary {
  /** The article's own datings, in authored order. */
  datings: { grade: Grade; method: DatingMethod; range: Dating['range'] }[];
  /** Graded datings and claims across the archive records the article links to. */
  counts: Record<Grade, number>;
  total: number;
  /** Linked archive records that exist. */
  records: number;
}

export function articleGradeSummary(article: Pick<Article, 'datings' | 'entities'>, entities: Map<string, Entity>): GradeSummary {
  const counts = Object.fromEntries(GRADES.map((g) => [g, 0])) as Record<Grade, number>;
  let records = 0;
  for (const id of new Set(article.entities)) {
    const e = entities.get(id);
    if (!e) continue;
    records++;
    for (const d of e.datings) counts[d.grade]++;
    for (const c of e.claims) counts[c.grade]++;
  }
  return {
    datings: article.datings.map((d) => ({ grade: d.grade, method: d.method, range: d.range })),
    counts,
    total: GRADES.reduce((n, g) => n + counts[g], 0),
    records,
  };
}
