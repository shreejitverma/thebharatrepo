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
    expect(DatingSchema.safeParse({ ...baseDating, method: 'epigraphic', grade: 'A', range: { earliest: 10, latest: 5, precision: 'year' } }).success).toBe(false);
    expect(DatingSchema.safeParse({ ...baseDating, method: 'epigraphic', grade: 'A', range: { earliest: 1, latest: 5, best: 9, precision: 'year' } }).success).toBe(false);
    expect(DatingSchema.safeParse({ ...baseDating, method: 'documentary', grade: 'A', range: { earliest: 2200, latest: 2200, precision: 'year' } }).success).toBe(false);
  });
  it('allows cosmological precision only for tradition', () => {
    const cosmic = { earliest: -1.97e9, latest: -1.97e9, precision: 'cosmological' };
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
      expect(msgs).toContain('relation related-to -> unknown entity person.ghost');
      expect(msgs).toContain('article body cites no sources; use [@src.id, locator]');
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
