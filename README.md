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
| `content/verification.json` | Committed cache of registry checks (DOI, ISBN, OCLC, URL, Wikidata, Commons) |
| `content/corrections.yaml` | Public corrections log |
| `content/debates/<slug>.yaml` | One debate page; id `debate.<slug>`; built only when `published: true` (owner approval required) |
| `content/learning/<slug>.yaml` | One learning path with its quiz; id `learn.<slug>` |
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
npm run build                   # validate, offline verification gate, search index and open data, then next build
npm run test:e2e                # Playwright and axe against a production build (desktop and mobile), plus a DEBATES_PREVIEW dev server for draft debates
npm run dev:debates-preview     # local preview that renders unpublished debate drafts, for owner review
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
The loader rejects raw negative years in datings; write BCE years as `"N BCE"` strings.
`npx tsx scripts/content-fix-bce.ts <entities-root>` mechanically rewrites a raw `-N` endpoint to `"N BCE"` where the entity's own text says "N BCE".

## Debates, learning paths and reading levels

- Debate pages (`/debates`) are validated whether or not they are published, but a debate is rendered, linked from entity pages, indexed for search or listed only when `published: true`, which the schema accepts only with an `approval { by, date }` record.
  `npm run dev:debates-preview` (or `DEBATES_PREVIEW=1` at build time) renders drafts with an "Unpublished draft" banner and `noindex`; never deploy such a build.
  `next.config.ts` also keeps every debate file not marked `published: true` out of the traced server bundles, and until a debate is published the `/debates` index is `noindex` and absent from the footer.
- Learning paths (`/learn`) have ordered steps, a quiz scored in the browser, per-viewer progress in `localStorage`, and a printable pack at `/learn/<slug>/print` with the answer key on its own page.
  Choices show in the order written; `content:validate` rejects a quiz of three or more questions whose correct answers all share one position.
- The reading level (Full, Teen, Kids) is chosen with the switcher on entity pages and in the Kaalchakra panel; it is read from `?level=` first, then `localStorage`, and applied before paint by an inline script in the root layout (`src/lib/reading-level.ts`).
- Native-script names carry `lang` tags derived from their script (`src/lib/content/script.ts`); `content:validate` prints a warning with the count of entities missing `names.iast` or `names.native`.

The content formats are specified in `docs/editorial/STYLE.md`, sections 11 to 13.

## Time model

All years are astronomical year numbers (1 BCE = 0).
Calendar conversion (CE/BCE, years ago, Vikram Samvat, Shaka Samvat, Kali Yuga era) lives only in `src/lib/time/index.ts`.
The Kaalchakra axis is piecewise: logarithmic for deep time, linear for history, with visible scale breaks (`src/lib/time/scale.ts`).

## Open data

Each build writes `public/data/archive.json` with every entity and source.

## Licence

Code: MIT (see `LICENSE`).
Content: CC BY-SA 4.0.
