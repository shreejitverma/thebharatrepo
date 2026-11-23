/**
 * The open data bundle served from /data/: its files, licence and manifest shape. Shared by the
 * exporter (scripts/data-export.ts) and the /data page, which reads the generated manifest at build time.
 */

import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';

export const DATA_SCHEMA_VERSION = 1;
export const DATA_LICENSE = 'CC BY-SA 4.0';
export const DATA_LICENSE_URL = 'https://creativecommons.org/licenses/by-sa/4.0/';

/** How the /data page writes a record count: Indian digit grouping, as in "1,027" and "1,02,700". */
export function formatCount(n: number): string {
  return n.toLocaleString('en-IN');
}

/** Every file the export writes, besides manifest.json, in the order the /data page lists them. */
export const DATA_FILES = {
  'archive.json': {
    label: 'Full archive',
    format: 'JSON',
    description: 'Every entity with its datings, claims and relations, every source, article metadata with inline citations, the corrections log, the learning paths and the published debates.',
  },
  'entities.csv': {
    label: 'Entities',
    format: 'CSV',
    description: 'One row per entity: identifier, type, kind, English name, primary date, summary, region and review status.',
  },
  'datings.csv': {
    label: 'Datings',
    format: 'CSV',
    description: 'One row per dating, with its method, evidence grade, year range, notes and cited source identifiers.',
  },
  'schema.json': {
    label: 'Archive schema',
    format: 'JSON Schema',
    description: 'The structure of archive.json, generated from the validators the archive itself is checked with.',
  },
} as const;
export type DataFile = keyof typeof DATA_FILES;

/**
 * Files earlier versions of the export wrote into public/data. The export removes these, and only these,
 * so a stale copy is never deployed. Other files in public/data, such as kaalchakra.json, belong to
 * other build steps and are left untouched.
 */
export const RETIRED_DATA_FILES = ['index.html'] as const;

const sha256Hex = z.string().regex(/^[a-f0-9]{64}$/);
const count = z.number().int().nonnegative();

export const ManifestSchema = z.strictObject({
  schemaVersion: z.literal(DATA_SCHEMA_VERSION),
  license: z.literal(DATA_LICENSE),
  licenseUrl: z.literal(DATA_LICENSE_URL),
  contentCommitDate: z.iso.datetime().nullable(),
  contentCommitDateNote: z.string().min(1).nullable(),
  counts: z.strictObject({ entities: count, sources: count, articles: count, corrections: count, datings: count, debates: count, learningPaths: count }),
  sha256: z.strictObject(Object.fromEntries(Object.keys(DATA_FILES).map((name) => [name, sha256Hex])) as Record<DataFile, typeof sha256Hex>),
}).refine((m) => (m.contentCommitDate === null) !== (m.contentCommitDateNote === null), {
  path: ['contentCommitDateNote'],
  message: 'a note is required exactly when the content commit date is unknown',
});
export type Manifest = z.infer<typeof ManifestSchema>;

export const DATA_DIR = path.join(process.cwd(), 'public', 'data');

/** Reads and validates the generated manifest; throws with the fix when the export has not run. */
export function readManifest(dir = DATA_DIR): Manifest {
  const file = path.join(dir, 'manifest.json');
  let text: string;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    throw new Error(`${path.relative(process.cwd(), file)} is missing. Run npm run data:export first.`, { cause: error });
  }
  return ManifestSchema.parse(JSON.parse(text));
}
