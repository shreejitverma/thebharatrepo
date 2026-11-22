import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { add, commit, init } from 'isomorphic-git';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assembleContent, readContentRecords } from '../src/lib/content/load';
import { readManifest } from '../src/lib/content/open-data';
import { NO_GIT_NOTE, SHALLOW_NOTE, contentCommitDate, type ContentCommitDate } from './content-commit-date';
import { verifyDataExport, writeDataExport } from './data-export';

const fixture = path.join(__dirname, '../src/lib/content/__fixtures__/ok');
const known: ContentCommitDate = { date: '2026-11-21T18:00:00.000Z', note: null };
const unknown: ContentCommitDate = { date: null, note: SHALLOW_NOTE };
const DATA_FILES = ['archive.json', 'entities.csv', 'datings.csv', 'schema.json'];
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

function snapshot(dir = temp) {
  return Object.fromEntries(fs.readdirSync(dir).sort().map((name) => [name, fs.readFileSync(path.join(dir, name), 'utf8')]));
}

function csvRows(file: string) {
  const [header, ...rows] = contents(file).trimEnd().split('\r\n');
  const columns = header.split(',');
  // The fixture's datings hold no commas or quotes before the sources column, the last one.
  return rows.map((row) => Object.fromEntries(columns.map((column, i) => [column, row.split(',')[i]])));
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
  it('writes a JSON and CSV export, schema and checksummed manifest that verify', () => {
    const graph = fixtureGraph();
    graph.entities.get('event.thing')!.names.en = 'Thing, "quoted"';
    const manifest = writeDataExport(temp, graph, known);
    expect(manifest.counts).toEqual({ entities: 2, sources: 1, articles: 1, corrections: 0, datings: 3 });
    expect(fs.readdirSync(temp).sort()).toEqual([...DATA_FILES, 'manifest.json'].sort());

    const archive = JSON.parse(contents('archive.json'));
    expect(archive).toMatchObject({ schemaVersion: 1, license: 'CC BY-SA 4.0', corrections: [] });
    expect(archive.entities.map((e: { id: string }) => e.id)).toEqual(['event.thing', 'person.someone']);
    expect(archive.articles[0]).not.toHaveProperty('body');
    expect(archive.articles[0].inlineCitations).toEqual([{ id: 'src.doe-2001-a-book', locator: 'p. 12' }, { id: 'src.doe-2001-a-book' }]);
    expect(contents('entities.csv')).toContain('"Thing, ""quoted"""');
    expect(JSON.parse(contents('schema.json')).properties.entities.items.type).toBe('object');

    expect(readManifest(temp)).toEqual(manifest);
    expect(manifest).toMatchObject({ contentCommitDate: known.date, contentCommitDateNote: null });
    for (const name of DATA_FILES) {
      expect(createHash('sha256').update(contents(name)).digest('hex')).toBe(manifest.sha256[name as keyof typeof manifest.sha256]);
    }
    expect(verifyDataExport(temp, graph, known)).toEqual(manifest);
  });

  it('is byte-stable: a rerun rewrites identical files, and only the manifest depends on the commit date', () => {
    const graph = fixtureGraph();
    writeDataExport(temp, graph, known);
    const first = snapshot();
    writeDataExport(temp, fixtureGraph(), known);
    expect(snapshot()).toEqual(first);

    writeDataExport(temp, graph, unknown);
    const shallow = snapshot();
    for (const name of DATA_FILES) expect(shallow[name]).toBe(first[name]);
    expect(JSON.parse(shallow['manifest.json'])).toMatchObject({ contentCommitDate: null, contentCommitDateNote: SHALLOW_NOTE });
    expect(verifyDataExport(temp, graph, unknown).contentCommitDate).toBeNull();
  });

  it('marks the primary dating by the shared ranking rule, not by authoring order', () => {
    const graph = fixtureGraph();
    graph.entities.get('person.someone')!.datings.reverse();
    writeDataExport(temp, graph, known);
    const someone = csvRows('datings.csv').filter((row) => row.entityId === 'person.someone');
    expect(someone.map(({ ordinal, method, primary }) => [ordinal, method, primary])).toEqual([
      ['1', 'traditional-puranic', 'false'],
      ['2', 'epigraphic', 'true'],
    ]);
    const entity = csvRows('entities.csv').find((row) => row.id === 'person.someone')!;
    expect(entity.primaryDate).not.toContain('tradition');
  });

  it('leaves files owned by other build steps alone and removes only its retired files', () => {
    const kaalchakra = '[{"id":"event.thing"}]';
    fs.writeFileSync(path.join(temp, 'kaalchakra.json'), kaalchakra);
    fs.writeFileSync(path.join(temp, 'index.html'), '<!doctype html>');
    const graph = fixtureGraph();
    writeDataExport(temp, graph, known);
    expect(contents('kaalchakra.json')).toBe(kaalchakra);
    expect(fs.existsSync(path.join(temp, 'index.html'))).toBe(false);
    expect(verifyDataExport(temp, graph, known).counts.entities).toBe(2);
  });

  it('rejects changed bytes and missing files before import', () => {
    const graph = fixtureGraph();
    writeDataExport(temp, graph, known);
    fs.appendFileSync(path.join(temp, 'entities.csv'), 'unexpected');
    expect(() => verifyDataExport(temp, graph, known)).toThrow('entities.csv does not match the manifest SHA-256');
    writeDataExport(temp, graph, known);
    fs.rmSync(path.join(temp, 'datings.csv'));
    expect(() => verifyDataExport(temp, graph, known)).toThrow('datings.csv is missing');
  });

  it('applies Zod refinements and loader cross-reference checks even when checksums match', () => {
    const graph = fixtureGraph();
    writeDataExport(temp, graph, known);
    replaceArchive((archive) => { archive.entities[0].datings[0].grade = 'D'; });
    expect(() => verifyDataExport(temp, graph, known)).toThrow('grade D is reserved');

    writeDataExport(temp, graph, known);
    replaceArchive((archive) => { archive.articles[0].inlineCitations[0].id = 'src.missing'; });
    expect(() => verifyDataExport(temp, graph, known)).toThrow('body: unknown source src.missing');
  });

  it('rejects a self-consistent export that differs from the current content or commit date', () => {
    const changed = fixtureGraph();
    changed.entities.get('event.thing')!.names.en = 'A different title';
    writeDataExport(temp, changed, known);
    expect(() => verifyDataExport(temp, fixtureGraph(), known)).toThrow('differs from the current validated content');
    expect(() => verifyDataExport(temp, changed, { date: '2026-11-22T18:00:00.000Z', note: null })).toThrow('manifest.json differs');
    expect(() => verifyDataExport(temp, changed, unknown)).toThrow('manifest.json differs');
  });
});

describe('content commit date', () => {
  const author = { name: 'Test Author', email: 'author@example.invalid', timezoneOffset: 0 };
  let repo: string;

  async function commitFile(file: string, text: string, timestamp: number) {
    fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    fs.writeFileSync(path.join(repo, file), text);
    await add({ fs, dir: repo, filepath: file });
    await commit({ fs, dir: repo, message: `Change ${file}`, author: { ...author, timestamp }, committer: { ...author, timestamp } });
  }

  function shallowClone(depth: number) {
    const target = path.join(temp, `depth-${depth}`);
    execFileSync('git', ['clone', '--quiet', `--depth=${depth}`, `file://${repo}`, target], { stdio: 'pipe' });
    return target;
  }

  /** History, oldest first: content at t=10, content at t=100, then two documentation-only commits. */
  beforeEach(async () => {
    repo = path.join(temp, 'repo');
    await init({ fs, dir: repo, defaultBranch: 'main' });
    await commitFile('content/record.yaml', 'id: event.record\n', 10);
    await commitFile('content/record.yaml', 'id: event.record-renamed\n', 100);
    await commitFile('README.md', '# Readme\n', 200);
    await commitFile('README.md', '# Readme, edited\n', 300);
  });

  it('uses the committer time of the last content change and skips documentation-only commits', async () => {
    expect(await contentCommitDate(repo)).toEqual({ date: '1970-01-01T00:01:40.000Z', note: null });
  });

  it('finds the change in a shallow clone deep enough to hold the change and its parent', async () => {
    expect(await contentCommitDate(shallowClone(4))).toEqual({ date: '1970-01-01T00:01:40.000Z', note: null });
  });

  it('reports an unknown date, never a wrong one, when a shallow clone ends before the change', async () => {
    for (const depth of [1, 2, 3]) expect(await contentCommitDate(shallowClone(depth))).toEqual({ date: null, note: SHALLOW_NOTE });
  });

  it('reports an unknown date without git metadata and fails loudly on a broken repository', async () => {
    const bare = path.join(temp, 'no-git');
    fs.mkdirSync(bare);
    expect(await contentCommitDate(bare)).toEqual({ date: null, note: NO_GIT_NOTE });
    fs.writeFileSync(path.join(repo, '.git', 'HEAD'), 'ref: refs/heads/missing\n');
    await expect(contentCommitDate(repo)).rejects.toThrow('Cannot read the date of the last content change');
  });
});
