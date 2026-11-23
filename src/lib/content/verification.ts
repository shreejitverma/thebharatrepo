/** Read-only access to the committed verification cache (content/verification.json). */

import fs from 'node:fs';
import path from 'node:path';
import type { Source } from './schema';

export interface VerifiedImage {
  thumb: string;
  width: number;
  height: number;
  pageUrl: string;
  license: string;
  artist: string;
}

let cache: Record<string, { ok: boolean; thumb?: string; thumbWidth?: number; thumbHeight?: number; pageUrl?: string; license?: string; artist?: string }> | undefined;

function load() {
  if (!cache) {
    const file = path.join(process.cwd(), 'content', 'verification.json');
    cache = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  }
  return cache!;
}

/** Only images that passed verification are ever rendered. */
export function verifiedImage(commonsFile: string): VerifiedImage | null {
  const hit = load()[`commons:${commonsFile}`];
  if (!hit?.ok || !hit.thumb || !hit.pageUrl || !hit.thumbWidth || !hit.thumbHeight) return null;
  if (!/^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(hit.thumb) || !hit.pageUrl.startsWith('https://commons.wikimedia.org/')) return null;
  return { thumb: hit.thumb.split('?')[0], width: hit.thumbWidth, height: hit.thumbHeight, pageUrl: hit.pageUrl, license: hit.license ?? 'unknown', artist: hit.artist ?? '' };
}

export interface SourceIdentifier {
  kind: 'DOI' | 'ISBN' | 'OCLC' | 'URL';
  value: string;
  /** Present only when the identifier has a cached verification success that the build gate checked. */
  href?: string;
}

/** Cache keys written by scripts/content-verify-sources.ts. */
function cacheKey(kind: SourceIdentifier['kind'], value: string): string {
  return kind === 'DOI' ? `doi:${value.toLowerCase()}` : kind === 'ISBN' ? `isbn:${value}` : kind === 'OCLC' ? `oclc:${value}` : `url:${value}`;
}

/**
 * A source's identifiers in link-preference order. Each is linked only when it is verified: the
 * verification gate checks DOI, ISBN and OCLC, and a URL only when it is the source's sole identifier,
 * so a URL next to a DOI or ISBN is shown unlinked.
 */
export function sourceIdentifiers(s: Source): SourceIdentifier[] {
  const ids: SourceIdentifier[] = [];
  const verified = (kind: SourceIdentifier['kind'], value: string) => load()[cacheKey(kind, value)]?.ok === true;
  if (s.doi) ids.push({ kind: 'DOI', value: s.doi, href: verified('DOI', s.doi) ? `https://doi.org/${s.doi}` : undefined });
  if (s.isbn) ids.push({ kind: 'ISBN', value: s.isbn, href: verified('ISBN', s.isbn) ? `https://openlibrary.org/isbn/${s.isbn}` : undefined });
  if (s.oclc) ids.push({ kind: 'OCLC', value: s.oclc, href: verified('OCLC', s.oclc) ? `https://search.worldcat.org/title/${s.oclc}` : undefined });
  if (s.url) ids.push({ kind: 'URL', value: s.url, href: !s.doi && !s.isbn && !s.oclc && verified('URL', s.url) ? s.url : undefined });
  return ids;
}

/** The first verified identifier link, matching sourceLink() whenever the build gate has passed. */
export function verifiedSourceLink(s: Source): string | undefined {
  return sourceIdentifiers(s).find((i) => i.href)?.href;
}
