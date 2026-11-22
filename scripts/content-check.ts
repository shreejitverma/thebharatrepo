import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT, articlesDir, assembleContent, contentRoots, readContentRecords,
  type ContentProblem,
} from '../src/lib/content/load';
import { CATEGORIES, ENTITY_TYPES, SLUG, citationId, type Entity, type Source } from '../src/lib/content/schema';

const usage = 'npm run content:check -- <file...> [--write-cache]';

export function checkArguments(args: string[]) {
  if (args.length === 1 && args[0] === '--help') {
    console.log(`usage: ${usage}\nhelp: --write-cache records successful checks in content/verification.json for the offline build.`);
    return null;
  }
  const unknownFlag = args.find((arg) => arg.startsWith('-') && arg !== '--write-cache');
  const files = args.filter((arg) => arg !== '--write-cache');
  if (unknownFlag || !files.length) {
    const message = unknownFlag ? `Unknown flag ${unknownFlag}.` : 'Supply at least one content file to check.';
    console.log(`error: ${JSON.stringify(message)}\nusage: ${usage}`);
    process.exitCode = 2;
    return null;
  }
  return { files, writeCache: args.includes('--write-cache') };
}

function contentRootFor(file: string): string | undefined {
  const artDir = articlesDir();
  if (artDir) {
    const [category, name, rest] = path.relative(artDir, file).split(path.sep);
    if (!rest && (CATEGORIES as readonly string[]).includes(category) && name?.endsWith('.md') && SLUG.test(path.basename(name, '.md'))) return artDir;
  }
  return contentRoots().find((root) => {
    const parts = path.relative(root, file).split(path.sep);
    if (parts.length === 1) return parts[0] === 'corrections.yaml';
    const filename = parts[parts.length - 1];
    if (!filename.endsWith('.yaml') || !SLUG.test(path.basename(filename, '.yaml'))) return false;
    return (parts.length === 2 && parts[0] === 'sources')
      || (parts.length === 3 && parts[0] === 'entities' && (ENTITY_TYPES as readonly string[]).includes(parts[1]));
  });
}

export function scopedContent(files: string[]): { errors: ContentProblem[]; entities: Entity[]; sources: Source[] } {
  const selected = new Set<string>();
  const problems: ContentProblem[] = [];
  for (const file of files) {
    const absolute = path.resolve(ROOT, file);
    const root = contentRootFor(absolute);
    if (!root) {
      problems.push({ file, message: 'choose an entity or source .yaml file, corrections.yaml, or an article .md file in its category' });
    } else if (!fs.lstatSync(absolute, { throwIfNoEntry: false })?.isFile()
      || fs.realpathSync(absolute) !== path.join(fs.realpathSync(root), path.relative(root, absolute))) {
      problems.push({ file, message: 'file does not exist or is a symbolic link; provide a regular content file' });
    } else {
      selected.add(path.relative(ROOT, absolute));
    }
  }
  if (problems.length) return { errors: problems, entities: [], sources: [] };

  const { records, errors } = readContentRecords();
  const entities = records.entities.filter(({ file }) => selected.has(file)).map(({ data }) => data);
  const articles = records.articles.filter(({ file }) => selected.has(file));
  const corrections = records.corrections.filter(({ file }) => selected.has(file)).map(({ data }) => data);
  const sourceIds = new Set([
    ...entities.flatMap((e) => [...e.datings, ...e.claims].flatMap((item) => item.sources.map(citationId))),
    ...articles.flatMap((a) => [...a.datings.flatMap((d) => d.sources.map(citationId)), ...a.inlineCitations.map((c) => c.id)]),
    ...corrections.flatMap((c) => c.sources.map(citationId)),
  ]);
  const scope = new Set([...selected, ...records.sources.filter(({ data }) => sourceIds.has(data.id)).map(({ file }) => file)]);
  const graph = assembleContent(records, errors, scope);
  const sources = [...new Map(records.sources
    .filter(({ file }) => scope.has(file))
    .map(({ data }) => [data.id, graph.sources.get(data.id)!])).values()];
  return { errors: graph.errors.filter(({ file }) => scope.has(file)), entities, sources };
}
