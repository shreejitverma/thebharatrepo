import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ROOT } from '../src/lib/content/load';
import { scopedContent } from './content-check';

let temp: string;

beforeEach(() => {
  temp = fs.mkdtempSync(path.join(os.tmpdir(), 'bharat-check-'));
  const fixture = path.join(ROOT, 'src/lib/content/__fixtures__/ok');
  fs.cpSync(fixture, temp, { recursive: true });
  vi.stubEnv('CONTENT_ROOTS', path.relative(ROOT, path.join(temp, 'content')));
  vi.stubEnv('ARTICLES_ROOT', path.relative(ROOT, path.join(temp, '_content')));
});

afterEach(() => {
  fs.rmSync(temp, { recursive: true, force: true });
  vi.unstubAllEnvs();
});

it('selects the cited sources for the requested entity and article despite an unrelated error', () => {
  fs.writeFileSync(path.join(temp, 'content/entities/person/unfinished.yaml'), 'summary: [');
  const result = scopedContent([
    path.join(temp, 'content/entities/event/thing.yaml'),
    path.join(temp, '_content/history/fixture.md'),
  ]);
  expect(result.errors).toEqual([]);
  expect(result.entities.map((entity) => entity.id)).toEqual(['event.thing']);
  expect(result.sources.map((source) => source.id)).toEqual(['src.doe-2001-a-book']);
});

it('shows duplicate identifier errors even when the selected source sorts first', () => {
  const selected = path.join(temp, 'content/sources/doe-2001-a-book.yaml');
  const duplicate = path.join(temp, 'content/sources/zz-duplicate.yaml');
  fs.writeFileSync(duplicate, fs.readFileSync(selected, 'utf8').replace('src.doe-2001-a-book', 'src.zz-duplicate'));
  expect(scopedContent([selected]).errors[0].message).toContain('cite one source id per work');
});

it('returns actionable errors for missing, unsupported and malformed files', () => {
  expect(scopedContent([path.join(temp, 'content/sources/missing.yaml')]).errors[0].message).toContain('file does not exist');
  expect(scopedContent([path.join(temp, 'unknown.md')]).errors[0].message).toContain('choose an entity or source');
  const article = path.join(temp, '_content/history/fixture.md');
  fs.writeFileSync(article, '---\ntitle: [\n---\n');
  expect(scopedContent([article]).errors[0].message).toContain('cannot read Markdown frontmatter');
});
