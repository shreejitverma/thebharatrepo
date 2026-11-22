import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadContentUncached, sameWork } from './load';
import { cachedTitleMatches } from './similarity';

/**
 * Regression guards over the real bibliography. The committed verification cache (content/verification.json)
 * records what each registry or page returned; a matcher change must keep accepting every recorded
 * success, and must never merge two distinct source records as one work.
 */
const graph = loadContentUncached();
const sources = [...graph.sources.values()];
const cache: Record<string, { ok: boolean; matched?: string }> = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content', 'verification.json'), 'utf8'));

/** Pairs of distinct source ids that are knowingly the same work, with the reason. Expected to stay empty. */
const SAME_WORK_ALLOWED: [string, string, string][] = [];

describe('real bibliography', () => {
  it('loads without content errors', () => {
    expect(graph.errors).toEqual([]);
  });

  it('every cached registry and page success still matches the cited title', () => {
    const mismatched: string[] = [];
    for (const s of sources) {
      const keys: [string | undefined, 'record' | 'page'][] = [
        [s.doi && `doi:${s.doi.toLowerCase()}`, 'record'],
        [s.isbn && `isbn:${s.isbn}`, 'record'],
        [s.oclc && `oclc:${s.oclc}`, 'record'],
        [s.url && `url:${s.url}`, 'page'],
      ];
      for (const [key, kind] of keys) {
        const hit = key ? cache[key] : undefined;
        if (hit?.ok && hit.matched !== undefined && !cachedTitleMatches(kind, s.title, hit.matched)) mismatched.push(`${s.id} ${key}`);
      }
    }
    expect(mismatched).toEqual([]);
  });

  it('never treats two distinct source records as the same work', () => {
    const allowed = new Set(SAME_WORK_ALLOWED.map(([a, b]) => `${a}|${b}`));
    const merged: string[] = [];
    for (let i = 0; i < sources.length; i++) {
      for (let j = i + 1; j < sources.length; j++) {
        const [a, b] = [sources[i], sources[j]].sort((x, y) => x.id.localeCompare(y.id));
        if (!allowed.has(`${a.id}|${b.id}`) && sameWork(a, b)) merged.push(`${a.id} ~ ${b.id}`);
      }
    }
    expect(merged).toEqual([]);
  });
});
