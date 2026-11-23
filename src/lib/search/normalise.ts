/**
 * Text normalisation shared by the indexer (SearchIndexMeta, rendered at build time) and the search page
 * (query time). Both sides must fold text identically, or an exact-name lookup silently misses. Client-safe:
 * no node APIs.
 */

/**
 * Pagefind filter holding, for each page, the hash (exactHash) of its normalised title and of each alternate
 * name. It is a lookup key, not a facet: Search queries it by exact value and never shows it in the filter
 * panel or its counts.
 *
 * Hashes, not the keys themselves: with 2,342 pages the filter file is 21.5 KB compressed as hashes and
 * 48.9 KB as text (116 KB unpacked), and every search waits for it. scripts/build-search.ts fails the build
 * if two distinct keys ever share a hash.
 */
export const EXACT_FILTER = 'exact';

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
 * "ghaggar hakra" share a key; other punctuation joins ("Ashoka's" is "ashokas"). Returns "" when nothing
 * is left.
 */
export function exactKey(s: string): string {
  return s
    .replace(/[\p{Pd}/\\]/gu, ' ')
    .split(/\s+/)
    .map(normaliseWord)
    .filter(Boolean)
    .join(' ');
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

/** The `exact` filter values for a page's title and alternate names. */
export function exactFilterValues(names: (string | null | undefined)[]): string[] {
  return [...new Set(exactKeys(names).map(exactHash))];
}
