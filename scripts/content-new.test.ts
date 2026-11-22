import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import YAML from 'yaml';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assembleContent, readContentRecords } from '../src/lib/content/load';
import { ENTITY_TYPES, EntitySchema, SourceSchema } from '../src/lib/content/schema';
import { scaffoldContent } from './content-new';

let root: string;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'bharat-scaffold-'));
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe('content scaffolds', () => {
  it.each(ENTITY_TYPES)('writes a schema-valid draft for %s with explicit BCE strings', (type) => {
    expect(scaffoldContent('entity', [type, 'sample-record'], root)).toBe(0);
    const file = path.join(root, 'content/entities', type, 'sample-record.yaml');
    const text = fs.readFileSync(file, 'utf8');
    const entity = EntitySchema.parse(YAML.parse(text));
    expect(text).toContain('earliest: "1 BCE"');
    expect(text).toContain('latest: "1 BCE"');
    expect(entity.id).toBe(`${type}.sample-record`);
    expect(entity.review.status).toBe('draft');
    expect(entity.claims).toHaveLength(1);
    expect(entity.datings).toHaveLength(1);
    const { records, errors } = readContentRecords([path.join(root, 'content')], null);
    expect(errors).toEqual([]);
    const messages = assembleContent(records, errors).errors.map((error) => error.message);
    expect(messages).toContain('names.en: Enter the English name');
    expect(messages).toContain('datings[0].note: Replace the example years and explain the method, precision and grade');
    expect(messages).toContain('claims[0].sources[0]: replace the placeholder with a real src.<slug> citation');
  });

  it('writes a source that passes Zod and fails authoring checks until filled', () => {
    const slug = 'doe-2001-a-book';
    expect(scaffoldContent('source', [slug], root)).toBe(0);
    const file = path.join(root, 'content/sources', `${slug}.yaml`);
    expect(SourceSchema.parse(YAML.parse(fs.readFileSync(file, 'utf8'))).id).toBe(`src.${slug}`);
    const { records, errors } = readContentRecords([path.join(root, 'content')], null);
    expect(errors).toEqual([]);
    expect(assembleContent(records, errors).errors.map(({ message }) => message)).toEqual([
      'title: Enter the title exactly as it appears at the registry or publisher',
      'authors[0]: Enter the author or organisation, or use editors, publisher or corpus',
      'url: replace the placeholder with a verifiable URL, DOI, ISBN or OCLC number',
    ]);
  });

  it('rejects bad inputs without creating files, is a no-op on rerun, and never replaces an edited record', () => {
    for (const args of [[], ['wrong-type', 'example'], ['event', '../example'], ['event', 'a--b'], ['event', 'example', '--force']]) {
      expect(scaffoldContent('entity', args, root)).toBe(2);
    }
    expect(fs.readdirSync(root)).toEqual([]);
    expect(scaffoldContent('source', ['existing'], root)).toBe(0);
    const file = path.join(root, 'content/sources/existing.yaml');
    const scaffold = fs.readFileSync(file, 'utf8');
    expect(scaffoldContent('source', ['existing'], root)).toBe(0);
    expect(fs.readFileSync(file, 'utf8')).toBe(scaffold);
    expect(console.log).toHaveBeenLastCalledWith(expect.stringContaining('unchanged: content/sources/existing.yaml'));
    fs.writeFileSync(file, '# existing content\n');
    expect(scaffoldContent('source', ['existing'], root)).toBe(1);
    expect(fs.readFileSync(file, 'utf8')).toBe('# existing content\n');
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('already exists'));
  });
});
