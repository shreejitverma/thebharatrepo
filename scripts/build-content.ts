/**
 * Build-time artifacts derived from validated content:
 *   public/search.json        compact search index (entities and articles)
 */

import fs from 'node:fs';
import path from 'node:path';
import { loadContentUncached } from '../src/lib/content/load';
import { KIND_LABELS } from '../src/lib/content/labels';
import { entityHref } from '../src/lib/content/kaalchakra';
import { formatRange } from '../src/lib/time';

const g = loadContentUncached();
if (g.errors.length) {
  console.error(`build-content: ${g.errors.length} content problem(s); run npm run content:validate`);
  process.exit(1);
}

const pub = path.join(process.cwd(), 'public');
fs.mkdirSync(pub, { recursive: true });

const docs = [
  ...[...g.entities.values()].map((e) => ({
    href: entityHref(e.id),
    title: e.names.en,
    summary: e.summary,
    kind: KIND_LABELS[e.kind],
    when: formatRange(e.datings[0].range),
    text: [e.names.iast, e.names.native, e.region, ...e.tags].filter(Boolean).join(' '),
  })),
  ...g.articles.map((a) => ({
    href: `/${a.category}/${a.slug}`,
    title: a.title,
    summary: a.summary,
    kind: 'Article',
    when: formatRange(a.datings[0].range),
    text: [a.tags.join(' '), a.body.replace(/\[@[^\]]+\]/g, '').replace(/[#*_>`]/g, ' ').slice(0, 1500)].join(' '),
  })),
];
fs.writeFileSync(path.join(pub, 'search.json'), JSON.stringify(docs));

console.log(`build-content: search.json (${docs.length} docs)`);
