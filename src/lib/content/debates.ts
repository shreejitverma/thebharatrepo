/**
 * Debate pages: visibility, links and placement in time.
 *
 * Owner rule: a debate page is published only with owner approval. `published: false` debates are
 * validated by content:validate but are excluded from the static build, sitemap, search and every link.
 * DEBATES_PREVIEW=1 at build time renders them for the owner's review, marked as unpublished drafts and
 * set to noindex; that build is local only and never deployed.
 */

import type { ContentGraph, DebateDoc } from './load';
import { isTraditional, type DatingMethod } from './schema';
import { withTraditionMark } from './lens';
import type { YearRange } from '../time';
import { formatRange } from '../time';

export function debatesPreview(): boolean {
  return process.env.DEBATES_PREVIEW === '1';
}

/** A preview build renders unpublished drafts, so it must never be a production or Vercel build. Throws if it would be. */
export function assertPreviewNotDeployed(env: Readonly<Record<string, string | undefined>> = process.env): void {
  if (env.DEBATES_PREVIEW !== '1') return;
  if (env.VERCEL || env.NODE_ENV === 'production') {
    throw new Error('DEBATES_PREVIEW=1 renders unpublished debate drafts and must never be deployed: unset it for a production or Vercel build, and use `npm run dev:debates-preview` to review drafts locally.');
  }
}

/** The debates a build may render: published ones, plus unpublished drafts in a preview build. */
export function visibleDebates(debates: readonly DebateDoc[], preview = debatesPreview()): DebateDoc[] {
  return debates.filter((d) => d.published || preview);
}

/** Only published debates, whatever the build: for search indexes, sitemaps and data exports. */
export function publishedDebates(debates: readonly DebateDoc[]): DebateDoc[] {
  return debates.filter((d) => d.published);
}

export function debateHref(d: Pick<DebateDoc, 'slug'>): string {
  return `/debates/${d.slug}`;
}

/** Visible debates that name this entity among their related entities. */
export function debatesForEntity(g: Pick<ContentGraph, 'debates'>, entityId: string, preview = debatesPreview()): DebateDoc[] {
  return visibleDebates(g.debates, preview).filter((d) => d.relatedEntities.includes(entityId));
}

/** A span of time and the lens it belongs to, for placing a debate or a learning path on the Kaalchakra. */
export interface Placement {
  range: YearRange;
  lens: 'scholarship' | 'tradition';
}

function union(ranges: YearRange[], lens: Placement['lens']): Placement | null {
  if (!ranges.length) return null;
  return {
    range: {
      earliest: Math.min(...ranges.map((r) => r.earliest)),
      latest: Math.max(...ranges.map((r) => r.latest)),
      precision: ranges[0].precision,
      circa: ranges.some((r) => r.circa),
    },
    lens,
  };
}

/**
 * The span of a set of datings by the archive's ordering rule (rankDatings in lens.ts): the scholarly
 * datings when there are any, else the traditional ones, never the two mixed.
 */
export function datingsSpan(datings: readonly { method: DatingMethod; range: YearRange }[]): Placement | null {
  const scholarly = datings.filter((d) => !isTraditional(d.method));
  return scholarly.length ? union(scholarly.map((d) => d.range), 'scholarship') : union(datings.map((d) => d.range), 'tradition');
}

/** The span of several placements under the same rule: scholarship placements when there are any. */
export function spanOf(placements: readonly (Placement | null)[]): Placement | null {
  const all = placements.filter((p): p is Placement => p !== null);
  const scholarly = all.filter((p) => p.lens === 'scholarship');
  return scholarly.length ? union(scholarly.map((p) => p.range), 'scholarship') : union(all.map((p) => p.range), 'tradition');
}

/** One-line label for a placement, marked when it is a traditional reckoning (as datingSummary does). */
export function placementLabel(p: Placement): string {
  return withTraditionMark(formatRange(p.range), p.lens === 'tradition');
}

/**
 * Where a debate sits on the Kaalchakra: the span of the scholarship-lens ranges its positions
 * propose, else the span of its related entities' datings.
 */
export function debatePlacement(g: Pick<ContentGraph, 'entities'>, d: DebateDoc): Placement | null {
  const proposed = d.positions.filter((p) => p.lens === 'scholarship' && p.range).map((p) => p.range!);
  if (proposed.length) return union(proposed, 'scholarship');
  return spanOf(d.relatedEntities.map((id) => (g.entities.get(id) ? datingsSpan(g.entities.get(id)!.datings) : null)));
}

/** Pages of published debates for the search index; drafts never reach the index, even in a preview build. */
export function debateSearchHrefs(g: Pick<ContentGraph, 'debates'>): string[] {
  return publishedDebates(g.debates).map(debateHref);
}
