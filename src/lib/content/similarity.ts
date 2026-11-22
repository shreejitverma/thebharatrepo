/** Title matching used to check that a resolved DOI/ISBN/OCLC/URL/QID is the work or thing cited. */

const STOP = new Set(['the', 'and', 'for', 'with', 'from', 'into', 'its', 'their', 'this', 'that', 'der', 'die', 'das', 'les', 'des', 'une', 'von', 'und']);

const ROMAN = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii', 'xiii', 'xiv', 'xv', 'xvi', 'xvii', 'xviii', 'xix', 'xx'];

/**
 * Regnal, volume and part numbers (up to three digits, or Roman numerals I to XX) as decimal strings;
 * null for any other word. Years are ordinary words: subtitles state date ranges inconsistently.
 */
function numeral(t: string): string | null {
  if (/^\d{1,3}$/.test(t)) return String(Number(t));
  const r = ROMAN.indexOf(t);
  return r >= 0 ? String(r + 1) : null;
}

/**
 * Significant words: lower-case, unaccented, without stop words or words of two letters or fewer.
 * Numerals are always significant and written as decimals, so "Vol. VI" and "Vol. 6" agree.
 */
export function normalizeTitle(s: string): string[] {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(?:#\d+|#x[0-9a-f]+|[a-z]+);/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/([a-z])(\d)|(\d)([a-z])/g, '$1$3 $2$4')
    .replace(/isation/g, 'ization')
    .replace(/colour/g, 'color')
    .split(/\s+/)
    .filter((t) => (t.length > 2 || numeral(t) !== null) && !STOP.has(t))
    .map((t) => numeral(t) ?? (t.length > 4 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t));
}

function numerals(s: string): Set<string> {
  return new Set(normalizeTitle(s).filter((t) => /^\d{1,3}$/.test(t)));
}

const subset = (a: Set<string>, b: Set<string>) => [...a].every((t) => b.has(t));

/**
 * Titles that both carry volume or part numbers must agree on them: "Vol. 1" is not "Vol. 2". A record
 * may add numbers (a series number, a chapter number) or omit them, which does not contradict the title.
 */
function titleNumeralsAgree(a: string, b: string): boolean {
  const A = numerals(a);
  const B = numerals(b);
  return A.size === 0 || B.size === 0 || subset(A, B) || subset(B, A);
}

/** Names carry exactly the same regnal numbers: "Chandragupta" is neither "Chandragupta I" nor "Chandragupta II". */
function nameNumeralsAgree(a: string, b: string): boolean {
  const A = numerals(a);
  const B = numerals(b);
  return A.size === B.size && subset(A, B);
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
  return t.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').split(/:|\s[-–]\s|\.\s|,\s/)[0];
}

const SITE_WORDS = new Set(['unesco', 'world', 'heritage', 'centre', 'center', 'list', 'intangible', 'cultural', 'site', 'official', 'website', 'home', 'page', 'google', 'book', 'books', 'jstor']);

/**
 * A title without leading or trailing site segments: "Ajanta Caves - UNESCO World Heritage Centre" is
 * "Ajanta Caves". Only whole segments made of site words go; words inside a title ("A Cultural History
 * of India") always count.
 */
function withoutSiteSegments(t: string): string {
  const parts = t.split(/\s+[-–|:]\s+/);
  const isSite = (part: string) => {
    const words = normalizeTitle(part);
    return words.length > 0 && words.every((w) => SITE_WORDS.has(w));
  };
  while (parts.length > 1 && isSite(parts[parts.length - 1])) parts.pop();
  while (parts.length > 1 && isSite(parts[0])) parts.shift();
  return parts.join(' - ');
}

/** The words of `small` appear in `big` in the same order as one contiguous run. */
function containsRun(small: string[], big: string[]): boolean {
  for (let i = 0; i + small.length <= big.length; i++) if (small.every((w, k) => big[i + k] === w)) return true;
  return false;
}

/**
 * Word overlap of two titles. A title whose words are a strict subset of the other's
 * counts only with at least two words. Two or three must form one contiguous run there (for registry
 * records, the start of the title), so "A History of India" is not "History of the Archaeological
 * Survey of India" and "The Mughal Empire" is not "The Princes of the Mughal Empire". Four or more
 * words all present are too specific to coincide.
 */
function overlap(a: string, b: string, leading: boolean): { A: Set<string>; B: Set<string>; inter: number; subsetOk: boolean } {
  const { A, B, inter } = sets(a, b);
  const dedupe = (t: string) => [...new Set(normalizeTitle(t))];
  const [small, big] = A.size <= B.size ? [dedupe(a), dedupe(b)] : [dedupe(b), dedupe(a)];
  const strictSubset = A.size !== B.size && inter === Math.min(A.size, B.size);
  const placed = leading ? small.every((w, k) => big[k] === w) : containsRun(small, big);
  return { A, B, inter, subsetOk: !strictSubset || small.length >= 4 || (small.length >= 2 && placed) };
}

/** Same word, a one-letter variant, or one half of a compound ("sangita" in "sangitaratnakara"). */
function sameWord(x: string, y: string): boolean {
  if (x === y || nearlyEqual(x, y)) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.length >= 5 && long.includes(short);
}

/**
 * Sibling titles about different subjects. Either the main titles share a word and each swaps in one or
 * two words the other lacks ("Ajanta Caves" vs "Ellora Caves", "Early History of India" vs "Early
 * History of Bengal"), or the main titles are the same and each subtitle names something the other
 * lacks ("Early India: From the Origins to AD 1300" vs "Early India: A Concise History", "Sun Temple,
 * Konarak" vs "Sun Temple, Modhera"). Volume and regnal numerals are checked separately; years count
 * in main titles ("Indian Independence Act 1947" is not "... 1935") but not in subtitles, which state
 * date ranges inconsistently. A looser paraphrase falls through to the overlap test.
 */
function differentSubjects(a: string, b: string): boolean {
  const significant = (t: string) => normalizeTitle(t).filter((w) => numeral(w) === null);
  const missing = (xs: string[], ys: string[]) => xs.filter((x) => !ys.some((y) => sameWord(x, y)));
  const A = significant(mainTitle(a));
  const B = significant(mainTitle(b));
  if (A.length > 0 && A.join(' ') === B.join(' ')) {
    const rest = (t: string) =>
      significant(t.replace(/\([^)]*\)|\[[^\]]*\]/g, ' '))
        .slice(A.length)
        .filter((w) => !/^\d+$/.test(w));
    const subA = rest(a);
    const subB = rest(b);
    return missing(subA, subB).length >= 1 && missing(subB, subA).length >= 1;
  }
  const shares = A.some((x) => B.some((y) => x === y || nearlyEqual(x, y)));
  const onlyA = missing(A, B);
  const onlyB = missing(B, A);
  return shares && onlyA.length >= 1 && onlyA.length <= 2 && onlyB.length >= 1 && onlyB.length <= 2;
}

/**
 * One main title is the other's words with a qualifier put in front, so shared subtitle words cannot lift
 * the narrower title into a match: "The Art of Ancient India: Buddhist, Hindu, Jain" is not "Classical Art
 * and Ancient India". Words added after the first one still pass, since catalogues drop the colon before a
 * subtitle ("Dholavira" and "Dholavira A Harappan City") and carry typos or split formulae inside titles.
 */
function qualifiedMainTitle(a: string, b: string): boolean {
  const A = [...new Set(normalizeTitle(mainTitle(a)))];
  const B = [...new Set(normalizeTitle(mainTitle(b)))];
  if (A.length === 0 || B.length === 0 || A.length === B.length) return false;
  const [small, big] = A.length < B.length ? [A, B] : [B, A];
  return small.every((w) => big.includes(w)) && !small.includes(big[0]);
}

const PACKAGING_WORDS = new Set(['set', 'vols', 'box', 'boxed', 'paperback', 'hardcover', 'hardback', 'edition', 'revised', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth']);
const VOLUME_WORDS = new Set(['volume', 'vol', 'part', 'book']);

/**
 * What everything after the main title names, when it is only a retail packaging or an edition: "packaging"
 * for a set, binding or edition ("The Rigveda: 3-Volume Set", "Hampi (Paperback)", "Third Revised Edition",
 * "Vols. 1-3"), "volume" for a single volume ("The Rigveda, Volume 1", "Part II"), otherwise null.
 */
function editionSubtitle(t: string): 'packaging' | 'volume' | null {
  const words = normalizeTitle(t);
  const main = normalizeTitle(mainTitle(t));
  const sub = words.slice(main.length);
  const named = sub.filter((w) => numeral(w) === null);
  if (main.length === 0 || named.length === 0 || words.slice(0, main.length).join(' ') !== main.join(' ')) return null;
  if (!named.every((w) => PACKAGING_WORDS.has(w) || VOLUME_WORDS.has(w))) return null;
  return named.some((w) => VOLUME_WORDS.has(w)) && !named.some((w) => w === 'set' || w === 'vols') ? 'volume' : 'packaging';
}

/**
 * Two titles with the same main title, one of which only adds a packaging, edition or volume subtitle. A
 * packaging or edition subtitle matches any subtitle on the other side, even under a one-word main title
 * ("India: A History" and "India: Box Set"): the identifier is the primary evidence and this is a sanity
 * check that it resolves to the work. A single-volume subtitle matches only a title that carries the same
 * volume number, so neither an unnumbered work nor another volume matches it.
 */
function sameWorkOtherEdition(cited: string, found: string): boolean {
  const kinds = [editionSubtitle(cited), editionSubtitle(found)];
  if (kinds.every((k) => k === null) || !exact(mainTitle(cited), mainTitle(found))) return false;
  if (!kinds.includes('volume')) return true;
  const A = numerals(cited);
  const B = numerals(found);
  return A.size > 0 && A.size === B.size && subset(A, B);
}

export function sameTitle(citedTitle: string, foundTitle: string): boolean {
  const cited = withoutSiteSegments(citedTitle);
  const found = withoutSiteSegments(foundTitle);
  if (!titleNumeralsAgree(cited, found)) return false;
  if (exact(cited, found)) return true;
  if (sameWorkOtherEdition(cited, found)) return true;
  // A cited main title matches a record that adds a subtitle (and vice versa), if it is at least two words.
  for (const [x, y] of [
    [mainTitle(cited), found],
    [cited, mainTitle(found)],
  ]) {
    if (normalizeTitle(x).length >= 2 && exact(x, y)) return true;
  }
  // A record that only adds a series name in parentheses ("The Jains (Library of Religious Beliefs)").
  if (exact(cited.replace(/\([^)]*\)/g, ' '), found.replace(/\([^)]*\)/g, ' '))) return true;
  if (differentSubjects(cited, found)) return false;
  if (qualifiedMainTitle(cited, found)) return false;
  const { A, B, inter, subsetOk } = overlap(cited, found, true);
  if (Math.min(A.size, B.size) < 2 || inter < 2 || !subsetOk) return false;
  return inter / Math.min(A.size, B.size) >= 0.6 && inter / (A.size + B.size - inter) >= 0.4;
}

/**
 * Web page titles carry site names and section labels, so require the cited title's words to be
 * present (high overlap, at least two shared words) without a Jaccard floor.
 */
export function pageMatchesTitle(citedTitle: string, pageTitle: string): boolean {
  const cited = withoutSiteSegments(citedTitle);
  const pageText = withoutSiteSegments(pageTitle);
  if (exact(cited, pageText)) return true;
  if (!subset(numerals(cited), numerals(pageText))) return false;
  if (differentSubjects(cited, pageText)) return false;
  const { A, inter, subsetOk } = overlap(cited, pageText, false);
  if (A.size === 0 || !subsetOk) return false;
  return inter >= Math.min(2, A.size) && inter / A.size >= 0.6;
}

/** A URL that names a catalogue record (an archive.org item or an Open Library edition or work), or null. */
export function registryRecord(url: string): { site: 'archive.org'; id: string } | { site: 'openlibrary.org'; path: string } | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const ia = /^\/details\/([^/?#]+)/.exec(u.pathname);
  if (u.hostname.endsWith('archive.org') && ia) return { site: 'archive.org', id: ia[1] };
  const ol = /^\/(works|books)\/(OL\w+)/.exec(u.pathname);
  if (u.hostname.endsWith('openlibrary.org') && ol) return { site: 'openlibrary.org', path: `${ol[1]}/${ol[2]}` };
  return null;
}

/** How a URL's title is judged: catalogue records as registry titles, anything else as a web page. */
export function urlMatchKind(url: string): 'record' | 'page' {
  return registryRecord(url) ? 'record' : 'page';
}

/**
 * A registry or page title identifies the cited work. One rule for the live check and the offline
 * recheck: registry records (DOI, ISBN, OCLC, catalogue URLs) must be the same title; a web page must
 * carry the cited title among its site text or be titled with the cited main title.
 */
export function cachedTitleMatches(kind: 'record' | 'page', cited: string, matched: string): boolean {
  return kind === 'record' ? sameTitle(cited, matched) : pageMatchesTitle(cited, matched) || sameTitle(cited, matched);
}

/**
 * Wikidata label or alias identifies the entity: exact normalised match, Jaccard >= 0.6, or a label of
 * two or more significant words that all appear in the entity name ("Cemetery H culture" for
 * "Cemetery H Culture (Late Harappan Punjab)"). A one-word label never matches a longer name, so
 * "zebu" does not identify "Domestication of Zebu Cattle". Regnal and ordinal numbers must be identical,
 * so "Chandragupta I" never identifies "Chandragupta II" and "Chandragupta" identifies neither.
 */
export function sameName(names: string[], labels: string[], opts: { namedThing?: boolean } = {}): boolean {
  return labels.some((l) =>
    names.some((n) => {
      if (!nameNumeralsAgree(n, l)) return false;
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

/**
 * One edit or one adjacent transposition apart, for words of six or more letters (Hastinapur vs
 * Hastinapura, Sanskirt vs Sanskrit).
 */
function nearlyEqual(a: string, b: string): boolean {
  if (Math.min(a.length, b.length) < 6 || Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const diff = [...a].flatMap((c, k) => (c === b[k] ? [] : [k]));
    if (diff.length === 2 && diff[1] === diff[0] + 1 && a[diff[0]] === b[diff[1]] && a[diff[1]] === b[diff[0]]) return true;
  }
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
