/** Title matching used to check that a resolved DOI/ISBN/OCLC/URL/QID is the work or thing cited. */

const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'into', 'its', 'their', 'this', 'that', 'der', 'die', 'das', 'les', 'des', 'une', 'von', 'und']);

export function normalizeTitle(s: string): string[] {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/isation/g, 'ization')
    .replace(/colour/g, 'color')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP.has(t))
    .map((t) => (t.length > 4 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t));
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
function mainTitle(t: string): string {
  return t.replace(/\([^)]*\)/g, ' ').split(/:|\s[-–]\s|\.\s|,\s/)[0];
}

export function sameTitle(cited: string, found: string): boolean {
  if (exact(cited, found)) return true;
  // A cited main title matches a record that adds a subtitle (and vice versa), if it is at least two words.
  for (const [x, y] of [
    [mainTitle(cited), found],
    [cited, mainTitle(found)],
    [mainTitle(cited), mainTitle(found)],
  ]) {
    if (normalizeTitle(x).length >= 2 && exact(x, y)) return true;
  }
  // A record that only adds a series name in parentheses ("The Jains (Library of Religious Beliefs)").
  if (exact(cited.replace(/\([^)]*\)/g, ' '), found.replace(/\([^)]*\)/g, ' '))) return true;
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

/**
 * Wikidata label or alias identifies the entity: exact normalised match, Jaccard >= 0.6, or a label of
 * two or more significant words that all appear in the entity name ("Cemetery H culture" for
 * "Cemetery H Culture (Late Harappan Punjab)"). A one-word label never matches a longer name, so
 * "zebu" does not identify "Domestication of Zebu Cattle".
 */
export function sameName(names: string[], labels: string[], opts: { namedThing?: boolean } = {}): boolean {
  return labels.some((l) =>
    names.some((n) => {
      if (exact(n, l)) return true;
      const { A, B, inter } = sets(n, l);
      if (jaccard(n, l) >= 0.6 && inter >= 1) return true;
      if (B.size >= 2 && inter === B.size && A.size >= B.size) return true;
      // Sites, people, polities and texts are named things: "Mehrgarh" identifies
      // "Mehrgarh Neolithic and Chalcolithic Site", allowing a one-letter spelling variant.
      const GENERIC = new Set(['archaeological', 'ancient', 'site', 'settlement', 'ruin', 'mound']);
      const core = [...B].filter((t) => !GENERIC.has(t));
      if (opts.namedThing && core.length >= 1 && core.every((t) => [...A].some((a) => a === t || nearlyEqual(a, t)))) return true;
      return false;
    }),
  );
}

/** Levenshtein distance <= 1 for words of six or more letters (Hastinapur vs Hastinapura). */
function nearlyEqual(a: string, b: string): boolean {
  if (Math.min(a.length, b.length) < 6 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
