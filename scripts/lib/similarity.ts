/** Token-overlap similarity used to check that a resolved DOI/ISBN/QID matches the cited work. */

const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'into', 'its', 'their', 'this', 'that', 'der', 'die', 'das', 'les', 'des', 'une']);

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

/** Overlap coefficient |A n B| / min(|A|, |B|), in [0, 1]. Robust to missing subtitles. */
export function titleSimilarity(a: string, b: string): number {
  const A = new Set(normalizeTitle(a));
  const B = new Set(normalizeTitle(b));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.min(A.size, B.size);
}
