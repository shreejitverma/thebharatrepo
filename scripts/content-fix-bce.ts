/**
 * Mechanical fix for the BCE off-by-one authoring error flagged by the loader:
 * rewrites a range endpoint stored as -N, where the entity's own text says "N BCE",
 * to the explicit string "N BCE" (which the schema converts to 1 - N).
 * Usage: tsx scripts/content-fix-bce.ts <entities-root>...
 */
import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { bceOffByOne } from '../src/lib/content/load';
import { parseYear } from '../src/lib/content/schema';

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.yaml') ? [path.join(dir, e.name)] : []));
}

let files = 0;
let fixes = 0;
for (const root of process.argv.slice(2)) {
  for (const file of walk(root)) {
    const text = fs.readFileSync(file, 'utf8');
    let raw: { summary?: string; summaries?: { kids?: string; teen?: string }; claims?: { text: string }[]; datings?: { range: Record<string, unknown>; label?: string; note?: string }[] };
    try {
      raw = YAML.parse(text);
    } catch {
      continue;
    }
    if (!raw?.datings) continue;
    const body = [raw.summary, raw.summaries?.kids, raw.summaries?.teen, ...(raw.claims ?? []).map((c) => c.text)].join(' ');
    const flagged = new Set<number>();
    for (const d of raw.datings) {
      const r = { earliest: parseYear(d.range.earliest) as number, latest: parseYear(d.range.latest) as number, best: d.range.best === undefined ? undefined : (parseYear(d.range.best) as number) };
      if (typeof r.earliest !== 'number' || typeof r.latest !== 'number') continue;
      for (const n of bceOffByOne(r, `${body} ${d.label ?? ''} ${d.note ?? ''}`)) flagged.add(n);
    }
    if (!flagged.size) continue;
    let out = text;
    for (const n of flagged) {
      const re = new RegExp(`\\b(earliest|latest|best): -${n}(?![\\d.])`, 'g');
      out = out.replace(re, (_m, k) => {
        fixes++;
        return `${k}: "${n} BCE"`;
      });
    }
    if (out !== text) {
      fs.writeFileSync(file, out);
      files++;
    }
  }
}
console.log(`content-fix-bce: ${fixes} endpoints fixed in ${files} files`);
