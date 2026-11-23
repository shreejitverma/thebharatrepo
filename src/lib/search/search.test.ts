import { describe, expect, it } from 'vitest';
import { FACET_OPTIONS, activeFilterCount, parseSearchParams, toPagefindFilters, toSearchParams, withoutFacet } from './facets';
import { excerptParts, excerptWithEllipses, isGenuineMatch, matchedWords, normaliseWord, promoteExactTitle } from './pagefind';

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

  it('offers every entity kind plus articles, sources, learning paths and debates, and all five grades', () => {
    expect(FACET_OPTIONS.kind.map((o) => o.value)).toEqual(expect.arrayContaining(['text', 'person', 'cosmology', 'article', 'source', 'learning-path', 'debate']));
    expect(FACET_OPTIONS.kind.find((o) => o.value === 'debate')?.label).toBe('Debates');
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

describe('exact title promotion', () => {
  const r = (title: string) => ({ meta: { title } });
  const titles = (xs: { meta: { title?: string } }[]) => xs.map((x) => x.meta.title);

  it('moves an exact title match to the front and keeps the rest in order', () => {
    const items = [r('Lumbini Pillar Inscription of Ashoka'), r('Major Rock Edict XIII of Ashoka'), r('Ashoka in Ancient India'), r('Ashoka')];
    expect(titles(promoteExactTitle(items, 'ashoka'))).toEqual(['Ashoka', 'Lumbini Pillar Inscription of Ashoka', 'Major Rock Edict XIII of Ashoka', 'Ashoka in Ancient India']);
  });

  it('ignores case, diacritics, punctuation and extra spaces', () => {
    const items = [r('Other'), r('Āryabhaṭa.')];
    expect(titles(promoteExactTitle(items, '  aryabhata '))).toEqual(['Āryabhaṭa.', 'Other']);
  });

  it('ignores a leading "The" on either side, but not a "the" inside the title', () => {
    const items = [r('The Dating of the Historical Buddha'), r('The date of the Buddha'), r('Gautama Buddha')];
    expect(titles(promoteExactTitle(items, 'date of the buddha'))).toEqual(['The date of the Buddha', 'The Dating of the Historical Buddha', 'Gautama Buddha']);
    expect(titles(promoteExactTitle([r('Other'), r('Ramayana')], 'the ramayana'))).toEqual(['Ramayana', 'Other']);
    const none = [r('Date of the Buddha, the')];
    expect(promoteExactTitle(none, 'date of buddha')).toBe(none);
  });

  it('keeps every exact match, in order, and changes nothing without one', () => {
    const items = [r('Kalidasa in context'), r('Kalidasa'), r('Kālidāsa')];
    expect(titles(promoteExactTitle(items, 'Kalidasa'))).toEqual(['Kalidasa', 'Kālidāsa', 'Kalidasa in context']);
    const none = [r('A'), r('B')];
    expect(promoteExactTitle(none, 'c')).toBe(none);
    expect(promoteExactTitle(none, '')).toBe(none);
  });
});
