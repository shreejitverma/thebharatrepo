import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { stringify as csv } from 'csv-stringify/sync';
import { z } from 'zod';
import { primaryDating, summarizeDatings } from '../src/lib/content/lens';
import {
  CONTENT_DIR, ROOT, assembleContent, readContentRecords,
  type ArticleMetadata, type ContentGraph,
} from '../src/lib/content/load';
import {
  DATA_FILES, DATA_LICENSE, DATA_LICENSE_URL, DATA_SCHEMA_VERSION, ManifestSchema, RETIRED_DATA_FILES,
  type DataFile, type Manifest,
} from '../src/lib/content/open-data';
import {
  ArticleFrontmatterSchema, CATEGORIES, CorrectionSchema, EntitySchema, SLUG, SOURCE_ID, SourceSchema,
} from '../src/lib/content/schema';
import type { ContentCommitDate } from './content-commit-date';

const ArticleMetadataSchema = ArticleFrontmatterSchema.extend({
  category: z.enum(CATEGORIES),
  slug: z.string().regex(SLUG),
  file: z.string(),
  inlineCitations: z.array(z.strictObject({ id: z.string().regex(SOURCE_ID), locator: z.string().optional() })),
}).refine((article) => article.file === `_content/${article.category}/${article.slug}.md`, {
  path: ['file'],
  message: 'article file must match its category and slug',
});

/**
 * archive.json is a pure function of the validated content, so its bytes change only when content does.
 * The content commit date, which depends on the checkout's git history, lives in manifest.json alone.
 */
const ArchiveSchema = z.strictObject({
  schemaVersion: z.literal(DATA_SCHEMA_VERSION),
  license: z.literal(DATA_LICENSE),
  entities: z.array(EntitySchema),
  sources: z.array(SourceSchema),
  articles: z.array(ArticleMetadataSchema),
  corrections: z.array(CorrectionSchema),
});

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

function artifactContents(graph: ContentGraph<ArticleMetadata>, commit: ContentCommitDate) {
  assertValid(graph, 'Archive');
  const entities = [...graph.entities.values()].sort(byId);
  const sources = [...graph.sources.values()].sort(byId);
  const articles = graph.articles.map((article) => {
    const metadata = { ...article } as ArticleMetadata & { body?: string };
    delete metadata.body;
    return metadata;
  }).sort((a, b) => compare(a.file, b.file));
  const corrections = graph.corrections;
  const datings = entities.flatMap((entity) => {
    const primary = primaryDating(entity.datings);
    return entity.datings.map((dating, index) => ({
      entityId: entity.id,
      ordinal: index + 1,
      primary: String(dating === primary),
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
    }));
  });
  const counts = {
    entities: entities.length, sources: sources.length, articles: articles.length,
    corrections: corrections.length, datings: datings.length,
  };
  const csvOptions = { header: true, record_delimiter: 'windows' } as const;
  const files: Record<DataFile, string> = {
    'archive.json': json(ArchiveSchema.parse({
      schemaVersion: DATA_SCHEMA_VERSION, license: DATA_LICENSE, entities, sources, articles, corrections,
    })),
    'entities.csv': csv(entities.map((entity) => ({
      id: entity.id, type: entity.type, kind: entity.kind, name: entity.names.en, primaryDate: summarizeDatings(entity.datings),
      summary: entity.summary, region: entity.region, reviewStatus: entity.review.status,
    })), { ...csvOptions, columns: ['id', 'type', 'kind', 'name', 'primaryDate', 'summary', 'region', 'reviewStatus'] }),
    'datings.csv': csv(datings, {
      ...csvOptions,
      columns: ['entityId', 'ordinal', 'primary', 'method', 'grade', 'earliest', 'latest', 'best', 'precision', 'circa', 'label', 'note', 'sources'],
    }),
    'schema.json': json(z.toJSONSchema(ArchiveSchema, { io: 'output' })),
  };
  const manifest: Manifest = ManifestSchema.parse({
    schemaVersion: DATA_SCHEMA_VERSION,
    license: DATA_LICENSE,
    licenseUrl: DATA_LICENSE_URL,
    contentCommitDate: commit.date,
    contentCommitDateNote: commit.note,
    counts,
    sha256: Object.fromEntries(Object.entries(files).map(([name, contents]) => [name, sha256(contents)])),
  });
  return { manifest, files: { ...files, 'manifest.json': json(manifest) } };
}

/**
 * Writes the bundle into `dir`, replacing only the files the export owns. Rerunning with the same content
 * and commit date rewrites identical bytes.
 */
export function writeDataExport(dir: string, graph: ContentGraph<ArticleMetadata>, commit: ContentCommitDate) {
  const { files, manifest } = artifactContents(graph, commit);
  fs.mkdirSync(dir, { recursive: true });
  const staging = fs.mkdtempSync(path.join(path.dirname(dir), '.data-export-'));
  try {
    for (const [name, contents] of Object.entries(files)) fs.writeFileSync(path.join(staging, name), contents);
    // manifest.json is the last key, so an interrupted write cannot advertise checksums for files not yet in place.
    for (const name of Object.keys(files)) fs.renameSync(path.join(staging, name), path.join(dir, name));
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
  for (const name of RETIRED_DATA_FILES) fs.rmSync(path.join(dir, name), { force: true });
  return manifest;
}

function parseJson(contents: Buffer, name: string): unknown {
  try {
    return JSON.parse(contents.toString('utf8'));
  } catch (error) {
    throw new Error(`${name} is not valid JSON`, { cause: error });
  }
}

function readExportFile(dir: string, name: string): Buffer {
  try {
    return fs.readFileSync(path.join(dir, name));
  } catch (error) {
    throw new Error(`${name} is missing from ${dir}. Run npm run data:export to regenerate it.`, { cause: error });
  }
}

/**
 * Proves the published bundle round-trips: checksums match the manifest, archive.json re-imports through
 * the Zod schemas and the loader's integrity checks, the re-import regenerates every file byte for byte,
 * and the bundle equals what the current content and commit date produce.
 */
export function verifyDataExport(dir: string, current: ContentGraph<ArticleMetadata>, commit: ContentCommitDate) {
  const expected = artifactContents(current, commit);
  const manifestFile = readExportFile(dir, 'manifest.json');
  const manifest = ManifestSchema.parse(parseJson(manifestFile, 'manifest.json'));
  const actual = new Map<string, Buffer>([['manifest.json', manifestFile]]);
  for (const name of Object.keys(DATA_FILES) as DataFile[]) {
    const contents = readExportFile(dir, name);
    if (sha256(contents) !== manifest.sha256[name]) throw new Error(`${name} does not match the manifest SHA-256`);
    actual.set(name, contents);
  }

  const imported = ArchiveSchema.parse(parseJson(actual.get('archive.json')!, 'archive.json'));
  const reloaded = assembleContent({
    entities: imported.entities.map((data) => ({ data, file: `content/entities/${data.id.replace('.', '/')}.yaml` })),
    sources: imported.sources.map((data) => ({ data, file: `content/sources/${data.id.slice(4)}.yaml` })),
    articles: imported.articles,
    corrections: imported.corrections.map((data) => ({ data, file: 'content/corrections.yaml' })),
    debates: [],
    learningPaths: [],
  });
  assertValid(reloaded, 'Export re-import');
  const roundTrip = artifactContents(reloaded, {
    date: manifest.contentCommitDate, note: manifest.contentCommitDateNote,
  } as ContentCommitDate);
  for (const [name, contents] of Object.entries(expected.files)) {
    const actualFile = actual.get(name)!;
    if (!actualFile.equals(Buffer.from(roundTrip.files[name as keyof typeof roundTrip.files]))) {
      throw new Error(`${name} changed during re-import. Run npm run data:export to regenerate it.`);
    }
    if (!actualFile.equals(Buffer.from(contents))) {
      throw new Error(`${name} differs from the current validated content. Run npm run data:export to regenerate it.`);
    }
  }
  return expected.manifest;
}
