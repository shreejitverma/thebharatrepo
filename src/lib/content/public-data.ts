/**
 * URLs of the static files scripts/build-content.ts writes into public/ (run by prebuild and predev).
 * A plain module, so server components can import the values: a constant exported from a 'use client' file would arrive as a client reference.
 */

/** Compact search index of entities and articles. */
export const SEARCH_INDEX_URL = '/search.json';

/** Every Kaalchakra item, fetched by the client instead of being inlined in the page. */
export const KC_ITEMS_URL = '/data/kaalchakra.json';
