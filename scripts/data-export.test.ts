import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { add, commit, init } from 'isomorphic-git';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assembleContent, readContentRecords } from '../src/lib/content/load';
import { latestContentCommitDate } from './content-commit-date';
import { verifyDataExport, writeDataExport } from './data-export';

const fixture = path.join(__dirname, '../src/lib/content/__fixtures__/ok');
const generatedAt = '2026-11-21T18:00:00.000Z';
let temp: string;

beforeEach(() => {
  temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bharat-export-'));
});

afterEach(() => {
  fs.rmSync(temp, { recursive: true, force: true });
});

function fixtureGraph() {
  const { records, errors } = readContentRecords([path.join(fixture, 'content')], path.join(fixture, '_content'));
  for (const article of records.articles) article.file = `_content/${article.category}/${article.slug}.md`;
  const graph = assembleContent(records, errors);
  expect(graph.errors).toEqual([]);
  return graph;
}

function contents(file: string) {
  return fs.readFileSync(path.join(temp, file), 'utf8');
}

function replaceArchive(update: (archive: ReturnType<typeof JSON.parse>) => void) {
  const archive = JSON.parse(contents('archive.json'));
  update(archive);
  const bytes = JSON.stringify(archive);
  fs.writeFileSync(path.join(temp, 'archive.json'), bytes);
  const manifest = JSON.parse(contents('manifest.json'));
  manifest.sha256['archive.json'] = createHash('sha256').update(bytes).digest('hex');
  fs.writeFileSync(path.join(temp, 'manifest.json'), JSON.stringify(manifest));
}

describe('open data export', () => {
  it('writes a deterministic JSON and CSV export, schema, index and manifest', () => {
    const graph = fixtureGraph();
    const entity = graph.entities.get('event.thing')!;
    entity.names.en = 'Thing, "quoted"';
    const counts = writeDataExport(temp, graph, generatedAt);
    expect(counts).toEqual({ entities: 2, sources: 1, articles: 1, corrections: 0, datings: 3 });
    const archive = JSON.parse(contents('archive.json'));
    expect(archive).toMatchObject({ schemaVersion: 1, generatedAt, license: 'CC BY-SA 4.0', corrections: [] });
    expect(archive.articles[0]).not.toHaveProperty('body');
    expect(archive.articles[0].inlineCitations).toEqual([{ id: 'src.doe-2001-a-book', locator: 'p. 12' }, { id: 'src.doe-2001-a-book' }]);
    expect(contents('entities.csv')).toContain('"Thing, ""quoted"""');
    expect(contents('datings.csv')).toContain('event.thing,1,');
    expect(JSON.parse(contents('schema.json')).properties.entities.items.type).toBe('object');
    expect(contents('index.html')).toContain('href="/data/manifest.json"');

    const manifest = JSON.parse(contents('manifest.json'));
    expect(manifest).toMatchObject({ schemaVersion: 1, generatedAt, counts });
    expect(Object.keys(manifest.sha256)).toHaveLength(5);
    for (const [name, hash] of Object.entries(manifest.sha256)) {
      expect(createHash('sha256').update(contents(name)).digest('hex')).toBe(hash);
    }
    writeDataExport(temp, graph, generatedAt);
    expect(JSON.parse(contents('manifest.json'))).toEqual(manifest);
    expect(verifyDataExport(temp, graph, generatedAt)).toEqual(counts);
  });

  it('rejects changed bytes before import', () => {
    const graph = fixtureGraph();
    writeDataExport(temp, graph, generatedAt);
    fs.appendFileSync(path.join(temp, 'entities.csv'), 'unexpected');
    expect(() => verifyDataExport(temp, graph, generatedAt)).toThrow('entities.csv does not match the manifest SHA-256');
  });

  it('applies Zod refinements and loader cross-reference checks even when checksums match', () => {
    const graph = fixtureGraph();
    writeDataExport(temp, graph, generatedAt);
    replaceArchive((archive) => { archive.entities[0].datings[0].grade = 'D'; });
    expect(() => verifyDataExport(temp, graph, generatedAt)).toThrow('grade D is reserved');

    writeDataExport(temp, graph, generatedAt);
    replaceArchive((archive) => { archive.articles[0].inlineCitations[0].id = 'src.missing'; });
    expect(() => verifyDataExport(temp, graph, generatedAt)).toThrow('body: unknown source src.missing');
  });

  it('rejects a self-consistent export that differs from the current content or commit date', () => {
    const changed = fixtureGraph();
    changed.entities.get('event.thing')!.names.en = 'A different title';
    writeDataExport(temp, changed, generatedAt);
    expect(() => verifyDataExport(temp, fixtureGraph(), generatedAt)).toThrow('differs from the current validated content');
    expect(() => verifyDataExport(temp, changed, '2026-11-22T18:00:00.000Z')).toThrow('differs from the current validated content');
  });
});

it('uses the committer time of the last content change and skips a documentation-only commit', async () => {
  const dir = path.join(temp, 'repo');
  const repo = { fs, dir };
  await init({ ...repo, defaultBranch: 'main' });
  fs.mkdirSync(path.join(dir, 'content'));
  fs.writeFileSync(path.join(dir, 'content/record.yaml'), 'id: event.record\n');
  await add({ ...repo, filepath: 'content/record.yaml' });
  const author = { name: 'Test Author', email: 'author@example.invalid', timestamp: 1, timezoneOffset: 0 };
  await commit({ ...repo, message: 'Add content', author, committer: { ...author, timestamp: 100 } });
  fs.writeFileSync(path.join(dir, 'README.md'), '# Readme\n');
  await add({ ...repo, filepath: 'README.md' });
  await commit({ ...repo, message: 'Update docs', author, committer: { ...author, timestamp: 200 } });
  expect(await latestContentCommitDate(dir)).toBe('1970-01-01T00:01:40.000Z');
});
