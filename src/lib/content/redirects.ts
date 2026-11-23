/**
 * Permanent redirects for entities merged into another one and for renamed sources. The single source of truth
 * is the `aliases` field on the surviving entity or source; next.config.ts turns these into 308 redirects, which
 * Vercel serves at the edge.
 */

import { entityHref, sourceHref } from './kaalchakra';

export interface AliasRedirect {
  source: string;
  destination: string;
  permanent: true;
  has?: { type: 'query'; key: string; value: string }[];
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Redirects for every alias: the archive page and the Kaalchakra deep link (?id=<alias>). */
export function aliasRedirects(aliases: ReadonlyMap<string, string>): AliasRedirect[] {
  return [...aliases]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([from, to]) => [
      { source: entityHref(from), destination: entityHref(to), permanent: true as const },
      {
        source: '/kaalchakra',
        // Next.js anchors `has` values as a full-match regular expression, so the id's dots are escaped.
        has: [{ type: 'query' as const, key: 'id', value: escapeRegExp(from) }],
        destination: `/kaalchakra?id=${encodeURIComponent(to)}`,
        permanent: true as const,
      },
    ]);
}

/** Redirects for every former source id: its source page. */
export function sourceAliasRedirects(aliases: ReadonlyMap<string, string>): AliasRedirect[] {
  return [...aliases].sort(([a], [b]) => a.localeCompare(b)).map(([from, to]) => ({ source: sourceHref(from), destination: sourceHref(to), permanent: true as const }));
}
