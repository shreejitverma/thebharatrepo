/**
 * Merges a validated staging batch into published content.
 *
 *   tsx scripts/content-merge-staging.ts staging/<batch> [--dry-run]
 *
 * - Sources: a source whose id already exists is skipped when it names the same work (same DOI or ISBN,
 *   or same title); a different work under the same id is a conflict.
 * - Entities: an id that already exists is a conflict (never overwritten).
 * - Successful verification cache entries are merged into content/verification.json.
 * Exit code 1 on any conflict; nothing is written for conflicting files.
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const batch = process.argv[2];
const dry = process.argv.includes('--dry-run');
if (!batch || !fs.existsSync(batch)) {
  console.error('usage: tsx scripts/content-merge-staging.ts staging/<batch> [--dry-run]');
  process.exit(2);
}

const CONTENT = path.join(process.cwd(), 'content');
const conflicts: string[] = [];
let added = 0;
let skipped = 0;

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.yaml') ? [path.join(dir, e.name)] : []));
}

function sameWork(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  if (a.doi && b.doi) return String(a.doi).toLowerCase() === String(b.doi).toLowerCase();
  if (a.isbn && b.isbn) return a.isbn === b.isbn;
  return String(a.title).toLowerCase() === String(b.title).toLowerCase();
}

for (const file of walk(path.join(batch, 'sources'))) {
  const target = path.join(CONTENT, 'sources', path.basename(file));
  if (fs.existsSync(target)) {
    const a = YAML.parse(fs.readFileSync(file, 'utf8'));
    const b = YAML.parse(fs.readFileSync(target, 'utf8'));
    if (sameWork(a, b)) skipped++;
    else conflicts.push(`source ${a.id}: staging names "${a.title}" but content names "${b.title}"`);
    continue;
  }
  if (!dry) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(file, target);
  }
  added++;
}

for (const file of walk(path.join(batch, 'entities'))) {
  const relPath = path.relative(path.join(batch, 'entities'), file);
  const target = path.join(CONTENT, 'entities', relPath);
  if (fs.existsSync(target)) {
    conflicts.push(`entity ${relPath} already exists in content/`);
    continue;
  }
  if (!dry) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(file, target);
  }
  added++;
}

// Articles: staging/<batch>/_content/<category>/<slug>.md replaces the published article of the same path.
const articleRoot = path.join(batch, '_content');
if (fs.existsSync(articleRoot)) {
  for (const cat of fs.readdirSync(articleRoot)) {
    const dir = path.join(articleRoot, cat);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md'))) {
      if (!dry) {
        fs.mkdirSync(path.join(process.cwd(), '_content', cat), { recursive: true });
        fs.copyFileSync(path.join(dir, f), path.join(process.cwd(), '_content', cat, f));
      }
      added++;
    }
  }
}

// Corrections are appended to the public log.
const stagingCorrections = path.join(batch, 'corrections.yaml');
if (fs.existsSync(stagingCorrections) && !dry) {
  const shared = path.join(CONTENT, 'corrections.yaml');
  const into = fs.existsSync(shared) ? (YAML.parse(fs.readFileSync(shared, 'utf8')) ?? []) : [];
  const from = YAML.parse(fs.readFileSync(stagingCorrections, 'utf8')) ?? [];
  fs.writeFileSync(shared, YAML.stringify([...into, ...from], { lineWidth: 0 }));
}

const stagingCache = path.join(batch, 'verification.json');
if (fs.existsSync(stagingCache) && !dry) {
  const shared = path.join(CONTENT, 'verification.json');
  const into = fs.existsSync(shared) ? JSON.parse(fs.readFileSync(shared, 'utf8')) : {};
  const from = JSON.parse(fs.readFileSync(stagingCache, 'utf8')) as Record<string, { ok: boolean }>;
  for (const [k, v] of Object.entries(from)) if (v.ok && !into[k]) into[k] = v;
  const sorted = Object.fromEntries(Object.entries(into).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(shared, JSON.stringify(sorted, null, 2) + '\n');
}

console.log(`merge ${batch}${dry ? ' (dry run)' : ''}: ${added} added, ${skipped} duplicate sources skipped, ${conflicts.length} conflicts`);
for (const c of conflicts) console.log(`  CONFLICT ${c}`);
if (conflicts.length) process.exit(1);
