/** Title matching used to check that a resolved DOI/ISBN/OCLC/URL/QID is the work or thing cited. */

const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'into', 'its', 'their', 'this', 'that', 'der', 'die', 'das', 'les', 'des', 'une', 'von', 'und']);

export function normalizeTitle(s: string): string[] {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t));
}

function sets(a: string, b: string) {
  const A = new Set(normalizeTitle(a));
  const B = new Set(normalizeTitle(b));
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return { A, B, inter };
}

/** Overlap coefficient |A n B| / min(|A|, |B|), in [0, 1]. */
export function titleSimilarity(a: string, b: string): number {
  const { A, B, inter } = sets(a, b);
  if (A.size === 0 || B.size === 0) return 0;
  return inter / Math.min(A.size, B.size);
}

/** Jaccard |A n B| / |A u B|, in [0, 1]. */
export function jaccard(a: string, b: string): number {
  const { A, B, inter } = sets(a, b);
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

function exact(a: string, b: string): boolean {
  const x = normalizeTitle(a).join(' ');
  return x.length > 0 && x === normalizeTitle(b).join(' ');
}

/**
 * The resolved record is the cited work: identical after normalisation, or sharing at least two
 * significant words with high overlap and Jaccard. A subtitle may be missing on either side, but a
 * title that is merely a subset of a much longer one (e.g. "India" vs "Early India") does not pass.
 */
export function sameTitle(cited: string, found: string): boolean {
  if (exact(cited, found)) return true;
  const { A, B, inter } = sets(cited, found);
  if (Math.min(A.size, B.size) < 2) return false;
  return inter >= 2 && titleSimilarity(cited, found) >= 0.6 && jaccard(cited, found) >= 0.4;
}

/**
 * Web page titles carry site names and section labels, so require the cited title's words to be
 * present (high overlap, at least two shared words) without a Jaccard floor.
 */
export function pageMatchesTitle(cited: string, pageText: string): boolean {
  if (exact(cited, pageText)) return true;
  const { A, inter } = sets(cited, pageText);
  if (A.size === 0) return false;
  return inter >= Math.min(2, A.size) && inter / A.size >= 0.6;
}

/** Wikidata label or alias identifies the entity: exact normalised match, or Jaccard >= 0.6. */
export function sameName(names: string[], labels: string[]): boolean {
  return labels.some((l) => names.some((n) => exact(n, l) || (jaccard(n, l) >= 0.6 && sets(n, l).inter >= 1)));
}
