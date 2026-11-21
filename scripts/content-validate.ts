/**
 * Validates all content against the schemas and cross-references.
 * Usage: tsx scripts/content-validate.ts [--report]
 * Exit code 1 when any problem is found.
 */

import { loadContentUncached } from '../src/lib/content/load';
import { GRADES, KINDS, citationId, isTraditional } from '../src/lib/content/schema';

const g = loadContentUncached();
const report = process.argv.includes('--report');
const scopeIdx = process.argv.indexOf('--scope');
const scope = scopeIdx > 0 ? process.argv[scopeIdx + 1] : undefined;
if (scope) g.errors = g.errors.filter((e) => e.file.startsWith(scope));

if (report) {
  const ents = [...g.entities.values()];
  const datings = ents.flatMap((e) => e.datings);
  const byGrade = Object.fromEntries(GRADES.map((gr) => [gr, datings.filter((d) => d.grade === gr).length]));
  const byKind = Object.fromEntries(KINDS.map((k) => [k, ents.filter((e) => e.kind === k).length]));
  const scholarly = datings.filter((d) => !isTraditional(d.method));
  const ab = scholarly.filter((d) => d.grade === 'A' || d.grade === 'B').length;
  const cited = new Set<string>();
  for (const e of ents) for (const d of [...e.datings, ...e.claims]) for (const s of d.sources) cited.add(citationId(s));
  for (const a of g.articles) for (const c of a.inlineCitations) cited.add(c.id);
  const unused = [...g.sources.keys()].filter((id) => !cited.has(id));

  console.log('report:');
  console.log(`  entities: ${ents.length}`);
  console.log(`  articles: ${g.articles.length}`);
  console.log(`  sources: ${g.sources.size} (${unused.length} unused)`);
  console.log(`  corrections: ${g.corrections.length}`);
  console.log(`  datings: ${datings.length} (${scholarly.length} scholarly, ${datings.length - scholarly.length} traditional)`);
  console.log(`  scholarly datings graded A or B: ${scholarly.length ? Math.round((100 * ab) / scholarly.length) : 0}%`);
  console.log(`  by grade: ${Object.entries(byGrade).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  console.log(`  by kind: ${Object.entries(byKind).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  console.log(`  entities with image: ${ents.filter((e) => e.image).length}, with wikidata: ${ents.filter((e) => e.wikidata).length}`);
  console.log(`  entities with kids summary: ${ents.filter((e) => e.summaries?.kids).length}`);
  if (unused.length) console.log(`  unused sources: ${unused.join(', ')}`);
}

if (g.errors.length === 0) {
  console.log(`content:validate ok: ${g.entities.size} entities, ${g.sources.size} sources, ${g.articles.length} articles`);
} else {
  console.log(`content:validate: ${g.errors.length} problem(s)`);
  for (const e of g.errors) console.log(`  ${e.file}: ${e.message}`);
  process.exit(1);
}
