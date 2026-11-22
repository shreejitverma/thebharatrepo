/** Learning paths: resolving steps against the archive, links and placement in time. */

import type { Article, ContentGraph, LearningPathDoc } from './load';
import type { Entity, LearningStep, QuizQuestion, Source } from './schema';
import { citationId } from './schema';
import { datingsSpan, spanOf, type Placement } from './debates';
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

/**
 * Where a path sits in time: its `focus` when set (a scholarship-lens span, see STYLE.md section 12), else
 * the span of its entity steps' datings, else of its articles' datings, scholarship before tradition.
 */
export function pathPlacement(g: Pick<ContentGraph, 'entities' | 'articles'>, p: LearningPathDoc): Placement | null {
  if (p.focus) return { range: p.focus, lens: 'scholarship' };
  const steps = resolveSteps(g, p);
  return (
    spanOf(steps.map((s) => (s.kind === 'entity' ? datingsSpan(s.entity.datings) : null))) ??
    spanOf(steps.map((s) => (s.kind === 'article' ? datingsSpan(s.article.datings) : null)))
  );
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

/** Pages of learning paths for the search index. */
export function learningSearchHrefs(g: Pick<ContentGraph, 'learningPaths'>): string[] {
  return g.learningPaths.map(learnHref);
}
