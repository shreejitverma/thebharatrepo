/**
 * Reading level preference, shared by every page that shows leveled summaries.
 *
 * Precedence: the `?level=` URL parameter (a shared link), then the viewer's stored choice in
 * localStorage, then "adult". The choice lives only in this browser: no account, no server, no tracking.
 * The active level is mirrored on <html data-reading-level>, and CSS shows the matching summary, so
 * pages stay static and render correctly without JavaScript (adult text).
 */

import { READING_LEVELS, type ReadingLevel } from './content/labels';

export const LEVEL_PARAM = 'level';
export const LEVEL_STORAGE_KEY = 'tbr.readingLevel';
export const LEVEL_ATTRIBUTE = 'data-reading-level';

export function parseLevel(v: unknown): ReadingLevel | null {
  return typeof v === 'string' && (READING_LEVELS as readonly string[]).includes(v) ? (v as ReadingLevel) : null;
}

/** What each level falls back to when a text has no version at that level: simpler is never invented. */
export const LEVEL_FALLBACK: Record<ReadingLevel, readonly ReadingLevel[]> = {
  adult: ['adult'],
  teen: ['teen', 'adult'],
  kids: ['kids', 'teen', 'adult'],
};

/** The level actually shown for a text that exists at the `available` levels. */
export function shownLevel(level: ReadingLevel, available: readonly ReadingLevel[]): ReadingLevel {
  return LEVEL_FALLBACK[level].find((l) => available.includes(l)) ?? 'adult';
}

/** Resolves the level to show from the URL search string and the stored value. */
export function resolveLevel(search: string, stored: unknown): ReadingLevel {
  return parseLevel(new URLSearchParams(search).get(LEVEL_PARAM)) ?? parseLevel(stored) ?? 'adult';
}

/**
 * Inline script for <head>: applies the level before first paint so the page never flashes the
 * wrong summary. Kept dependency-free and wrapped in try/catch: storage can throw in private modes.
 * "adult" is index 0 of READING_LEVELS and is the default, so it never needs the attribute.
 */
export const READING_LEVEL_BOOT_SCRIPT = `(function(){try{var ok=${JSON.stringify(READING_LEVELS)};var l=new URLSearchParams(location.search).get(${JSON.stringify(LEVEL_PARAM)});if(ok.indexOf(l)<0){l=null;try{l=localStorage.getItem(${JSON.stringify(LEVEL_STORAGE_KEY)})}catch(e){}}if(ok.indexOf(l)>0)document.documentElement.setAttribute(${JSON.stringify(LEVEL_ATTRIBUTE)},l)}catch(e){}})();`;
