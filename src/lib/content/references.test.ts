import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { articleGradeSummary, buildCitationIndex, buildReferences, correctionAnchors, normalizeLocator, backlinkLabel } from './references';
import { CorrectionSchema, EntitySchema, SourceSchema } from './schema';
import type { Article } from './load';

const src = (id: string) => SourceSchema.parse({ id, type: 'book', title: `Title of ${id}`, authors: ['A Author'], isbn: '9780520242258' });

describe('buildReferences', () => {
  it('numbers sources by first use and deduplicates repeated citations', () => {
    const refs = buildReferences([{ id: 'src.b' }, { id: 'src.a', locator: 'p. 4' }, { id: 'src.b', locator: 'ch. 2' }, { id: 'src.a', locator: 'p. 9' }]);
    expect(refs.map((r) => [r.n, r.id])).toEqual([
      [1, 'src.b'],
      [2, 'src.a'],
    ]);
    expect(refs[0]).toMatchObject({ locators: ['ch. 2'], uses: [1, 3], dating: false });
    expect(refs[1]).toMatchObject({ locators: ['p. 4', 'p. 9'], uses: [2, 4] });
  });

  it('deduplicates locators ignoring case and whitespace, keeping the first spelling', () => {
    const refs = buildReferences([
      { id: 'src.a', locator: 'p.  12' },
      { id: 'src.a', locator: 'P. 12' },
      { id: 'src.a', locator: ' p. 12 ' },
      { id: 'src.a', locator: 'p. 13' },
      { id: 'src.a', locator: '   ' },
    ]);
    expect(refs).toHaveLength(1);
    expect(refs[0].locators).toEqual(['p. 12', 'p. 13']);
    expect(refs[0].uses).toEqual([1, 2, 3, 4, 5]);
  });

  it('appends sources cited only by the article dating, after every in-text source', () => {
    const refs = buildReferences([{ id: 'src.a' }, { id: 'src.b' }], [{ id: 'src.c', locator: 'p. 1' }, { id: 'src.a', locator: 'p. 2' }]);
    expect(refs.map((r) => [r.n, r.id, r.dating, r.uses])).toEqual([
      [1, 'src.a', true, [1]],
      [2, 'src.b', false, [2]],
      [3, 'src.c', true, []],
    ]);
    expect(refs[0].locators).toEqual(['p. 2']);
  });

  it('returns no references for no citations', () => {
    expect(buildReferences([])).toEqual([]);
  });

  it('normalises locators and labels back-links', () => {
    expect(normalizeLocator('  verse\t10.129.1 \n')).toBe('verse 10.129.1');
    expect([0, 1, 25, 26, 27, 51, 52].map(backlinkLabel)).toEqual(['a', 'b', 'z', 'aa', 'ab', 'az', 'ba']);
  });
});

describe('renderArticle references', () => {
  it('keeps in-text anchors and reference numbers in step with buildReferences', async () => {
    const { renderArticle } = await import('./render');
    const sources = new Map(['src.a', 'src.b', 'src.c'].map((id) => [id, src(id)]));
    const md = 'One [@src.b, p. 1]. Two [@src.a; @src.b, p. 1]. Three [@src.a, p. 5].';
    const r = await renderArticle(md, sources, [{ id: 'src.c' }]);
    expect(r.references.map((x) => [x.n, x.id, x.uses, x.locators])).toEqual([
      [1, 'src.b', [1, 3], ['p. 1']],
      [2, 'src.a', [2, 4], ['p. 5']],
      [3, 'src.c', [], []],
    ]);
    const anchors = [...r.html.matchAll(/<a href="#ref-(\d+)" id="cite-(\d+)"/g)].map((m) => [Number(m[2]), Number(m[1])]);
    expect(anchors).toEqual([
      [1, 1],
      [2, 2],
      [3, 1],
      [4, 2],
    ]);
    expect(r.references[2].source.title).toBe('Title of src.c');
  });

  it('throws on a citation of an unknown source instead of dropping it', async () => {
    const { renderArticle } = await import('./render');
    await expect(renderArticle('Text [@src.missing].', new Map())).rejects.toThrow(/unknown or malformed source citations: src.missing/);
  });
});

const entity = (over: Record<string, unknown>) =>
  EntitySchema.parse({
    id: 'person.x',
    type: 'person',
    kind: 'person',
    names: { en: 'X' },
    summary: 'A test entity used for the reference index tests.',
    datings: [{ method: 'epigraphic', range: { earliest: '268 BCE', latest: '233 BCE', precision: 'year', circa: true }, grade: 'A', sources: ['src.a'] }],
    review: { status: 'draft' },
    ...over,
  });

const article = (over: Partial<Article>): Article =>
  ({
    title: 'An article',
    summary: 'A summary that is long enough.',
    date: '2026-01-01',
    tags: [],
    datings: [{ method: 'scholarly-consensus', range: { earliest: -100, latest: -50, precision: 'year', circa: true }, grade: 'B', sources: ['src.c'] }],
    entities: [],
    readingLevel: 'adult',
    review: { status: 'draft', reviewer: null, lastReviewed: null },
    slug: 'an-article',
    file: '_content/history/an-article.md',
    category: 'history',
    body: '',
    inlineCitations: [],
    ...over,
  }) as Article;

describe('buildCitationIndex', () => {
  it('lists every entity, article and correction citing a source, once each', () => {
    const e1 = entity({
      id: 'person.zeta',
      names: { en: 'Zeta' },
      claims: [
        { text: 'A first checkable claim.', grade: 'B', sources: [{ id: 'src.a', locator: 'p. 3' }, 'src.b'] },
        { text: 'A second checkable claim.', grade: 'C', sources: ['src.b'] },
      ],
    });
    const e2 = entity({ id: 'person.alpha', names: { en: 'Alpha' } });
    const a1 = article({ inlineCitations: [{ id: 'src.a', locator: 'p. 7' }, { id: 'src.a' }, { id: 'src.a', locator: 'p. 7' }] });
    const corr = CorrectionSchema.parse({ date: '2026-11-21', target: '/history/an-article', before: 'old', after: 'new', reason: 'a long enough reason', sources: ['src.a', { id: 'src.a', locator: 'p. 9' }] });
    const index = buildCitationIndex({ entities: new Map([e1, e2].map((e) => [e.id, e])), articles: [a1], corrections: [corr] });

    const a = index.get('src.a')!;
    expect(a.entities.map((x) => x.entity.names.en)).toEqual(['Alpha', 'Zeta']);
    expect(a.entities[1].contexts.map((c) => [c.kind, c.index, c.locator])).toEqual([
      ['dating', 0, undefined],
      ['claim', 0, 'p. 3'],
    ]);
    expect(a.articles).toHaveLength(1);
    expect(a.articles[0]).toMatchObject({ inText: 3, dating: false, locators: ['p. 7'] });
    expect(a.corrections).toHaveLength(1);
    expect(a.corrections[0].anchor).toBe(correctionAnchors([corr])[0]);

    const b = index.get('src.b')!;
    expect(b.entities).toHaveLength(1);
    expect(b.entities[0].contexts.map((c) => c.index)).toEqual([0, 1]);
    expect(b.articles).toEqual([]);

    expect(index.get('src.c')!.articles[0]).toMatchObject({ inText: 0, dating: true });
    expect(index.get('src.unused')).toBeUndefined();
  });
});

describe('correctionAnchors', () => {
  const c = (before: string, target = '/history/maurya-empire') => CorrectionSchema.parse({ date: '2026-11-21', target, before, after: 'after', reason: 'a long enough reason' });
  it('derives stable, unique, URL-safe anchors from content', () => {
    const [x, y] = correctionAnchors([c('one'), c('two')]);
    expect(x).toMatch(/^correction-2026-11-21-history-maurya-empire-[0-9a-f]{6}$/);
    expect(x).not.toBe(y);
    // Adding a correction does not move an existing anchor.
    expect(correctionAnchors([c('new'), c('one'), c('two')]).slice(1)).toEqual([x, y]);
  });
  it('suffixes exact duplicates', () => {
    const [x, y] = correctionAnchors([c('same'), c('same')]);
    expect(y).toBe(`${x}-2`);
  });
});

describe('articleGradeSummary', () => {
  it('counts graded datings and claims across linked records, ignoring duplicates and missing ids', () => {
    const e = entity({
      datings: [
        { method: 'epigraphic', range: { earliest: 1, latest: 2, precision: 'year', circa: true }, grade: 'A', sources: ['src.a'] },
        { method: 'traditional-puranic', range: { earliest: 1, latest: 2, precision: 'year', circa: true }, grade: 'D', sources: ['src.a'] },
      ],
      claims: [{ text: 'A checkable claim here.', grade: 'A', sources: ['src.a'] }],
    });
    const s = articleGradeSummary({ datings: article({}).datings, entities: ['person.x', 'person.x', 'person.missing'] }, new Map([[e.id, e]]));
    expect(s.datings.map((d) => [d.grade, d.method, d.range.earliest])).toEqual([['B', 'scholarly-consensus', -100]]);
    expect(s.counts).toEqual({ A: 2, B: 0, C: 0, D: 1, E: 0 });
    expect(s.total).toBe(3);
    expect(s.records).toBe(1);
  });
});

describe('references against the fixture graph', () => {
  it('builds the citation index for fixture content', async () => {
    const cwd = process.cwd();
    process.chdir(path.join(__dirname, '__fixtures__', 'ok'));
    vi.resetModules();
    try {
      const { loadContentUncached } = await import('./load');
      const { buildCitationIndex: build } = await import('./references');
      const g = loadContentUncached();
      expect(g.errors).toEqual([]);
      const cited = build(g).get('src.doe-2001-a-book')!;
      expect(cited.articles.map((x) => [x.article.slug, x.inText, x.dating, x.locators])).toEqual([['fixture', 2, true, ['p. 12']]]);
      expect(cited.entities.map((x) => x.entity.id).sort()).toEqual([...g.entities.keys()].sort());
    } finally {
      process.chdir(cwd);
    }
  });
});
