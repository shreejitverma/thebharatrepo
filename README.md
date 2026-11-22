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
| `_content/<category>/<slug>.md` | Articles, with inline citations `[@src.id, locator]` |

## Commands

```sh
npm ci
npm run dev                     # local site at http://localhost:3000 (predev writes the search and Kaalchakra data)
npm test                        # unit tests (time engine, scale, schemas, loader, citations)
npm run typecheck
npm run lint
npm run content:validate        # schemas and cross-references; exit 1 on any problem
npm run content:report          # coverage: entities, grades, kinds, sources
npm run content:verify-sources  # resolve every DOI, ISBN, OCLC, QID and Commons file, and each URL that is a source's only identifier; exit 1 on any mismatch
npm run build                   # validate, offline verification gate, search index and open data, then next build
npm run test:e2e                # Playwright, axe and visual snapshots against a production build (desktop and mobile)
npm run test:lighthouse         # Lighthouse CI budgets against a production build (lighthouserc.js)
```

Both browser suites expect `npm run build` first; set `E2E_PORT` or `LHCI_PORT` to avoid a port another server holds.
After editing content during `npm run dev`, run `npm run content:build` to refresh the search index and the Kaalchakra data in `public/`.

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

## Quality gates

`.github/workflows/ci.yml` runs on every pull request and on `main`, as three parallel jobs on GitHub-hosted Ubuntu runners:

| Job | What fails it |
|---|---|
| verify | ESLint, `tsc --noEmit`, Vitest, `content:validate`, the offline source verification gate |
| e2e | The production build, then Playwright on a desktop and a Pixel 7 profile: every route type in light and dark with zero serious or critical axe violations and no horizontal scroll, navigation, Kaalchakra zoom, lenses, kind filters, URL state round trips, the List fallback (including reduced motion making List the default) and visual snapshots of the Wheel and River |
| lighthouse | The production build, then Lighthouse CI on a throttled mid-tier Android profile, with the budgets below as hard gates |

Performance budgets (`lighthouserc.js`, median of three runs, Moto G Power class phone, simulated slow 4G, 4x CPU):

| Metric | Budget |
|---|---|
| Largest Contentful Paint | 2.0 s |
| Total Blocking Time (lab stand-in for INP) | 200 ms |
| Cumulative Layout Shift | 0.1 |
| JavaScript, compressed | 250 KB on `/kaalchakra`, 150 KB elsewhere |
| Total transfer | 1.2 MB |
| Lighthouse performance / accessibility score | 0.9 / 0.95 |

Two deliberate departures from the product brief, both measured:
the brief's 100 KB JavaScript budget for article pages is below the roughly 128 KB that React 19 and the Next.js 16 App Router runtime ship on every page, so the gate is 150 KB;
and a hard load of search results (`/search?q=...`) renders after hydration and the index download, so it is held to a 4.5 s LCP ratchet until search results are rendered on the server.

The visual snapshots in `e2e/visual.spec.ts-snapshots/` use a fixed fixture (`e2e/fixtures/kaalchakra.json`), so they change only when rendering changes.
They are per platform; after an intended visual change, refresh both:

```sh
npx playwright test e2e/visual.spec.ts --update-snapshots      # macOS
# Linux, as CI; node_modules and .next stay inside the container so the host install is untouched
docker run --rm -v "$PWD":/work -v /work/node_modules -v /work/.next -w /work -e CI=1 mcr.microsoft.com/playwright:v1.65.1-noble \
  sh -c 'npm ci && npm run build && npx playwright test e2e/visual.spec.ts --update-snapshots'
```

## Time model

All years are astronomical year numbers (1 BCE = 0).
Calendar conversion (CE/BCE, years ago, Vikram Samvat, Shaka Samvat, Kali Yuga era) lives only in `src/lib/time/index.ts`.
The Kaalchakra axis is piecewise: logarithmic for deep time, linear for history, with visible scale breaks (`src/lib/time/scale.ts`).

## Open data

Each build writes `public/data/archive.json` with every entity and source.
`public/data/kaalchakra.json` is the compact index the Kaalchakra fetches; it is kept out of the page HTML so the page stays small as the archive grows.

## Licence

Code: MIT (see `LICENSE`).
Content: CC BY-SA 4.0.
