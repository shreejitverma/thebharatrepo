/**
 * Text normalisation shared by the indexer (SearchIndexMeta, rendered at build time) and the search page
 * (query time). Both sides must fold text identically, or an exact-name lookup silently misses. Client-safe:
 * no node APIs.
 */

/**
 * Pagefind filter holding, for each page, the hash (exactHash) of its normalised title and of each alternate
 * name, the alternate names marked with ALIAS_MARK. It is a lookup key, not a facet: Search queries it by exact
 * value and never shows it in the filter panel or its counts. The mark lets Search put a record whose title is the
 * query before one that only has it as an alternate name ("mahavira" is the Jain teacher's title and the
 * mathematician's IAST name).
 *
 * Hashes, not the keys themselves: with 2,342 pages the filter file is 21.5 KB compressed as hashes and
 * 48.9 KB as text (116 KB unpacked), and every search waits for it. scripts/build-search.ts fails the build
 * if two distinct keys ever share a hash.
 */
export const EXACT_FILTER = 'exact';

/** Prefix of an alternate name's `exact` value. Not a base-36 digit, so it never collides with a title hash. */
export const ALIAS_MARK = '~';

/** Letters NFD does not decompose into a base letter and a mark. */
const FOLD: Record<string, string> = { ß: 'ss', æ: 'ae', œ: 'oe', ø: 'o', ł: 'l', đ: 'd', ð: 'd', þ: 'th', ı: 'i' };

/** Lowercase letters and digits only, diacritics removed, so "Ṛgveda." compares equal to "rgveda". */
export function normaliseWord(w: string): string {
  return w
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[ßæœøłđðþı]/g, (c) => FOLD[c])
    .replace(/[^\p{L}\p{N}]/gu, '');
}

/**
 * The key a title or name is looked up by: lowercase, diacritics folded (IAST to ASCII), punctuation
 * stripped, whitespace collapsed. Hyphens, dashes and slashes separate words, so "Ghaggar-Hakra" and
 * "ghaggar hakra" share a key; other punctuation joins ("Ashoka's" is "ashokas"). A leading "The" is dropped,
 * so "date of the buddha" names the debate "The date of the Buddha" and "the ramayana" names "Ramayana"; a
 * "the" anywhere else, or a title that is only "The", is kept. Returns "" when nothing is left.
 */
export function exactKey(s: string): string {
  const words = s
    .replace(/[\p{Pd}/\\]/gu, ' ')
    .split(/\s+/)
    .map(normaliseWord)
    .filter(Boolean);
  return (words.length > 1 && words[0] === 'the' ? words.slice(1) : words).join(' ');
}

/** Every distinct non-empty key among a page's title and alternate names. */
export function exactKeys(names: (string | null | undefined)[]): string[] {
  return [...new Set(names.map((n) => exactKey(n ?? '')).filter(Boolean))];
}

const encoder = new TextEncoder();

/** 32-bit FNV-1a of a key's UTF-8 bytes, in base 36 (at most 7 characters): the `exact` filter value. */
export function exactHash(key: string): string {
  let h = 0x811c9dc5;
  for (const byte of encoder.encode(key)) {
    h ^= byte;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/** The `exact` value of an alternate name's key: its hash, marked so a lookup can tell it from a title. */
export function aliasValue(hash: string): string {
  return `${ALIAS_MARK}${hash}`;
}

/**
 * The `exact` filter values for a page: the hash of its title's key, then the marked hash of each alternate
 * name whose key differs from the title's. A title with no key (punctuation only) adds no value of its own.
 */
export function exactFilterValues(title: string, names: (string | null | undefined)[] = []): string[] {
  const own = exactKey(title);
  const aliases = exactKeys(names)
    .filter((k) => k !== own)
    .map((k) => aliasValue(exactHash(k)));
  return own ? [exactHash(own), ...aliases] : aliases;
}
