import { describe, expect, it } from 'vitest';
import { FACET_OPTIONS, activeFilterCount, parseSearchParams, toPagefindFilters, toSearchParams, withoutFacet } from './facets';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SearchIndexMeta from '@/components/SearchIndexMeta';
import { EXACT_FILTER, exactFilterValues, exactHash, exactKey, exactKeys, normaliseWord } from './normalise';
import { exactHits, excerptParts, excerptWithEllipses, facetCounts, isGenuineMatch, matchedWords, pinExact } from './pagefind';

describe('search URL state', () => {
  it('keeps the legacy ?q= contract', () => {
    const s = parseSearchParams(new URLSearchParams('q=Harappa'));
    expect(s.q).toBe('Harappa');
    expect(activeFilterCount(s.filters)).toBe(0);
    expect(toSearchParams(s).toString()).toBe('q=Harappa');
  });

  it('parses repeated and comma-separated facets, drops unknown values and duplicates, and orders by option order', () => {
    const s = parseSearchParams(new URLSearchParams('q=%20ashoka%20&grade=C&grade=A,zz&grade=A&kind=article&lens=tradition&category=nowhere'));
    expect(s).toEqual({ q: 'ashoka', filters: { kind: ['article'], category: [], grade: ['A', 'C'], lens: ['tradition'] } });
    expect(toSearchParams(s).toString()).toBe('q=ashoka&kind=article&grade=A&grade=C&lens=tradition');
  });

  it('round-trips through the URL', () => {
    const s = { q: 'Rigveda hymn', filters: { kind: ['text', 'source'], category: ['history'], grade: ['B'], lens: ['scholarship'] } };
    expect(parseSearchParams(toSearchParams(s))).toEqual(s);
  });

  it('builds OR-within-facet Pagefind filters naming every facet', () => {
    expect(toPagefindFilters({ kind: ['text', 'person'], category: [], grade: ['A'], lens: [] })).toEqual({
      kind: { any: ['text', 'person'] },
      category: { any: [] },
      grade: { any: ['A'] },
      lens: { any: [] },
    });
  });

  it('drops one facet for counting its options', () => {
    const f = { kind: ['text'], category: [], grade: ['A'], lens: ['tradition'] };
    expect(withoutFacet(f, 'grade')).toEqual({ kind: ['text'], category: [], grade: [], lens: ['tradition'] });
    expect(f.grade).toEqual(['A']);
  });

  it('offers every entity kind plus articles and sources, and all five grades', () => {
    expect(FACET_OPTIONS.kind.map((o) => o.value)).toEqual(expect.arrayContaining(['text', 'person', 'cosmology', 'article', 'source']));
    expect(FACET_OPTIONS.grade.map((o) => o.value)).toEqual(['A', 'B', 'C', 'D', 'E']);
  });
});

describe('excerptParts', () => {
  it('splits highlights and decodes entities as text, never as markup', () => {
    expect(excerptParts('the <mark>Maurya</mark> empire &amp; &lt;b&gt;Ashoka&lt;/b&gt;')).toEqual([
      { text: 'the ', mark: false },
      { text: 'Maurya', mark: true },
      { text: ' empire & <b>Ashoka</b>', mark: false },
    ]);
  });
  it('drops any raw tag other than mark', () => {
    expect(excerptParts('<img src=x onerror=alert(1)>safe')).toEqual([{ text: 'safe', mark: false }]);
  });
});

describe('excerptWithEllipses', () => {
  const content = 'Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu.';
  const text = (excerpt: string) => excerptWithEllipses(excerpt, content).map((p) => p.text).join('');
  it('marks only the ends that are cut', () => {
    expect(text('Alpha beta <mark>gamma</mark>')).toBe('Alpha beta gamma...');
    expect(text('kappa <mark>lambda</mark> mu.')).toBe('...kappa lambda mu.');
    expect(text('epsilon <mark>zeta</mark> eta')).toBe('...epsilon zeta eta...');
    expect(text(content)).toBe(content);
  });
});

describe('isGenuineMatch', () => {
  it('accepts exact, prefix, diacritic-insensitive and stemmed matches', () => {
    expect(isGenuineMatch('Ashoka', ['Ashoka,'])).toBe(true);
    expect(isGenuineMatch('asho', ['Ashoka'])).toBe(true);
    expect(isGenuineMatch('rgveda', ['Ṛgveda.'])).toBe(true);
    expect(isGenuineMatch('running', ['run'])).toBe(true);
    expect(isGenuineMatch('Harappan cities', ['Harappan', 'City'])).toBe(true);
  });
  it('rejects Pagefind falling back to a short prefix of a nonsense term', () => {
    expect(isGenuineMatch('xyzzyplugh', ['X.'])).toBe(false);
    expect(isGenuineMatch('zzzqqxxnomatch', ['Z.'])).toBe(false);
    expect(isGenuineMatch('vvvvjjjj', ['v'])).toBe(false);
    expect(isGenuineMatch('Harappan qqqqzzzz', ['Harappan', 'q'])).toBe(false);
  });
  it('treats an empty query as matching', () => {
    expect(isGenuineMatch('  ', [])).toBe(true);
  });
  it('reads matched words from content locations', () => {
    expect(matchedWords({ content: 'The Maurya empire and Ashoka.', locations: [1, 4, 9] })).toEqual(['Maurya', 'Ashoka.']);
    expect(normaliseWord('Ash-Mound')).toBe('ashmound');
  });
});

describe('exact-name normalisation', () => {
  it('lowercases and folds IAST diacritics to ASCII', () => {
    expect(exactKey('Aśoka')).toBe('asoka');
    expect(exactKey('Āryabhaṭa')).toBe('aryabhata');
    expect(exactKey('Ṛgveda')).toBe('rgveda');
    expect(exactKey('Kṛṣṇa')).toBe('krsna');
    expect(exactKey('Pāṇini')).toBe('panini');
    expect(exactKey('Śaṅkara')).toBe('sankara');
    expect(exactKey('Saṃskṛta')).toBe('samskrta');
    expect(exactKey('Duḥkha')).toBe('duhkha');
    expect(exactKey('Jñāna')).toBe('jnana');
    expect(exactKey('Ṝ ḹ ḷ ṁ')).toBe('r l l m');
  });
  it('folds letters NFD leaves whole', () => {
    expect(exactKey('Straße')).toBe('strasse');
    expect(exactKey('Æsop Øresund Łódź')).toBe('aesop oresund lodz');
  });
  it('strips punctuation and collapses whitespace', () => {
    expect(exactKey('  Gautama   Buddha ')).toBe('gautama buddha');
    expect(exactKey('Gautama\tBuddha\n')).toBe('gautama buddha');
    expect(exactKey("Ashoka's Edicts.")).toBe('ashokas edicts');
    expect(exactKey('Lion Capital (Sarnath), 250 BCE?')).toBe('lion capital sarnath 250 bce');
    expect(exactKey('Arts & Crafts')).toBe('arts crafts');
  });
  it('treats hyphens, dashes and slashes as word breaks', () => {
    expect(exactKey('Ghaggar-Hakra')).toBe('ghaggar hakra');
    expect(exactKey('Indus–Sarasvati')).toBe('indus sarasvati');
    expect(exactKey('Shaka/Saka')).toBe('shaka saka');
  });
  it('gives the same key to the indexed title and the ways a reader types it', () => {
    for (const q of ['ashoka', 'ASHOKA', ' Ashoka ', 'ashoka.']) expect(exactKey(q)).toBe(exactKey('Ashoka'));
    for (const q of ['asoka', 'aśoka', 'Aśoka', 'ASOKA']) expect(exactKey(q)).toBe(exactKey('Aśoka'));
    expect(exactKey('ashoka')).not.toBe(exactKey('Aśoka'));
  });
  it('returns an empty key for text with no letters or digits', () => {
    expect(exactKey('')).toBe('');
    expect(exactKey(' - . ? ')).toBe('');
  });
  it('lists each distinct non-empty key once', () => {
    expect(exactKeys(['Ashoka', 'Aśoka', undefined, null, '', 'ashoka'])).toEqual(['ashoka', 'asoka']);
    expect(exactKeys(['Āryabhaṭa', 'Aryabhata'])).toEqual(['aryabhata']);
  });
  it('keeps word normalisation for the genuine-match check unchanged', () => {
    expect(normaliseWord('Ṛgveda.')).toBe('rgveda');
    expect(normaliseWord('Ash-Mound')).toBe('ashmound');
  });
});

describe('the exact filter written at index time', () => {
  const valuesIn = (html: string) => [...html.matchAll(new RegExp(`data-pagefind-filter="${EXACT_FILTER}\\[data-v\\]" data-v="([^"]*)"`, 'g'))].map((m) => m[1]);

  it('hashes keys with 32-bit FNV-1a, matching the published test vectors', () => {
    expect(exactHash('')).toBe((0x811c9dc5).toString(36));
    expect(exactHash('a')).toBe((0xe40c292c).toString(36));
    expect(exactHash('foobar')).toBe((0xbf9cf968).toString(36));
    expect(exactHash('ashoka')).toMatch(/^[0-9a-z]{1,7}$/);
  });

  it('carries the hashed title and alternate names, which the query hash matches', () => {
    const html = renderToStaticMarkup(createElement(SearchIndexMeta, { title: 'Ashoka', names: ['Aśoka'], kind: 'person', filters: { kind: ['person'] } }));
    expect(valuesIn(html)).toEqual([exactHash('ashoka'), exactHash('asoka')]);
    for (const q of ['asoka', 'aśoka', 'Ashoka', ' ASHOKA. ']) expect(valuesIn(html)).toContain(exactHash(exactKey(q)));
    expect(valuesIn(html)).not.toContain(exactHash(exactKey('ashoka edicts')));
  });

  it('writes one value when the alternate name folds to the title, and none for an empty name', () => {
    const html = renderToStaticMarkup(createElement(SearchIndexMeta, { title: 'Gautama Buddha', names: [undefined, 'Gautama  Buddha'], kind: 'person', filters: {} }));
    expect(valuesIn(html)).toEqual([exactHash('gautama buddha')]);
    expect(exactFilterValues(['', ' . '])).toEqual([]);
  });

  it('is not a facet: facet counts drop it', () => {
    const counts = { kind: { person: 3 }, [EXACT_FILTER]: { ashoka: 1, asoka: 1 }, grade: { A: 2 } };
    expect(facetCounts(counts)).toEqual({ kind: { person: 3 }, grade: { A: 2 } });
    expect(facetCounts({})).toEqual({});
  });
});

describe('exact-name pinning', () => {
  const r = (id: string, from = 'ranked') => ({ id, from });
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

  it('moves an exact hit to the front and keeps the rest in ranked order', () => {
    const ranked = [r('lion-capital'), r('edict-xiii'), r('ashoka-in-india'), r('ashoka')];
    expect(ids(pinExact(ranked, [r('ashoka', 'exact')]))).toEqual(['ashoka', 'lion-capital', 'edict-xiii', 'ashoka-in-india']);
  });

  it('uses the ranked result object, which carries the matched words, when there is one', () => {
    const ranked = [r('a'), r('b')];
    expect(pinExact(ranked, [r('b', 'exact')])[0]).toBe(ranked[1]);
  });

  it('orders several exact hits by rank, then appends hits the ranked results lack', () => {
    const ranked = [r('a'), r('b'), r('c'), r('d')];
    const exact = [r('x', 'exact'), r('d', 'exact'), r('b', 'exact'), r('y', 'exact')];
    expect(ids(pinExact(ranked, exact))).toEqual(['b', 'd', 'x', 'y', 'a', 'c']);
  });

  it('pins a hit found only through an alternate name, without duplicating anything', () => {
    const ranked = [r('src.asoka-and-the-decline'), r('src.asoka-edicts')];
    const out = pinExact(ranked, [r('person.ashoka', 'exact'), r('person.ashoka', 'exact')]);
    expect(ids(out)).toEqual(['person.ashoka', 'src.asoka-and-the-decline', 'src.asoka-edicts']);
    expect(out[0].from).toBe('exact');
  });

  it('keeps only the exact hits in the pinned order, not the lookup order', () => {
    // The term matched nothing: the lookup returns its hits in index order, while pinExact orders them by the
    // fallback rank, and the first fragments rendered come from the pinned list.
    const ranked = [r('a'), r('b'), r('c'), r('d')];
    const exact = [r('x', 'exact'), r('d', 'exact'), r('b', 'exact'), r('y', 'exact')];
    expect(ids(exactHits(pinExact(ranked, exact), exact))).toEqual(['b', 'd', 'x', 'y']);
    expect(exactHits(pinExact(ranked, []), [])).toEqual([]);
  });

  it('pages through more exact hits than the first batch without repeating or skipping one', () => {
    const exact = ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'].map((id) => r(id, 'exact'));
    const pinned = pinExact(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'z'].map((id) => r(id)), exact);
    const results = exactHits(pinned, exact);
    const firstBatch = pinned.slice(0, 6);
    // "Show more" continues from the number of results already shown.
    const shown = [...firstBatch, ...results.slice(firstBatch.length)];
    expect(ids(shown)).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']);
  });

  it('counts an exact hit listed twice once', () => {
    const exact = [r('b', 'exact'), r('b', 'exact')];
    expect(ids(exactHits(pinExact([r('a'), r('b')], exact), exact))).toEqual(['b']);
  });

  it('changes nothing without an exact hit', () => {
    const ranked = [r('a'), r('b')];
    expect(pinExact(ranked, [])).toBe(ranked);
    expect(pinExact([], [r('a')]).map((x) => x.id)).toEqual(['a']);
  });
});
