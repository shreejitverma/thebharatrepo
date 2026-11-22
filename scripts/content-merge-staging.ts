/**
 * Merges a staging batch into published content, atomically.
 *
 *   tsx scripts/content-merge-staging.ts staging/<batch> [--dry-run]
 *
 * 1. Validates published content plus the batch together; any problem aborts before anything is written.
 * 2. Plans every write: new sources and entities are added; a source id that already exists is skipped
 *    only when it is the same work (same identifiers and title); any other collision is a conflict.
 *    Entity collisions are always conflicts. Articles replace the published article at the same path.
 * 3. Aborts on any conflict, otherwise writes everything. Corrections are appended without duplicates.
 * The staging verification cache is never copied: run content:verify-sources after merging.
 */

import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { CATEGORIES } from '../src/lib/content/schema';

const batch = process.argv[2];
const dry = process.argv.includes('--dry-run');
if (!batch || !fs.existsSync(batch)) {
  console.error('usage: tsx scripts/content-merge-staging.ts staging/<batch> [--dry-run]');
  process.exit(2);
}

const ROOT = process.cwd();
const CONTENT = path.join(ROOT, 'content');
const batchArticles = path.join(batch, '_content');

async function main() {
  // 1. Validate published content plus this batch.
  process.env.CONTENT_ROOTS = `content:${path.relative(ROOT, batch)}`;
  process.env.ARTICLES_ROOT = fs.existsSync(batchArticles) ? path.relative(ROOT, batchArticles) : '';
  const { loadContentUncached } = await import('../src/lib/content/load');
  const g = loadContentUncached();
  if (g.errors.length) {
    console.log(`merge ${batch}: aborted, ${g.errors.length} validation problem(s):`);
    for (const e of g.errors.slice(0, 40)) console.log(`  ${e.file}: ${e.message}`);
    process.exit(1);
  }

  // 2. Plan.
  const walk = (dir: string): string[] =>
    !fs.existsSync(dir) ? [] : fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.yaml') ? [path.join(dir, e.name)] : []));
  const writes: { from: string; to: string }[] = [];
  const conflicts: string[] = [];
  let skipped = 0;

  const key = (s: Record<string, unknown>) => JSON.stringify([String(s.doi ?? '').toLowerCase(), s.isbn ?? '', s.oclc ?? '', s.url ?? '', String(s.title ?? '').toLowerCase().trim()]);
  for (const file of walk(path.join(batch, 'sources'))) {
    const target = path.join(CONTENT, 'sources', path.basename(file));
    if (fs.existsSync(target)) {
      const a = YAML.parse(fs.readFileSync(file, 'utf8'));
      const b = YAML.parse(fs.readFileSync(target, 'utf8'));
      if (key(a) === key(b)) skipped++;
      else conflicts.push(`source ${a.id}: staging and published versions differ (identifiers or title)`);
    } else writes.push({ from: file, to: target });
  }
  for (const file of walk(path.join(batch, 'entities'))) {
    const target = path.join(CONTENT, 'entities', path.relative(path.join(batch, 'entities'), file));
    if (fs.existsSync(target)) conflicts.push(`entity ${path.relative(CONTENT, target)} already exists`);
    else writes.push({ from: file, to: target });
  }
  if (fs.existsSync(batchArticles)) {
    for (const cat of fs.readdirSync(batchArticles)) {
      const dir = path.join(batchArticles, cat);
      if (!fs.statSync(dir).isDirectory()) continue;
      if (!(CATEGORIES as readonly string[]).includes(cat)) {
        conflicts.push(`article directory ${cat} is not a category`);
        continue;
      }
      for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md'))) writes.push({ from: path.join(dir, f), to: path.join(ROOT, '_content', cat, f) });
    }
  }

  // 3. Apply.
  if (conflicts.length) {
    console.log(`merge ${batch}: aborted, ${conflicts.length} conflict(s), nothing written`);
    for (const c of conflicts) console.log(`  CONFLICT ${c}`);
    process.exit(1);
  }
  let corrections = 0;
  if (!dry) {
    for (const w of writes) {
      fs.mkdirSync(path.dirname(w.to), { recursive: true });
      fs.copyFileSync(w.from, w.to);
    }
    const stagingCorrections = path.join(batch, 'corrections.yaml');
    if (fs.existsSync(stagingCorrections)) {
      const shared = path.join(CONTENT, 'corrections.yaml');
      const into: Record<string, string>[] = fs.existsSync(shared) ? (YAML.parse(fs.readFileSync(shared, 'utf8')) ?? []) : [];
      const seen = new Set(into.map((c) => `${c.date}|${c.target}|${c.before}`));
      for (const c of (YAML.parse(fs.readFileSync(stagingCorrections, 'utf8')) ?? []) as Record<string, string>[]) {
        const k = `${c.date}|${c.target}|${c.before}`;
        if (!seen.has(k)) {
          into.push(c);
          seen.add(k);
          corrections++;
        }
      }
      fs.writeFileSync(shared, YAML.stringify(into, { lineWidth: 0 }));
    }
  }
  console.log(`merge ${batch}${dry ? ' (dry run)' : ''}: ${writes.length} files written, ${skipped} duplicate sources skipped, ${corrections} corrections appended. Next: npm run content:verify-sources`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
