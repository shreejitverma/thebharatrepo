import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatingSchema, EntitySchema, SourceSchema } from './schema';
import { extractCitations, parseCitationGroup } from './load';

const FIX = path.join(__dirname, '__fixtures__', 'ok');

const baseDating = { range: { earliest: -100, latest: -50, precision: 'year', circa: true }, sources: ['src.x-2000-y'] };

describe('dating rules', () => {
  it('requires traditional methods to be grade D', () => {
    expect(DatingSchema.safeParse({ ...baseDating, method: 'traditional-puranic', grade: 'B' }).success).toBe(false);
    expect(DatingSchema.safeParse({ ...baseDating, method: 'traditional-puranic', grade: 'D' }).success).toBe(true);
  });
  it('reserves grade D for traditional methods', () => {
    expect(DatingSchema.safeParse({ ...baseDating, method: 'epigraphic', grade: 'D' }).success).toBe(false);
  });
  it('requires a source', () => {
    expect(DatingSchema.safeParse({ ...baseDating, sources: [], method: 'epigraphic', grade: 'A' }).success).toBe(false);
  });
  it('rejects inverted ranges, best outside range, and future dates', () => {
    expect(DatingSchema.safeParse({ ...baseDating, method: 'epigraphic', grade: 'A', range: { earliest: 10, latest: 5, precision: 'year', circa: false } }).success).toBe(false);
    expect(DatingSchema.safeParse({ ...baseDating, method: 'epigraphic', grade: 'A', range: { earliest: 1, latest: 5, best: 9, precision: 'year', circa: false } }).success).toBe(false);
    expect(DatingSchema.safeParse({ ...baseDating, method: 'documentary', grade: 'A', range: { earliest: 2200, latest: 2200, precision: 'year', circa: false } }).success).toBe(false);
  });
  it('allows cosmological precision only for tradition', () => {
    const cosmic = { earliest: -1.97e9, latest: -1.97e9, precision: 'cosmological', circa: true };
    expect(DatingSchema.safeParse({ ...baseDating, range: cosmic, method: 'geological', grade: 'B' }).success).toBe(false);
    expect(DatingSchema.safeParse({ ...baseDating, range: cosmic, method: 'traditional-puranic', grade: 'D' }).success).toBe(true);
  });
});

describe('entity and source rules', () => {
  const entity = {
    id: 'cosmology.kalpa',
    type: 'cosmology',
    kind: 'cosmology',
    names: { en: 'Kalpa' },
    summary: 'A day of Brahma in traditional cosmology, 4.32 billion years.',
    datings: [{ ...baseDating, method: 'linguistic', grade: 'C' }],
    review: { status: 'draft' },
  };
  it('limits cosmology entities to traditional datings', () => {
    expect(EntitySchema.safeParse(entity).success).toBe(false);
    expect(EntitySchema.safeParse({ ...entity, datings: [{ ...baseDating, method: 'traditional-puranic', grade: 'D' }] }).success).toBe(true);
  });
  it('requires the id prefix to match the type', () => {
    expect(EntitySchema.safeParse({ ...entity, id: 'event.kalpa', datings: [{ ...baseDating, method: 'traditional-puranic', grade: 'D' }] }).success).toBe(false);
  });
  it('requires identifiers on journal articles and books', () => {
    expect(SourceSchema.safeParse({ id: 'src.a-2000-b', type: 'journal-article', title: 'T T T', authors: ['A B'] }).success).toBe(false);
    expect(SourceSchema.safeParse({ id: 'src.a-2000-b', type: 'book', title: 'T T T', authors: ['A B'], isbn: '978-0-00' }).success).toBe(false);
    expect(SourceSchema.safeParse({ id: 'src.a-2000-b', type: 'book', title: 'T T T', authors: ['A B'], isbn: '9780520242258' }).success).toBe(true);
  });
});

describe('citations', () => {
  it('parses single, located and multiple citations', () => {
    expect(parseCitationGroup('@src.a-1')).toEqual([{ id: 'src.a-1' }]);
    expect(parseCitationGroup('@src.a-1, p. 4; @src.b-2, verse 10.129.1')).toEqual([
      { id: 'src.a-1', locator: 'p. 4' },
      { id: 'src.b-2', locator: 'verse 10.129.1' },
    ]);
    expect(parseCitationGroup('src.a')[0].id.startsWith('!invalid')).toBe(true);
    expect(extractCitations('text [@src.a] and [link](http://x) and [@src.b, ch. 2].')).toEqual([{ id: 'src.a' }, { id: 'src.b', locator: 'ch. 2' }]);
  });
});

describe('article rendering', () => {
  it('renders GFM pipe tables as HTML tables, with citations inside cells', async () => {
    const { renderArticle } = await import('./render');
    const source = SourceSchema.parse({ id: 'src.a-2000-b', type: 'book', title: 'A Book About Things', authors: ['A B'], isbn: '9780520242258' });
    const md = ['| Raga | Thaat |', '| --- | --- |', '| Yaman | Kalyan [@src.a-2000-b, p. 4] |', ''].join('\n');
    const r = await renderArticle(md, new Map([[source.id, source]]));
    expect(r.html).toContain('<div class="table-scroll" tabindex="0" role="region" aria-label="Scrollable table"><table>');
    expect(r.html).toContain('<th>Raga</th>');
    expect(r.html).toMatch(/<td>Kalyan <sup class="cite">\[<a href="#ref-1"[^>]*>1<\/a>\]<\/sup><\/td>/);
    expect(r.html).not.toContain('| Raga |');
    expect(r.references.map((x) => x.locators)).toEqual([['p. 4']]);
  });
});

describe('loader against fixtures', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('loads a valid graph with inbound relations and article links', async () => {
    const cwd = process.cwd();
    process.chdir(FIX);
    vi.resetModules();
    try {
      const { loadContentUncached } = await import('./load');
      const g = loadContentUncached();
      expect(g.errors).toEqual([]);
      expect(g.entities.size).toBe(2);
      expect(g.inbound.get('person.someone')).toEqual([{ from: 'event.thing', kind: 'related-to' }]);
      expect(g.articlesByEntity.get('person.someone')?.[0].slug).toBe('fixture');
      const { renderArticle } = await import('./render');
      const r = await renderArticle(g.articles[0].body, g.sources);
      expect(r.references).toHaveLength(1);
      expect(r.references[0].locators).toEqual(['p. 12']);
      expect(r.html).toContain('<sup class="cite">[<a href="#ref-1"');
      expect(r.html).not.toContain('CITEGROUP');
    } finally {
      process.chdir(cwd);
    }
  });
  it('reports unknown sources, unknown relation targets and uncited articles instead of throwing', async () => {
    const cwd = process.cwd();
    process.chdir(path.join(__dirname, '__fixtures__', 'bad'));
    vi.resetModules();
    try {
      const { loadContentUncached } = await import('./load');
      const msgs = loadContentUncached().errors.map((e) => e.message);
      expect(msgs).toContain('datings[0]: unknown source src.nobody-1999-nothing');
      expect(msgs).toContain('datings[0]: endpoint is written as "7001 BCE" but the text says "7000 BCE"; check which is meant');
      expect(msgs).toContain('datings[0].range.earliest: "74000 BCE" is a deep-time date; write it as years before present ("N ka" or "N Ma") as the cited source reports it');
      expect(msgs).toContain('relation related-to -> unknown entity person.ghost');
      expect(msgs).toContain('article body cites no sources; use [@src.id, locator]');
      expect(msgs).toContain('isbn:9780000000002 already identifies src.roe-1990-a-work; cite one source id per work');
      expect(msgs.filter((m) => m.startsWith('unexpected file'))).toHaveLength(1);
    } finally {
      process.chdir(cwd);
    }
  });
  it('tolerates a missing content root', async () => {
    const cwd = process.cwd();
    process.chdir(FIX);
    vi.resetModules();
    vi.stubEnv('CONTENT_ROOTS', 'content:missing-root');
    try {
      const { loadContentUncached } = await import('./load');
      expect(loadContentUncached().errors).toEqual([]);
    } finally {
      process.chdir(cwd);
    }
  });
});

describe('human-readable years', () => {
  it('converts era strings to astronomical years', async () => {
    const { parseYear } = await import('./schema');
    expect(parseYear('7000 BCE')).toBe(-6999);
    expect(parseYear('1 BCE')).toBe(0);
    expect(parseYear('320 CE')).toBe(320);
    expect(parseYear('1,947')).toBe(1947);
    expect(parseYear('385 ka')).toBe(2026 - 385000);
    expect(parseYear('1.5 Ma')).toBe(2026 - 1500000);
    expect(parseYear(-100)).toBe(-100);
    expect(parseYear('sometime')).toBe('sometime');
  });
});

describe('integrity checks', () => {
  it('flags BCE off-by-one storage', async () => {
    const { bceOffByOne } = await import('./load');
    const { parseYear } = await import('./schema');
    const y = (s: string) => parseYear(s) as number;
    expect(bceOffByOne({ earliest: y('7001 BCE'), latest: y('2600 BCE') }, 'from c. 7000 BCE to 2600 BCE')).toEqual([7000]);
    expect(bceOffByOne({ earliest: y('7000 BCE'), latest: y('2600 BCE') }, 'from c. 7000 BCE to 2600 BCE')).toEqual([]);
    expect(bceOffByOne({ earliest: y('7001 BCE'), latest: y('7000 BCE') }, 'around 7000 BCE')).toEqual([]);
  });
  it('flags a CE end year one short of the round year or century the text gives', async () => {
    const { ceOffByOne } = await import('./load');
    const ending = (latest: number, method: 'textual-internal' | 'traditional-sampradaya' = 'textual-internal') => ({ method, range: { latest } });
    expect(ceOffByOne(ending(499), "completed by Dridhabala (c. 300-500 CE)")).toEqual([500]);
    expect(ceOffByOne(ending(499), 'later expansions up to the fifth century CE')).toEqual([500]);
    expect(ceOffByOne(ending(599), 'Gupta inscriptions of the fourth to sixth centuries CE')).toEqual([600]);
    expect(ceOffByOne(ending(1199), 'a single 8th-12th century CE manuscript copy')).toEqual([1200]);
    expect(ceOffByOne(ending(500), 'up to the fifth century CE')).toEqual([]);
    expect(ceOffByOne(ending(499), 'composed in 499 CE, early in the fifth century CE')).toEqual([]);
    expect(ceOffByOne(ending(499), 'by the fifth century BCE')).toEqual([]);
    expect(ceOffByOne(ending(1199, 'traditional-sampradaya'), 'twelfth century CE')).toEqual([]);
    expect(ceOffByOne(ending(399), 'from 399 CE onward')).toEqual([]);
  });
  it('rejects raw negative years in authored datings', async () => {
    const { rawNegativeYears } = await import('./load');
    const msgs = rawNegativeYears([
      { range: { earliest: -6000, latest: '5000 BCE', best: -5499 } },
      { range: { earliest: 320, latest: 0 } },
    ]);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toContain('datings[0].range.earliest');
    expect(msgs[0]).toContain('"6000 BCE" or "6001 BCE"');
    expect(msgs[1]).toContain('datings[0].range.best');
    expect(rawNegativeYears([{ range: { earliest: '7000 BCE', latest: '1.5 Ma' } }])).toEqual([]);
    expect(rawNegativeYears(undefined)).toEqual([]);
    expect(rawNegativeYears([null, { range: null }])).toEqual([]);
  });
  it('rejects deep-time dates written as calendar years, but not ka strings, round calendar figures or tradition', async () => {
    const { deepTimeBceYears } = await import('./load');
    const { parseYear } = await import('./schema');
    const toba = (v: string, method = 'luminescence') => [{ method, range: { earliest: v, latest: v } }];
    expect(deepTimeBceYears(toba('74000 BCE'))).toHaveLength(2);
    expect(deepTimeBceYears(toba('74 ka'))).toEqual([]);
    expect(2026 - (parseYear('74 ka') as number)).toBe(74000);
    expect(deepTimeBceYears(toba('10000 BCE'))).toEqual([]);
    expect(deepTimeBceYears(toba('3891102 BCE', 'traditional-puranic'))).toEqual([]);
  });
  it('finds malformed citations', async () => {
    const { findMalformedCitations } = await import('./load');
    expect(findMalformedCitations('ok [@src.a-1, p. 2] and [see @src.b-2] and @src.c-3 and [@ src.d]')).toEqual(['[see @src.b-2]', '@src.c-3', '[@ src.d]']);
    expect(findMalformedCitations('fine [@src.a; @src.b, ch. 1].')).toEqual([]);
  });
  it('finds citations hidden in comments or code', async () => {
    const { findHiddenCitations } = await import('./load');
    expect(findHiddenCitations('<!-- [@src.x] --> text `[@src.y]` ok [@src.z]')).toEqual(['[@src.x]', '[@src.y]']);
  });
});
