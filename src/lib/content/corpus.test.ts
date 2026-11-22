import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadContentUncached, sameWork } from './load';
import { cachedTitleMatches, normalizeTitle, urlMatchKind } from './similarity';
import { primaryDating } from './lens';

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

  it('never displays an entity by a recognition or publication milestone', () => {
    // The displayed dating places the entity itself; a UNESCO listing or a paper's publication year belongs in a claim.
    const shown = [...graph.entities.values()].filter((e) => /^(UNESCO|Publication)\b/i.test(primaryDating(e.datings).label ?? ''));
    expect(shown.map((e) => e.id)).toEqual([]);
  });

  it('every cached registry and page success still matches the cited title', () => {
    const mismatched: string[] = [];
    for (const s of sources) {
      const keys: [string | undefined, 'record' | 'page'][] = [
        [s.doi && `doi:${s.doi.toLowerCase()}`, 'record'],
        [s.isbn && `isbn:${s.isbn}`, 'record'],
        [s.oclc && `oclc:${s.oclc}`, 'record'],
        [s.url && `url:${s.url}`, s.url ? urlMatchKind(s.url) : 'page'],
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
    // Titles with no normalised word in common can never match, so only pairs sharing a word are compared.
    const byWord = new Map<string, number[]>();
    sources.forEach((s, i) => {
      for (const w of new Set(normalizeTitle(s.title))) byWord.set(w, [...(byWord.get(w) ?? []), i]);
    });
    const candidates = new Set<string>();
    for (const ids of byWord.values()) for (const i of ids) for (const j of ids) if (i < j) candidates.add(`${i}|${j}`);
    const merged: string[] = [];
    for (const pair of candidates) {
      const [a, b] = pair.split('|').map((k) => sources[Number(k)]).sort((x, y) => x.id.localeCompare(y.id));
      if (!allowed.has(`${a.id}|${b.id}`) && sameWork(a, b)) merged.push(`${a.id} ~ ${b.id}`);
    }
    expect(merged).toEqual([]);
  });
});
