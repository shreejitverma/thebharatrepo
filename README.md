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
- Kaalchakra views (Wheel, River, Map, List) are hand-written SVG with no charting or mapping dependency.
- The Map view draws an offline basemap derived from public-domain Natural Earth data (`src/data/basemap/`): no tiles, no API keys, no third-party requests.
- The wheel's motion is a hand-rolled `requestAnimationFrame` loop (`src/components/kaalchakra/spin.ts`) with no animation library: every selection spins to the fixed indicator at the top, the rotating layer is turned with a CSS transform so frames cost no repaint, and reduced motion jumps instead.
- Colour tokens are drawn from Hindu iconography and Indian pigments; every token, its source and its use is in [`docs/design/palette.md`](docs/design/palette.md), and a unit test holds every documented pair to WCAG 2.2 AA.

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
npm run dev                     # local site at http://localhost:3000 (predev writes the open data and Kaalchakra data)
npm test                        # unit tests (time engine, scale, schemas, loader, citations, relations, map projection, clustering, URL state, wheel motion, palette contrast)
npm run typecheck
npm run lint
npm run content:validate        # schemas and cross-references; exit 1 on any problem
npm run content:report          # coverage: entities, grades, kinds, sources
npm run content:verify-sources  # resolve every DOI, ISBN, OCLC, QID and Commons file, and each URL that is a source's only identifier; exit 1 on any mismatch
npm run build                   # validate, offline verification gate and open data, then next build and the Pagefind index
npm run search:build            # rebuild only the Pagefind index from an existing .next build
npm run test:e2e                # Playwright, axe and visual snapshots against a production build (Chromium, Firefox, WebKit, Pixel 7, iPhone 14)
npx vitest run src/lib/design/palette.test.ts  # contrast of every documented colour pair in light and dark; fails below AA
npm run test:lighthouse         # Lighthouse CI budgets against a production build (lighthouserc.js)
npm run dev:debates-preview     # local preview that renders unpublished debate drafts, for owner review
```

Both browser suites expect `npm run build` first; set `E2E_PORT` or `LHCI_PORT` to avoid a port another server holds.
After editing content during `npm run dev`, run `npm run content:build` to refresh the open data and the Kaalchakra data in `public/data/`.
The Map view has visual snapshots (`e2e/map-visual.spec.ts`) drawn from a fixed fixture (`e2e/fixtures/kaalchakra-map.json`), so they change only when rendering changes.
Snapshots are per platform; refresh them with `npx playwright test e2e/map-visual.spec.ts --update-snapshots=all` on macOS, and in the Playwright Linux image for CI.

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
| e2e | The production build, then Playwright on desktop Chromium, Firefox and WebKit and on Pixel 7 and iPhone 14 profiles: every route type in light and dark with zero serious or critical axe violations and no horizontal scroll, navigation, Kaalchakra zoom, lenses, kind filters, URL state round trips, the wheel's spin (click, era tap, drag, touch swipe, keyboard, scroll with intent, Back and Forward, one announcement at rest, reduced motion), the List fallback (including reduced motion making List the default) and visual snapshots of the Wheel and River (Chromium projects) |
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
npx playwright test e2e/visual.spec.ts --update-snapshots=all      # macOS
# Linux, as CI; node_modules and .next stay inside the container so the host install is untouched
docker run --rm -v "$PWD":/work -v /work/node_modules -v /work/.next -w /work -e CI=1 mcr.microsoft.com/playwright:v1.65.1-noble \
  sh -c 'npm ci && npm run build && npx playwright test e2e/visual.spec.ts --update-snapshots=all'
```
## Search

Search is [Pagefind](https://pagefind.app), built inside `npm run build` (`next build && tsx scripts/build-search.ts`), so the index can never be skipped by a package manager that ignores lifecycle scripts.
`scripts/build-search.ts` reads the prerendered HTML in `.next/server/app`, indexes every entity, article and source page under its real route, and writes `public/pagefind/`.
The build fails if any expected page is missing or unindexed.
On Vercel this is served because the Next.js builder collects `public/` only after the build command exits, and `vercel.json` pins that build command to `npm run build` so a dashboard override cannot drop the index; `vercel build` locally puts all of `public/pagefind/` in `.vercel/output/static/pagefind/`.
Content-hashed chunks (`/pagefind/{index,filter,fragment}/`) are served as immutable (`next.config.ts`); `pagefind.js` and `pagefind-entry.json` keep the default revalidation.
Pages declare what is indexed with `data-pagefind-body` and `data-pagefind-ignore`, and their filters (kind, article category, evidence grade, lens) through `src/components/SearchIndexMeta.tsx`.
`/search` keeps its `?q=` contract and adds repeatable `kind`, `category`, `grade` and `lens` parameters (`src/lib/search/facets.ts`).
Ranking lowers Pagefind's page-length penalty to 0.25 and puts an exact title match first (`src/lib/search/pagefind.ts`), so a name query finds its record before the shorter bibliography entries that mention it.
`npm run dev` serves the index from the last production build; run `npm run build` once before testing search locally.

## References

Each article's references are generated from its inline citations and its dating sources (`src/lib/content/references.ts`): one numbered entry per source in order of first use, locators deduplicated, with back-links to every use.
The evidence summary at the top of an article counts the graded datings and claims of the archive records it links in `entities`.
Every source has a record at `/sources/<slug>` listing each entity, article and correction that cites it.
Identifiers are linked only when verified: DOI, ISBN and OCLC always, a URL only when it is the source's sole identifier.

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

## Kaalchakra URL state

All four views share one URL, so any moment is a link.
Defaults are omitted; parsing and serialising live in `src/components/kaalchakra/urlState.ts`.

| Parameter | Meaning |
|---|---|
| `view` | `wheel` (default), `river`, `map` or `list` |
| `lens` | `both` (default), `scholarship` or `tradition` |
| `kinds` | Comma-separated kinds; absent means all |
| `q`, `id`, `cal`, `level` | Text filter, selected entity, calendar, reading level |
| `win` | River window on the unit axis, `start,end` |
| `t` | Map moment as an astronomical year (269 BCE is `-268`); absent means all time |
| `zoom` | Map time window around `t`: `era`, `millennium`, `century` (default) or `decade` |
| `region` | Map viewport: `subcontinent` (default), `wide`, `northwest`, `ganga`, `west`, `deccan`, `south`, `east`, or `lon,lat,span` after panning or zooming |

Example: `/kaalchakra?view=map&t=-268&zoom=century&lens=scholarship&kinds=site,event&region=ganga`.

## Map view

- Shows every entity that has a `location`, clustered when markers would overlap, with an accessible list of the same entries below the map.
- Every marker, numbered cluster and extent is a button: Tab reaches them in time order, Enter or Space opens one, and a cluster hands focus to its members as it splits.
- On a touch screen one finger always scrolls the page, so the map never traps a reader scrolling past it; two fingers move and pinch the map, and a one-finger drag shows a hint saying so.
- The map code and its basemap load only when the Map view opens (`next/dynamic`); the items load from `public/data/kaalchakra.json`, not from the page.
- A moment shows entries whose dating overlaps the window; it does not claim that everything else had ceased to exist.
- The basemap is physical geography only (land, lakes, rivers) and draws no modern political boundary.
- A polity extent is drawn only where an entity carries sourced `extents` data (see `docs/editorial/STYLE.md`); none is inferred.
- Projection, viewport and clustering are pure functions in `src/lib/geo/`; scrubber and region state are in `src/components/kaalchakra/mapState.ts`.
- `src/data/basemap/README.md` records the source, licence and rebuild steps of the basemap.

## Relations

`npm run content:validate` fails on a relation whose target does not exist, and reports, without failing, pairs that contradict each other (two records each claiming to succeed the other), self relations and duplicates, with counts of how many inverse and symmetric relations are declared on one record or on both.
Every entity page draws its relations as a tree, merging both declarations of one fact into one edge and marking where each edge was stated (`src/lib/content/relations.ts`).

## Open data

Each build writes `public/data/archive.json` with every entity and source.
`public/data/kaalchakra.json` is the compact index the Kaalchakra fetches; it is kept out of the page HTML so the page stays small as the archive grows.

## Licence

Code: MIT (see `LICENSE`).
Content: CC BY-SA 4.0.
