/**
 * Markdown (GitHub Flavored, for tables) rendering for articles, with numbered inline citations.
 * [@src.id, locator] groups become superscript links to a generated references list.
 */

import { remark } from 'remark';
import html from 'remark-html';
import remarkGfm from 'remark-gfm';
import type { Source } from './schema';
import { CITATION_GROUP, parseCitationGroup } from './load';
import { formatSource } from './kaalchakra';

export interface RenderedArticle {
  html: string;
  references: { n: number; source: Source; locators: string[] }[];
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function renderArticle(markdown: string, sources: Map<string, Source>): Promise<RenderedArticle> {
  const order = new Map<string, number>();
  const locators = new Map<string, Set<string>>();
  for (const m of markdown.matchAll(CITATION_GROUP)) {
    for (const c of parseCitationGroup(m[1])) {
      if (!order.has(c.id)) order.set(c.id, order.size + 1);
      if (c.locator) (locators.get(c.id) ?? locators.set(c.id, new Set()).get(c.id)!).add(c.locator);
    }
  }
  // Protect citation groups from Markdown processing with placeholders, then substitute after.
  const groups: string[] = [];
  const protectedMd = markdown.replace(CITATION_GROUP, (_all, inner: string) => {
    groups.push(inner);
    return `CITEGROUP${groups.length - 1}X`;
  });
  const file = await remark().use(remarkGfm).use(html, { sanitize: true }).process(protectedMd);
  let out = String(file)
    .replace(/<table>/g, '<div class="table-scroll" tabindex="0" role="region" aria-label="Scrollable table"><table>')
    .replace(/<\/table>/g, '</table></div>');
  let useCount = 0;
  out = out.replace(/CITEGROUP(\d+)X/g, (_all, idx: string) => {
    const cites = parseCitationGroup(groups[Number(idx)]);
    const sups = cites.map((c) => {
      const n = order.get(c.id)!;
      const s = sources.get(c.id);
      const title = s ? `${formatSource(s)}${c.locator ? `, ${c.locator}` : ''}` : c.id;
      useCount++;
      return `<a href="#ref-${n}" id="cite-${useCount}" title="${escapeAttr(title)}" aria-label="Reference ${n}">${n}</a>`;
    });
    return `<sup class="cite">[${sups.join(', ')}]</sup>`;
  });
  const references = [...order.entries()]
    .sort((a, b) => a[1] - b[1])
    .filter(([id]) => sources.has(id))
    .map(([id, n]) => ({ n, source: sources.get(id)!, locators: [...(locators.get(id) ?? [])] }));
  return { html: out, references };
}
