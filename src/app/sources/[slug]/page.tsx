import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import GradeBadge from '@/components/GradeBadge';
import SearchIndexMeta from '@/components/SearchIndexMeta';
import SourceCitation from '@/components/SourceCitation';
import { CATEGORY_META, getCitationIndex, getGraph } from '@/lib/content/site';
import { entityHref, formatSource } from '@/lib/content/kaalchakra';
import { KIND_LABELS, METHOD_LABELS } from '@/lib/content/labels';
import { citedByCount, type EntityContext } from '@/lib/content/references';
import { sourceIdentifiers } from '@/lib/content/verification';
import { formatRange } from '@/lib/time';

export const dynamicParams = false;

export function generateStaticParams() {
  return [...getGraph().sources.keys()].map((id) => ({ slug: id.replace(/^src\./, '') }));
}

function find(slug: string) {
  return getGraph().sources.get(`src.${slug}`);
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const s = find(slug);
  return s ? { title: s.title, description: `${formatSource(s)}. Every entity, article and correction in The Bharat Repo that cites this source.` } : {};
}

function typeLabel(type: string): string {
  const t = type.replace(/-/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function Context({ ctx }: { ctx: EntityContext }) {
  if (ctx.kind === 'dating') {
    const d = ctx.dating;
    return (
      <>
        <span className="cited-by__what">Dating</span> {formatRange(d.range)}, {METHOD_LABELS[d.method]}
        {d.label ? ` (${d.label})` : ''} <GradeBadge grade={d.grade} showLabel={false} />
        {ctx.locator ? <span className="muted">, cited at {ctx.locator}</span> : null}
      </>
    );
  }
  return (
    <>
      <span className="cited-by__what">Claim</span> {ctx.claim.text} <GradeBadge grade={ctx.claim.grade} showLabel={false} />
      {ctx.locator ? <span className="muted">, cited at {ctx.locator}</span> : null}
    </>
  );
}

export default async function SourcePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = find(slug);
  if (!s) notFound();
  const cited = getCitationIndex().get(s.id) ?? { entities: [], articles: [], corrections: [] };
  const total = citedByCount(cited);
  const ids = sourceIdentifiers(s);
  const people: [string, string[]][] = [
    ['Authors', s.authors],
    ['Editors', s.editors],
  ];
  const facts: [string, string | number | undefined][] = [
    ['Year', s.year],
    ['Publisher', s.publisher],
    ['Journal', s.journal],
    ['Volume', s.volume],
    ['Pages', s.pages],
    ['Corpus', s.corpus],
  ];

  return (
    <div className="main-content" data-pagefind-body>
      <SearchIndexMeta title={s.title} kind="source" when={s.year ? String(s.year) : undefined} filters={{ kind: ['source'] }} />
      <nav className="breadcrumbs" aria-label="Breadcrumb" data-pagefind-ignore>
        <Link href="/sources">Bibliography</Link>
      </nav>
      <div className="prose-wrap">
        <p className="eyebrow">{typeLabel(s.type)}</p>
        <h1>{s.title}</h1>
        <p className="source-citation" data-pagefind-ignore>
          <SourceCitation source={s} identifier={false} />
        </p>
        <dl className="source-facts">
          {people
            .filter(([, v]) => v.length)
            .map(([k, v]) => (
              <div key={k}>
                <dt data-pagefind-ignore>{k}</dt>
                <dd>{v.join('; ')} </dd>
              </div>
            ))}
          {facts
            .filter(([, v]) => v !== undefined && v !== '')
            .map(([k, v]) => (
              <div key={k}>
                <dt data-pagefind-ignore>{k}</dt>
                <dd>{v} </dd>
              </div>
            ))}
          <div data-pagefind-ignore>
            <dt>{ids.length === 1 ? 'Identifier' : 'Identifiers'}</dt>
            <dd>
              <ul className="source-ids">
                {ids.map((i) => (
                  <li key={i.kind}>
                    <span className="source-ids__kind">{i.kind}</span>{' '}
                    {i.href ? (
                      <a href={i.href} rel="noopener noreferrer" target="_blank">
                        {i.value}
                      </a>
                    ) : (
                      <>
                        <span className="source-ids__value">{i.value}</span> <span className="muted">(not linked: only the {ids[0].kind} is the verified identifier)</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
          {s.note ? (
            <div>
              <dt data-pagefind-ignore>Note</dt>
              <dd>{s.note} </dd>
            </div>
          ) : null}
        </dl>
      </div>

      <section className="cited-by" aria-labelledby="cited-by" data-pagefind-ignore>
        <h2 id="cited-by">Cited in the archive</h2>
        {total === 0 ? (
          <p className="empty">0 records cite this source.</p>
        ) : (
          <p className="muted cited-by__summary">
            Cited by {plural(cited.articles.length, 'article', 'articles')}, {plural(cited.entities.length, 'archive record', 'archive records')} and{' '}
            {plural(cited.corrections.length, 'correction', 'corrections')}.
          </p>
        )}

        {cited.articles.length ? (
          <>
            <h3 id="cited-by-articles">Articles ({cited.articles.length})</h3>
            <ul className="cited-by__list">
              {cited.articles.map(({ article: a, inText, dating, locators }) => (
                <li key={`${a.category}/${a.slug}`}>
                  <Link href={`/${a.category}/${a.slug}`}>{a.title}</Link> <span className="muted">{CATEGORY_META[a.category].title}</span>
                  <div className="cited-by__detail">
                    {inText ? `Cited ${inText === 1 ? 'once' : `${inText} times`} in the text` : null}
                    {inText && dating ? ' and for its dating' : dating ? 'Cited for its dating' : null}
                    {locators.length ? `, at ${locators.join('; ')}` : null}.
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {cited.entities.length ? (
          <>
            <h3 id="cited-by-entities">Archive records ({cited.entities.length})</h3>
            <ul className="cited-by__list">
              {cited.entities.map(({ entity: e, contexts }) => (
                <li key={e.id}>
                  <Link href={entityHref(e.id)}>{e.names.en}</Link> <span className="muted">{KIND_LABELS[e.kind]}</span>
                  <ul className="cited-by__contexts">
                    {contexts.map((ctx) => (
                      <li key={`${ctx.kind}-${ctx.index}`}>
                        <Context ctx={ctx} />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {cited.corrections.length ? (
          <>
            <h3 id="cited-by-corrections">Corrections ({cited.corrections.length})</h3>
            <ul className="cited-by__list">
              {cited.corrections.map(({ correction: c, anchor, locator }) => (
                <li key={anchor}>
                  <Link href={`/corrections#${anchor}`}>
                    {c.date}, {c.target}
                  </Link>
                  <div className="cited-by__detail">
                    {c.after}
                    {locator ? <span className="muted"> Cited at {locator}.</span> : null}
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
    </div>
  );
}
