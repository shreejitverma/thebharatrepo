/** Learning paths: resolving steps against the archive, links and placement in time. */

import type { Article, ContentGraph, LearningPathDoc } from './load';
import type { Entity, LearningStep, QuizQuestion, Source } from './schema';
import { citationId } from './schema';
import { READING_LEVEL_AUDIENCE } from './labels';
import type { YearRange } from '../time';
import { formatRange } from '../time';
import { entityRanges, type SearchDoc } from './debates';
import { entityHref, formatSource, sourceLink } from './kaalchakra';

export function learnHref(p: Pick<LearningPathDoc, 'slug'>): string {
  return `/learn/${p.slug}`;
}

export type ResolvedStep =
  | { kind: 'entity'; step: LearningStep; title: string; href: string; entity: Entity }
  | { kind: 'article'; step: LearningStep; title: string; href: string; article: Article };

/** Steps with their targets. The loader has already rejected unknown references. */
export function resolveSteps(g: Pick<ContentGraph, 'entities' | 'articles'>, p: LearningPathDoc): ResolvedStep[] {
  return p.steps.map((step) => {
    if (step.entity) {
      const entity = g.entities.get(step.entity)!;
      return { kind: 'entity', step, title: step.title ?? entity.names.en, href: entityHref(entity.id), entity };
    }
    const article = g.articles.find((a) => `${a.category}/${a.slug}` === step.article)!;
    return { kind: 'article', step, title: step.title ?? article.title, href: `/${article.category}/${article.slug}`, article };
  });
}

/** Learning paths with a step on this entity. */
export function pathsForEntity(g: Pick<ContentGraph, 'learningPaths'>, entityId: string): LearningPathDoc[] {
  return g.learningPaths.filter((p) => p.steps.some((s) => s.entity === entityId));
}

/** Where a path sits in time: its `focus` when set, else the span of its entity steps' scholarly datings, else its articles' datings. */
export function pathRange(g: Pick<ContentGraph, 'entities' | 'articles'>, p: LearningPathDoc): YearRange | null {
  if (p.focus) return p.focus;
  const steps = resolveSteps(g, p);
  let ranges = steps.flatMap((s) => (s.kind === 'entity' ? entityRanges(s.entity) : []));
  if (!ranges.length) ranges = steps.flatMap((s) => (s.kind === 'article' ? s.article.datings.map((d) => d.range) : []));
  if (!ranges.length) return null;
  return {
    earliest: Math.min(...ranges.map((r) => r.earliest)),
    latest: Math.max(...ranges.map((r) => r.latest)),
    precision: ranges[0].precision,
    circa: ranges.some((r) => r.circa),
  };
}

/** The summary of an entity at a path's level; the loader guarantees it exists for teen and kids paths. */
export function summaryAtLevel(e: Entity, level: LearningPathDoc['level']): string {
  if (level === 'kids') return e.summaries?.kids ?? e.summaries?.teen ?? e.summary;
  if (level === 'teen') return e.summaries?.teen ?? e.summary;
  return e.summary;
}

/** A citation rendered for client components, which cannot receive Source records with zod defaults. */
export interface CitationView {
  text: string;
  href?: string;
}

export function citationViews(sources: Map<string, Source>, refs: QuizQuestion['sources']): CitationView[] {
  return refs.map((ref) => {
    const s = sources.get(citationId(ref));
    const locator = typeof ref === 'string' ? undefined : ref.locator;
    if (!s) return { text: citationId(ref) };
    return { text: `${formatSource(s)}${locator ? `, ${locator}` : ''}`, href: sourceLink(s) };
  });
}

export function learningSearchDocs(g: Pick<ContentGraph, 'learningPaths' | 'entities' | 'articles'>): SearchDoc[] {
  return g.learningPaths.map((p) => {
    const r = pathRange(g, p);
    return {
      href: learnHref(p),
      title: p.title,
      summary: p.summary,
      kind: 'Learning path',
      when: r ? formatRange(r) : '',
      text: [READING_LEVEL_AUDIENCE[p.level], p.audience, ...p.goals, ...p.tags].join(' '),
    };
  });
}
