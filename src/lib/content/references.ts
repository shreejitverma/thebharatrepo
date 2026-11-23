/**
 * The references system: numbered, deduplicated reference lists for articles, the reverse index of
 * everything that cites a source, and the evidence-grade summary shown at the top of an article.
 *
 * Pure functions over the content graph, so the build and the unit tests share one implementation.
 */

import { GRADES, isTraditional, type DatingMethod, type Grade } from './labels';
import { rankDatings } from './lens';
import { citationId, type CitationRef, type Claim, type Correction, type Dating, type Entity } from './schema';
import type { Article, DebateDoc, LearningPathDoc } from './load';
import { publishedDebates } from './debates';

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

export interface QuizCitation {
  path: LearningPathDoc;
  /** The quiz questions whose answers the source supports, in quiz order. */
  questions: { id: string; question: string; locator?: string }[];
}

/** Where in a debate a source is cited: the common ground, or one position (its evidence or a proponent's own work). */
export interface DebateContext {
  /** The position id, which is also its fragment on the debate page; null for the common ground. */
  position: string | null;
  label: string;
  locators: string[];
}

export interface DebateCitation {
  debate: DebateDoc;
  contexts: DebateContext[];
}

export interface CitedBy {
  entities: EntityCitation[];
  articles: ArticleCitation[];
  corrections: CorrectionCitation[];
  /** Learning paths whose quizzes cite the source. */
  quizzes: QuizCitation[];
  /** Published debates only: a draft is never shown, linked or counted, whatever the build. */
  debates: DebateCitation[];
}

export function emptyCitedBy(): CitedBy {
  return { entities: [], articles: [], corrections: [], quizzes: [], debates: [] };
}

export function citedByCount(c: CitedBy | undefined): number {
  return c ? c.entities.length + c.articles.length + c.corrections.length + c.quizzes.length + c.debates.length : 0;
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

/**
 * Every entity, article, correction, learning-path quiz and published debate citing each source id.
 * Lists are sorted for display. Unpublished debates are left out here, so no page, preview or count can show them.
 */
export function buildCitationIndex(g: {
  entities: Map<string, Entity>;
  articles: Article[];
  corrections: Correction[];
  learningPaths?: readonly LearningPathDoc[];
  debates?: readonly DebateDoc[];
}): Map<string, CitedBy> {
  const index = new Map<string, CitedBy>();
  const slot = (id: string) => {
    let c = index.get(id);
    if (!c) {
      c = emptyCitedBy();
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

  for (const path of g.learningPaths ?? []) {
    const perSource = new Map<string, QuizCitation['questions']>();
    for (const q of path.quiz) {
      const seen = new Set<string>();
      for (const ref of q.sources) {
        const use = toCitationUse(ref);
        if (seen.has(use.id)) continue;
        seen.add(use.id);
        (perSource.get(use.id) ?? perSource.set(use.id, []).get(use.id)!).push({ id: q.id, question: q.question, locator: use.locator });
      }
    }
    for (const [id, questions] of perSource) slot(id).quizzes.push({ path, questions });
  }

  for (const debate of publishedDebates(g.debates ?? [])) {
    const perSource = new Map<string, DebateContext[]>();
    const add = (ref: CitationRef, position: string | null, label: string) => {
      const use = toCitationUse(ref);
      const contexts = perSource.get(use.id) ?? perSource.set(use.id, []).get(use.id)!;
      let ctx = contexts.find((c) => c.position === position);
      if (!ctx) {
        ctx = { position, label, locators: [] };
        contexts.push(ctx);
      }
      const locator = use.locator ? normalizeLocator(use.locator) : '';
      if (locator && !ctx.locators.some((l) => locatorKey(l) === locatorKey(locator))) ctx.locators.push(locator);
    };
    for (const ev of debate.commonGround) for (const ref of ev.sources) add(ref, null, 'What every position accepts');
    for (const p of debate.positions) {
      for (const pr of p.proponents) if (pr.work) add(pr.work, p.id, p.label);
      for (const ev of p.evidence) for (const ref of ev.sources) add(ref, p.id, p.label);
    }
    for (const [id, contexts] of perSource) slot(id).debates.push({ debate, contexts });
  }

  for (const c of index.values()) {
    c.entities.sort((x, y) => x.entity.names.en.localeCompare(y.entity.names.en));
    c.articles.sort((x, y) => x.article.title.localeCompare(y.article.title));
    c.quizzes.sort((x, y) => x.path.title.localeCompare(y.path.title) || x.path.slug.localeCompare(y.path.slug));
    c.debates.sort((x, y) => x.debate.title.localeCompare(y.debate.title));
  }
  return index;
}

// ---------- Evidence-grade summary for an article ----------

export interface GradeSummary {
  /** The article's own datings, scholarship first and then by grade (rankDatings); the first stands for the article. */
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
    datings: rankDatings(article.datings, (d) => isTraditional(d.method)).map((d) => ({ grade: d.grade, method: d.method, range: d.range })),
    counts,
    total: GRADES.reduce((n, g) => n + counts[g], 0),
    records,
  };
}
