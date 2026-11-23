/**
 * Markdown (GitHub Flavored, for tables) rendering for articles, with numbered inline citations.
 * [@src.id, locator] groups become superscript links (id cite-<k>) to a generated references list
 * (id ref-<n>); see references.ts for numbering and deduplication.
 */

import { remark } from 'remark';
import html from 'remark-html';
import remarkGfm from 'remark-gfm';
import type { Source } from './schema';
import { CITATION_GROUP, extractCitations, parseCitationGroup } from './load';
import { formatSource } from './kaalchakra';
import { buildReferences, type CitationUse, type Reference } from './references';

export interface RenderedReference extends Reference {
  source: Source;
}

export interface RenderedArticle {
  html: string;
  references: RenderedReference[];
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Renders an article body. `datingCitations` (the frontmatter datings' sources) are appended to the
 * references after the in-text ones. Throws on a citation of an unknown source: the loader rejects
 * those, so reaching one here means the build is rendering unvalidated content.
 */
export async function renderArticle(markdown: string, sources: Map<string, Source>, datingCitations: CitationUse[] = []): Promise<RenderedArticle> {
  const refs = buildReferences(extractCitations(markdown), datingCitations);
  const unknown = refs.filter((r) => !sources.has(r.id)).map((r) => r.id);
  if (unknown.length) throw new Error(`renderArticle: unknown or malformed source citations: ${unknown.join(', ')}`);
  const number = new Map(refs.map((r) => [r.id, r.n]));

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
      const n = number.get(c.id)!;
      const s = sources.get(c.id)!;
      const title = `${formatSource(s)}${c.locator ? `, ${c.locator}` : ''}`;
      useCount++;
      return `<a href="#ref-${n}" id="cite-${useCount}" title="${escapeAttr(title)}" aria-label="Reference ${n}">${n}</a>`;
    });
    return `<sup class="cite">[${sups.join(', ')}]</sup>`;
  });
  return { html: out, references: refs.map((r) => ({ ...r, source: sources.get(r.id)! })) };
}
