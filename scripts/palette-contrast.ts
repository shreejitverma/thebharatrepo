/**
 * Prints the WCAG contrast of every pair documented in docs/design/palette.md, in light and dark.
 * Exits 1 if any pair is below its minimum. The same check runs in src/lib/design/palette.test.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { contrast, documentedPairs, parseThemes, resolve } from '../src/lib/design/contrast';

const css = fs.readFileSync(path.join(process.cwd(), 'src/app/globals.css'), 'utf8');
const doc = fs.readFileSync(path.join(process.cwd(), 'docs/design/palette.md'), 'utf8');
const themes = parseThemes(css);
const pairs = documentedPairs(doc, themes.light);
let failed = 0;
console.log('fg\tbg\tmin\tlight\tdark');
for (const p of pairs) {
  const l = contrast(resolve(themes.light, p.fg), resolve(themes.light, p.bg));
  const d = contrast(resolve(themes.dark, p.fg), resolve(themes.dark, p.bg));
  const bad = l < p.min || d < p.min;
  if (bad) failed++;
  console.log(`${p.fg}\t${p.bg}\t${p.min}\t${l.toFixed(2)}\t${d.toFixed(2)}${bad ? '\tFAIL' : ''}`);
}
console.log(`${pairs.length} pairs, ${failed} below AA`);
process.exit(failed ? 1 : 0);
