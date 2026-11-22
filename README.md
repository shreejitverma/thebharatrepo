# The Bharat Repo

The evidence-based archive of the history, knowledge and living traditions of Bharat and Sanatana Dharma, live at https://www.thebharatrepo.com.

Every entry is placed in time on the **Kaalchakra**, every claim carries an evidence grade, and every external identifier is machine-verified before it is published.

## Principles

- No claim without a source, and every source verified against its registry.
- Every entity and article has a structured place in time; the build fails without one.
- Datings are plural: scholarship and tradition are shown side by side in separate lenses, never collapsed.
- Evidence grades A to E (attested, consensus, debated, traditional, speculative) are explained at `/methodology`.

The full editorial contract is in [`docs/editorial/STYLE.md`](docs/editorial/STYLE.md).
The product brief is in [`docs/prompts/kaalchakra-master-prompt.md`](docs/prompts/kaalchakra-master-prompt.md).

## Stack

- Next.js 16 App Router, React 19, static generation for every page.
- Content as YAML and Markdown in git, validated by Zod schemas at build time.
- Kaalchakra views (Wheel, River, List) are hand-written SVG with no charting dependency.

## Content layout

| Path | What |
|---|---|
| `content/entities/<type>/<slug>.yaml` | One entity (event, person, text, site, polity, artifact, tradition, concept, cosmology); id `<type>.<slug>` |
| `content/sources/<slug>.yaml` | One source; id `src.<slug>` |
| `content/verification.json` | Committed cache of registry checks (DOI, ISBN, Wikidata, Commons) |
| `content/corrections.yaml` | Public corrections log |
| `_content/<category>/<slug>.md` | Articles, with inline citations `[@src.id, locator]` |

## Commands

```sh
npm ci
npm run dev                     # local site at http://localhost:3000
npm test                        # unit tests (time engine, scale, schemas, loader, citations)
npm run typecheck
npm run lint
npm run content:validate        # schemas and cross-references; exit 1 on any problem
npm run content:report          # coverage: entities, grades, kinds, sources
npm run content:verify-sources  # resolve every DOI, ISBN, OCLC, QID and Commons file, and each URL that is a source's only identifier; exit 1 on any mismatch
npm run build                   # validate, offline verification gate and open data, then next build, then the Pagefind index
npm run search:build            # rebuild only the Pagefind index from an existing .next build
npm run test:e2e                # Playwright and axe against a production build (desktop and mobile)
```

`npm run build` refuses to build when content is invalid or when any identifier lacks a matching verified record in `content/verification.json` (`content-verify-sources.ts --offline`).
Every cached verification is re-checked against the current title or name, so a reused or edited identifier cannot ride on an old success.

## Adding content

1. Read `docs/editorial/STYLE.md`.
2. Add sources and entities as YAML, or edit an article.
3. Run `npm run content:validate` and `npm run content:verify-sources` until both pass.
4. Open a pull request; a subject editor reviews before `review.status` moves past `draft`.

Large batches are written to `staging/<batch>/` (gitignored), validated in isolation with
`CONTENT_ROOTS=content:staging/<batch> ARTICLES_ROOT= npm run content:validate -- --scope staging/<batch>`,
and merged with `npm run content:merge -- staging/<batch>`, which re-validates the combined content, aborts on any conflict before writing, and never copies the staging verification cache.
Run `npm run content:verify-sources` after every merge.
`npx tsx scripts/content-fix-bce.ts content/entities` mechanically repairs ranges that store `-N` for "N BCE".

## Search

Search is [Pagefind](https://pagefind.app), built after `next build` by `scripts/build-search.ts` (the `postbuild` step).
It reads the prerendered HTML in `.next/server/app`, indexes every entity, article and source page under its real route, and writes `public/pagefind/`, which Vercel collects with `public/` after the build and `next start` serves.
The build fails if any expected page is missing or unindexed.
Pages declare what is indexed with `data-pagefind-body` and `data-pagefind-ignore`, and their filters (kind, article category, evidence grade, lens) through `src/components/SearchIndexMeta.tsx`.
`/search` keeps its `?q=` contract and adds repeatable `kind`, `category`, `grade` and `lens` parameters (`src/lib/search/facets.ts`).
`npm run dev` serves the index from the last production build; run `npm run build` once before testing search locally.

## References

Each article's references are generated from its inline citations and its dating sources (`src/lib/content/references.ts`): one numbered entry per source in order of first use, locators deduplicated, with back-links to every use.
The evidence summary at the top of an article counts the graded datings and claims of the archive records it links in `entities`.
Every source has a record at `/sources/<slug>` listing each entity, article and correction that cites it.
Identifiers are linked only when verified: DOI, ISBN and OCLC always, a URL only when it is the source's sole identifier.

## Time model

All years are astronomical year numbers (1 BCE = 0).
Calendar conversion (CE/BCE, years ago, Vikram Samvat, Shaka Samvat, Kali Yuga era) lives only in `src/lib/time/index.ts`.
The Kaalchakra axis is piecewise: logarithmic for deep time, linear for history, with visible scale breaks (`src/lib/time/scale.ts`).

## Open data

Each build writes `public/data/archive.json` with every entity and source.

## Licence

Code: MIT (see `LICENSE`).
Content: CC BY-SA 4.0.
