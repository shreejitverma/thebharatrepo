/**
 * Build-time artifacts derived from validated content:
 *   public/search.json            compact search index (entities and articles)
 *   public/data/archive.json      open data export of the full entity graph and sources
 *   public/data/kaalchakra.json   the Kaalchakra index, fetched by the client instead of being inlined in the page
 */

import fs from 'node:fs';
import path from 'node:path';
import { loadContentUncached } from '../src/lib/content/load';
import { KIND_LABELS } from '../src/lib/content/labels';
import { buildKaalchakraIndex, entityHref } from '../src/lib/content/kaalchakra';
import { summarizeDatings } from '../src/lib/content/lens';

const g = loadContentUncached();
if (g.errors.length) {
  console.error(`build-content: ${g.errors.length} content problem(s); run npm run content:validate`);
  process.exit(1);
}

const pub = path.join(process.cwd(), 'public');
fs.mkdirSync(path.join(pub, 'data'), { recursive: true });

const docs = [
  ...[...g.entities.values()].map((e) => ({
    href: entityHref(e.id),
    title: e.names.en,
    summary: e.summary,
    kind: KIND_LABELS[e.kind],
    when: summarizeDatings(e.datings),
    text: [e.names.iast, e.names.native, e.region, ...e.tags].filter(Boolean).join(' '),
  })),
  ...g.articles.map((a) => ({
    href: `/${a.category}/${a.slug}`,
    title: a.title,
    summary: a.summary,
    kind: 'Article',
    when: summarizeDatings(a.datings),
    text: [a.tags.join(' '), a.body.replace(/\[@[^\]]+\]/g, '').replace(/[#*_>`]/g, ' ').slice(0, 1500)].join(' '),
  })),
];
fs.writeFileSync(path.join(pub, 'search.json'), JSON.stringify(docs));

const archive = {
  generatedAt: new Date().toISOString(),
  license: 'CC BY-SA 4.0',
  entities: [...g.entities.values()],
  sources: [...g.sources.values()],
};
fs.writeFileSync(path.join(pub, 'data', 'archive.json'), JSON.stringify(archive));

const kaalchakra = buildKaalchakraIndex(g);
fs.writeFileSync(path.join(pub, 'data', 'kaalchakra.json'), JSON.stringify(kaalchakra));

console.log(
  `build-content: search.json (${docs.length} docs), data/archive.json (${archive.entities.length} entities, ${archive.sources.length} sources), data/kaalchakra.json (${kaalchakra.length} items)`,
);
