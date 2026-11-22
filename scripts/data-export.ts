import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { stringify as csv } from 'csv-stringify/sync';
import { z } from 'zod';
import {
  CONTENT_DIR, ROOT, assembleContent, readContentRecords,
  type ArticleMetadata, type ContentGraph,
} from '../src/lib/content/load';
import {
  ArticleFrontmatterSchema, CATEGORIES, CorrectionSchema, EntitySchema, SLUG, SOURCE_ID, SourceSchema,
} from '../src/lib/content/schema';

const SCHEMA_VERSION = 1;
const DATA_LICENSE = 'CC BY-SA 4.0';
const LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';

const ArticleMetadataSchema = ArticleFrontmatterSchema.extend({
  category: z.enum(CATEGORIES),
  slug: z.string().regex(SLUG),
  file: z.string(),
  inlineCitations: z.array(z.strictObject({ id: z.string().regex(SOURCE_ID), locator: z.string().optional() })),
}).refine((article) => article.file === `_content/${article.category}/${article.slug}.md`, {
  path: ['file'],
  message: 'article file must match its category and slug',
});

const ArchiveSchema = z.strictObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  generatedAt: z.iso.datetime(),
  license: z.literal(DATA_LICENSE),
  entities: z.array(EntitySchema),
  sources: z.array(SourceSchema),
  articles: z.array(ArticleMetadataSchema),
  corrections: z.array(CorrectionSchema),
});

const downloads = {
  'archive.json': 'Archive JSON',
  'entities.csv': 'Entities CSV',
  'datings.csv': 'Datings CSV',
  'schema.json': 'JSON Schema',
} as const;

const index = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Open data | The Bharat Repo</title>
  <style>
    html { color-scheme: light dark }
    body { font: 1rem/1.6 system-ui, sans-serif; max-width: 42rem; margin: 3rem auto; padding: 0 1.25rem }
  </style>
</head>
<body>
  <nav><a href="/">The Bharat Repo</a></nav>
  <main>
    <h1>Open data</h1>
    <p>Download the archive's entities, sources, article metadata and corrections.</p>
    <ul>
      ${Object.entries(downloads).map(([file, label]) => `<li><a href="/data/${file}">${label}</a></li>`).join('\n      ')}
      <li><a href="/data/manifest.json">Manifest and checksums</a></li>
    </ul>
    <p>Archive data is available under <a href="${LICENSE_URL}">${DATA_LICENSE}</a>.</p>
  </main>
</body>
</html>
`;

function json(value: unknown): string {
  return JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]))
      : item,
  2) + '\n';
}
const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const byId = <T extends { id: string }>(a: T, b: T) => compare(a.id, b.id);

function assertValid(graph: ContentGraph<ArticleMetadata>, context: string) {
  if (graph.errors.length) {
    throw new Error(`${context} failed content validation:\n${graph.errors.map(({ file, message }) => `  ${file}: ${message}`).join('\n')}`);
  }
}

export function loadPublicContent(): ContentGraph {
  const { records, errors } = readContentRecords([CONTENT_DIR], path.join(ROOT, '_content'));
  return assembleContent(records, errors);
}

function artifactContents(graph: ContentGraph<ArticleMetadata>, generatedAt: string) {
  assertValid(graph, 'Archive');
  const entities = [...graph.entities.values()].sort(byId);
  const sources = [...graph.sources.values()].sort(byId);
  const articles = graph.articles.map((article) => {
    const metadata = { ...article } as ArticleMetadata & { body?: string };
    delete metadata.body;
    return metadata;
  }).sort((a, b) => compare(a.file, b.file));
  const corrections = graph.corrections;
  const datings = entities.flatMap((entity) => entity.datings.map((dating, index) => ({
    entityId: entity.id,
    ordinal: index + 1,
    method: dating.method,
    grade: dating.grade,
    earliest: dating.range.earliest,
    latest: dating.range.latest,
    best: dating.range.best,
    precision: dating.range.precision,
    circa: String(dating.range.circa),
    label: dating.label,
    note: dating.note,
    sources: JSON.stringify(dating.sources),
  })));
  const counts = {
    entities: entities.length, sources: sources.length, articles: articles.length,
    corrections: corrections.length, datings: datings.length,
  };
  const header = { schemaVersion: SCHEMA_VERSION, generatedAt, license: DATA_LICENSE };
  const files = {
    'archive.json': json(ArchiveSchema.parse({ ...header, entities, sources, articles, corrections })),
    'entities.csv': csv(entities.map((entity) => ({
      id: entity.id, type: entity.type, kind: entity.kind, name: entity.names.en,
      summary: entity.summary, region: entity.region, reviewStatus: entity.review.status,
    })), { header: true, columns: ['id', 'type', 'kind', 'name', 'summary', 'region', 'reviewStatus'], record_delimiter: 'windows' }),
    'datings.csv': csv(datings, {
      header: true,
      columns: ['entityId', 'ordinal', 'method', 'grade', 'earliest', 'latest', 'best', 'precision', 'circa', 'label', 'note', 'sources'],
      record_delimiter: 'windows',
    }),
    'schema.json': json(z.toJSONSchema(ArchiveSchema, { io: 'output' })),
    'index.html': index,
  };
  const manifest = { ...header, licenseUrl: LICENSE_URL, counts, sha256: Object.fromEntries(
    Object.entries(files).map(([name, contents]) => [name, sha256(contents)]),
  ) };
  return { manifest, files: { ...files, 'manifest.json': json(manifest) } };
}

export function writeDataExport(dir: string, graph: ContentGraph<ArticleMetadata>, generatedAt: string) {
  const { files, manifest } = artifactContents(graph, generatedAt);
  fs.mkdirSync(dir, { recursive: true });
  const staging = fs.mkdtempSync(path.join(path.dirname(dir), '.data-export-'));
  try {
    for (const [name, contents] of Object.entries(files)) fs.writeFileSync(path.join(staging, name), contents);
    // Publish the checksums last so an interrupted write cannot advertise a complete new export.
    for (const name of Object.keys(files)) fs.renameSync(path.join(staging, name), path.join(dir, name));
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
  return manifest.counts;
}

function parseJson(contents: Buffer, name: string): unknown {
  try {
    return JSON.parse(contents.toString('utf8'));
  } catch (error) {
    throw new Error(`${name} is not valid JSON`, { cause: error });
  }
}

export function verifyDataExport(dir: string, current: ContentGraph<ArticleMetadata>, generatedAt: string) {
  const expected = artifactContents(current, generatedAt);
  const manifestFile = fs.readFileSync(path.join(dir, 'manifest.json'));
  const manifest = z.object({ sha256: z.record(z.string(), z.string().regex(/^[a-f0-9]{64}$/)) })
    .parse(parseJson(manifestFile, 'manifest.json'));
  const actual = new Map<string, Buffer>();
  for (const name of Object.keys(expected.manifest.sha256)) {
    const contents = fs.readFileSync(path.join(dir, name));
    if (sha256(contents) !== manifest.sha256[name]) throw new Error(`${name} does not match the manifest SHA-256`);
    actual.set(name, contents);
  }

  const imported = ArchiveSchema.parse(parseJson(actual.get('archive.json')!, 'archive.json'));
  const reloaded = assembleContent({
    entities: imported.entities.map((data) => ({ data, file: `content/entities/${data.id.replace('.', '/')}.yaml` })),
    sources: imported.sources.map((data) => ({ data, file: `content/sources/${data.id.slice(4)}.yaml` })),
    articles: imported.articles,
    corrections: imported.corrections.map((data) => ({ data, file: 'content/corrections.yaml' })),
  });
  assertValid(reloaded, 'Export re-import');
  const roundTrip = artifactContents(reloaded, imported.generatedAt);
  for (const [name, contents] of Object.entries(expected.files)) {
    const actualFile = name === 'manifest.json' ? manifestFile : actual.get(name)!;
    if (!actualFile.equals(Buffer.from(roundTrip.files[name as keyof typeof roundTrip.files]))) {
      throw new Error(`${name} changed during re-import. Run npm run data:export to regenerate it.`);
    }
    if (!actualFile.equals(Buffer.from(contents))) {
      throw new Error(`${name} differs from the current validated content. Run npm run data:export to regenerate it.`);
    }
  }
  return expected.manifest.counts;
}
