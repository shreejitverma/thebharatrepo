import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DatingSchema, EntitySchema, SourceSchema, type Entity } from './schema';
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
  it('rejects a dating that dates a text about a figure rather than the figure', () => {
    const rama = {
      ...entity,
      id: 'person.rama',
      type: 'person',
      kind: 'person',
      datings: [
        { ...baseDating, method: 'traditional-puranic', grade: 'D' },
        { ...baseDating, method: 'linguistic', grade: 'C', label: 'Composition of the Valmiki Ramayana (date of the text)' },
      ],
    };
    const r = EntitySchema.safeParse(rama);
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.message)).toEqual(['this linguistic dating dates a text, not person.rama; record the attestation as a claim or on the text entity']);
    expect(EntitySchema.safeParse({ ...rama, datings: [rama.datings[0]] }).success).toBe(true);
    // A text entity is dated by its own composition.
    expect(EntitySchema.safeParse({ ...rama, id: 'text.ramayana', type: 'text', kind: 'text' }).success).toBe(true);
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

describe('aliases of merged entities', () => {
  const live = (id: string, aliases: string[] = []) => ({ id, aliases });
  it('rejects an alias that is the entity itself, listed twice, or not an entity id', () => {
    const e = {
      id: 'cosmology.kalpa',
      type: 'cosmology',
      kind: 'cosmology',
      names: { en: 'Kalpa' },
      summary: 'A day of Brahma in traditional cosmology, 4.32 billion years.',
      datings: [{ ...baseDating, method: 'traditional-puranic', grade: 'D' }],
      review: { status: 'draft' },
    };
    expect(EntitySchema.parse(e).aliases).toEqual([]);
    expect(EntitySchema.safeParse({ ...e, aliases: ['cosmology.old-kalpa'] }).success).toBe(true);
    expect(EntitySchema.safeParse({ ...e, aliases: ['cosmology.kalpa'] }).success).toBe(false);
    expect(EntitySchema.safeParse({ ...e, aliases: ['cosmology.old-kalpa', 'cosmology.old-kalpa'] }).success).toBe(false);
    expect(EntitySchema.safeParse({ ...e, aliases: ['old-kalpa'] }).success).toBe(false);
  });
  it('maps each alias to its entity, across types', async () => {
    const { resolveAliases } = await import('./load');
    const r = resolveAliases([live('site.dholavira', ['event.dholavira-unesco-inscription']), live('event.other')]);
    expect(r.problems).toEqual([]);
    expect(r.aliases).toEqual(new Map([['event.dholavira-unesco-inscription', 'site.dholavira']]));
  });
  it('rejects an alias that collides with a live id or is claimed by two entities', async () => {
    const { resolveAliases } = await import('./load');
    const r = resolveAliases([live('concept.a', ['concept.b', 'concept.gone']), live('concept.b'), live('concept.c', ['concept.gone'])]);
    expect(r.problems).toEqual([
      { id: 'concept.a', message: 'alias concept.b collides with a live entity id; an alias names an entity that no longer exists' },
      { id: 'concept.c', message: 'alias concept.gone is already claimed by concept.a' },
    ]);
    expect(r.aliases).toEqual(new Map([['concept.gone', 'concept.a']]));
  });
  it('generates permanent redirects for the archive page and the Kaalchakra deep link', async () => {
    const { aliasRedirects } = await import('./redirects');
    expect(aliasRedirects(new Map([['concept.rigvedic-sarasvati', 'concept.ghaggar-hakra-sarasvati-debate']]))).toEqual([
      { source: '/archive/concept/rigvedic-sarasvati', destination: '/archive/concept/ghaggar-hakra-sarasvati-debate', permanent: true },
      {
        source: '/kaalchakra',
        has: [{ type: 'query', key: 'id', value: 'concept\\.rigvedic-sarasvati' }],
        destination: '/kaalchakra?id=concept.ghaggar-hakra-sarasvati-debate',
        permanent: true,
      },
    ]);
  });
  it('covers every entity removed from the corpus since the last production deploy', async () => {
    const { loadContentUncached } = await import('./load');
    const { aliases } = loadContentUncached();
    expect(Object.fromEntries(aliases)).toMatchObject({
      'concept.rigvedic-sarasvati': 'concept.ghaggar-hakra-sarasvati-debate',
      'event.dholavira-unesco-inscription': 'site.dholavira',
      'event.rakhigarhi-genome-publication': 'concept.rakhigarhi-i6113-genome',
      'tradition.kumbh-mela-unesco-inscription': 'tradition.kumbha-mela',
      'tradition.vedic-chanting-unesco-inscription': 'tradition.vedic-chanting',
    });
  });
});

describe('duplicate relations', () => {
  const ent = (id: string, ...relations: [Entity['relations'][number]['kind'], string][]): Pick<Entity, 'id' | 'relations'> => ({ id, relations: relations.map(([kind, target]) => ({ kind, target })) });
  it('accepts one relation per pair of entities', async () => {
    const { duplicateRelations } = await import('./load');
    expect(duplicateRelations([ent('cosmology.kalpa', ['part-of', 'cosmology.brahma-lifespan'], ['related-to', 'cosmology.pralaya']), ent('cosmology.brahma-lifespan')])).toEqual([]);
  });
  it('rejects the same relation twice, two kinds for one pair, and the reciprocal of an existing relation', async () => {
    const { duplicateRelations } = await import('./load');
    expect(
      duplicateRelations([
        ent('cosmology.kalpa', ['part-of', 'cosmology.brahma-lifespan'], ['part-of', 'cosmology.brahma-lifespan'], ['related-to', 'cosmology.pralaya'], ['part-of', 'cosmology.pralaya']),
        ent('cosmology.brahma-lifespan', ['related-to', 'cosmology.kalpa']),
        ent('person.x', ['succeeded', 'person.y']),
        ent('person.y', ['preceded', 'person.x']),
        ent('person.z', ['related-to', 'person.z']),
      ]),
    ).toEqual([
      { id: 'cosmology.kalpa', message: 'relation part-of -> cosmology.brahma-lifespan is listed twice' },
      { id: 'cosmology.kalpa', message: 'relations related-to and part-of both link to cosmology.pralaya; keep one relation per pair of entities and put any detail in its note' },
      { id: 'cosmology.brahma-lifespan', message: "relation related-to -> cosmology.kalpa duplicates cosmology.kalpa's relation part-of -> cosmology.brahma-lifespan; the site shows inbound relations on both pages, so keep one" },
      { id: 'person.y', message: "relation preceded -> person.x duplicates person.x's relation succeeded -> person.y; the site shows inbound relations on both pages, so keep one" },
      { id: 'person.z', message: 'relation related-to -> person.z points at the entity itself' },
    ]);
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
      expect(g.warnings).toEqual([]);
      expect(g.relationStats).toMatchObject({ declared: 1, facts: 1, symmetric: { bothSides: 0, oneSide: 1 } });
      expect(g.entities.size).toBe(2);
      expect(g.inbound.get('person.someone')).toEqual([{ from: 'event.thing', kind: 'related-to' }]);
      expect(g.articlesByEntity.get('person.someone')?.[0].slug).toBe('fixture');
      expect(g.aliases).toEqual(new Map([['person.someone-else', 'person.someone']]));
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
      const g = loadContentUncached();
      const msgs = g.errors.map((e) => e.message);
      expect(msgs).toContain('datings[0]: unknown source src.nobody-1999-nothing');
      expect(msgs).toContain('extents[0]: unknown source src.nobody-1999-nothing');
      // Relation consistency is advisory: it is reported as a warning, never as an error.
      expect(g.warnings).toEqual([{ file: 'content/entities/event/broken.yaml', message: 'relation part-of points at the entity itself' }]);
      expect(msgs.some((m) => m.includes('points at the entity itself'))).toBe(false);
      expect(g.relationStats).toMatchObject({ declared: 2, unknownTargets: 1, selfRelations: 1, contradictions: 0 });
      expect(msgs).toContain('datings[0]: endpoint is written as "7001 BCE" but the text says "7000 BCE"; check which is meant');
      expect(msgs).toContain('datings[0].range.earliest: "74000 BCE" is a deep-time date; write it as years before present ("N ka" or "N Ma") as the cited source reports it');
      expect(msgs).toContain('relation related-to -> unknown entity person.ghost');
      expect(msgs).toContain('article body cites no sources; use [@src.id, locator]');
      expect(msgs).toContain('isbn:9780000000002 already identifies src.roe-1990-a-work; cite one source id per work');
      expect(msgs.filter((m) => m.startsWith('unexpected file'))).toHaveLength(1);
      expect(msgs).toContain('alias event.toba collides with a live entity id; an alias names an entity that no longer exists');
      expect(msgs).toContain('relation related-to -> unknown entity event.former-toba (merged into event.toba; link to that id)');
      expect(msgs).toContain('link /archive/event/former-toba -> unknown entity event.former-toba (merged into event.toba; link to that id)');
      expect(msgs).toContain('link /history/nothing does not reach an entity or article');
      expect(msgs.filter((m) => m.startsWith('link '))).toHaveLength(2);
      expect(msgs).toContain('relation contemporary-of -> event.toba is listed twice');
      expect(msgs).toContain("relation related-to -> event.misdated duplicates event.misdated's relation contemporary-of -> event.toba; the site shows inbound relations on both pages, so keep one");
      expect(msgs).toContain('relation related-to -> event.toba points at the entity itself');
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
  it('requires a label that states one span to match the range', async () => {
    const { labelRangeMismatch } = await import('./load');
    const { parseYear } = await import('./schema');
    const r = (a: string, b: string) => ({ earliest: parseYear(a) as number, latest: parseYear(b) as number });
    expect(labelRangeMismatch({ label: 'Reign (about 268 to 232 BCE)', range: r('273 BCE', '232 BCE') })).toContain('names a different span');
    expect(labelRangeMismatch({ label: 'Reign (about 268 to 232 BCE)', range: r('268 BCE', '232 BCE') })).toBeNull();
    expect(labelRangeMismatch({ label: "Faxian's journey (399-414 CE)", range: r('399', '414') })).toBeNull();
    expect(labelRangeMismatch({ label: 'Mauryan rule (c. 322 BCE to 185 BCE)', range: r('322 BCE', '185 BCE') })).toBeNull();
    // Several phases or alternatives: the label is not a statement of the whole range.
    expect(labelRangeMismatch({ label: 'Chronology (c. 165/155-130 BCE)', range: r('165 BCE', '130 BCE') })).toBeNull();
    expect(labelRangeMismatch({ label: 'Two phases (c. 100 BCE and c. 462-480 CE)', range: r('150 BCE', '480') })).toBeNull();
    expect(labelRangeMismatch({ range: r('1 BCE', '1') })).toBeNull();
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
  it('finds internal link targets outside code', async () => {
    const { internalLinks } = await import('./load');
    expect(internalLinks('[a](/archive/site/dholavira) [b](/language/sandhi/#x) `[c](/history/x)` [d](https://example.org/x) [e](/kaalchakra?id=site.dholavira)')).toEqual(['/archive/site/dholavira', '/language/sandhi', '/kaalchakra']);
  });
  it('finds citations hidden in comments or code', async () => {
    const { findHiddenCitations } = await import('./load');
    expect(findHiddenCitations('<!-- [@src.x] --> text `[@src.y]` ok [@src.z]')).toEqual(['[@src.x]', '[@src.y]']);
  });
});

describe('extents', () => {
  const extent = {
    polygon: [
      [70, 20],
      [80, 20],
      [80, 30],
    ],
    grade: 'C',
    sources: ['src.x-2000-y'],
  };
  it('accepts a sourced polygon, with or without its own years', async () => {
    const { ExtentSchema } = await import('./schema');
    expect(ExtentSchema.safeParse(extent).success).toBe(true);
    const dated = ExtentSchema.parse({ ...extent, label: 'Peak', from: '260 BCE', to: '232 BCE' });
    expect([dated.from, dated.to]).toEqual([-259, -231]);
  });
  it('rejects an unsourced extent, a degenerate polygon, bad coordinates and half a range', async () => {
    const { ExtentSchema } = await import('./schema');
    expect(ExtentSchema.safeParse({ ...extent, sources: [] }).success).toBe(false);
    expect(ExtentSchema.safeParse({ ...extent, polygon: extent.polygon.slice(0, 2) }).success).toBe(false);
    expect(ExtentSchema.safeParse({ ...extent, polygon: [[70, 20], [80, 20], [80, 95]] }).success).toBe(false);
    expect(ExtentSchema.safeParse({ ...extent, from: '260 BCE' }).success).toBe(false);
    expect(ExtentSchema.safeParse({ ...extent, from: '232 BCE', to: '260 BCE' }).success).toBe(false);
  });
  it('is optional on an entity, so existing content is unaffected', () => {
    const entity = {
      id: 'polity.x',
      type: 'polity',
      kind: 'polity',
      names: { en: 'X' },
      summary: 'A polity used to check that extents are optional.',
      datings: [{ ...baseDating, method: 'epigraphic', grade: 'A' }],
      review: { status: 'draft' },
    };
    expect(EntitySchema.parse(entity).extents).toBeUndefined();
    expect(EntitySchema.parse({ ...entity, extents: [extent] }).extents).toHaveLength(1);
  });
});
