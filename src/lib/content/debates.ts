/**
 * Debate pages: visibility, links and placement in time.
 *
 * Owner rule: a debate page is published only with owner approval. `published: false` debates are
 * validated by content:validate but are excluded from the static build, sitemap, search and every link.
 * DEBATES_PREVIEW=1 at build time renders them for the owner's review, marked as unpublished drafts and
 * set to noindex; that build is local only and never deployed.
 */

import type { ContentGraph, DebateDoc } from './load';
import { isTraditional, type Entity } from './schema';
import type { YearRange } from '../time';
import { formatRange } from '../time';

export function debatesPreview(): boolean {
  return process.env.DEBATES_PREVIEW === '1';
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

function union(ranges: YearRange[]): YearRange | null {
  if (!ranges.length) return null;
  return {
    earliest: Math.min(...ranges.map((r) => r.earliest)),
    latest: Math.max(...ranges.map((r) => r.latest)),
    precision: ranges[0].precision,
    circa: ranges.some((r) => r.circa),
  };
}

/** Scholarly datings of an entity, or its traditional ones when it has no scholarly dating. */
export function entityRanges(e: Entity): YearRange[] {
  const scholarly = e.datings.filter((d) => !isTraditional(d.method));
  return (scholarly.length ? scholarly : e.datings).map((d) => d.range);
}

/**
 * Where a debate sits on the Kaalchakra: the span of the scholarship-lens ranges its positions
 * propose, else the span of its related entities' scholarly datings.
 */
export function debateRange(g: Pick<ContentGraph, 'entities'>, d: DebateDoc): YearRange | null {
  const proposed = d.positions.filter((p) => p.lens === 'scholarship' && p.range).map((p) => p.range!);
  if (proposed.length) return union(proposed);
  return union(d.relatedEntities.flatMap((id) => (g.entities.get(id) ? entityRanges(g.entities.get(id)!) : [])));
}

export interface SearchDoc {
  href: string;
  title: string;
  summary: string;
  kind: string;
  when: string;
  text: string;
}

/** Search documents for published debates only; drafts never reach the index, even in a preview build. */
export function debateSearchDocs(g: Pick<ContentGraph, 'debates' | 'entities'>): SearchDoc[] {
  return publishedDebates(g.debates).map((d) => {
    const r = debateRange(g, d);
    return {
      href: debateHref(d),
      title: d.title,
      summary: d.summary,
      kind: 'Debate',
      when: r ? formatRange(r) : '',
      text: [d.question, ...d.positions.map((p) => `${p.label} ${p.proponents.map((x) => x.name).join(' ')}`), ...d.tags].join(' '),
    };
  });
}
