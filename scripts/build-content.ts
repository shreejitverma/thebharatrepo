/**
 * Build-time artifacts derived from validated content:
 *   public/data/archive.json  open data export of the full entity graph and sources
 *
 * The full-text search index is built after next build from the rendered pages (scripts/build-search.ts).
 */

import fs from 'node:fs';
import path from 'node:path';
import { loadContentUncached } from '../src/lib/content/load';

const g = loadContentUncached();
if (g.errors.length) {
  console.error(`build-content: ${g.errors.length} content problem(s); run npm run content:validate`);
  process.exit(1);
}

const pub = path.join(process.cwd(), 'public');
fs.mkdirSync(path.join(pub, 'data'), { recursive: true });

const archive = {
  generatedAt: new Date().toISOString(),
  license: 'CC BY-SA 4.0',
  entities: [...g.entities.values()],
  sources: [...g.sources.values()],
};
fs.writeFileSync(path.join(pub, 'data', 'archive.json'), JSON.stringify(archive));

console.log(`build-content: data/archive.json (${archive.entities.length} entities, ${archive.sources.length} sources)`);
