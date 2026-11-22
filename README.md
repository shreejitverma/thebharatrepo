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
npm run dev                     # local site at http://localhost:3000
npm test                        # unit tests (time engine, scale, schemas, loader, citations, relations, map projection, clustering, URL state)
npm run typecheck
npm run lint
npm run content:validate        # schemas and cross-references; exit 1 on any problem
npm run content:report          # coverage: entities, grades, kinds, sources
npm run content:verify-sources  # resolve every DOI, ISBN, OCLC, QID and Commons file, and each URL that is a source's only identifier; exit 1 on any mismatch
npm run build                   # validate, offline verification gate, search index and open data, then next build
npm run test:e2e                # Playwright and axe against a production build (desktop and mobile)
```

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

Each build writes `public/data/archive.json` with every entity and source, and `public/data/kaalchakra.json`, the compact index the Kaalchakra fetches.

## Licence

Code: MIT (see `LICENSE`).
Content: CC BY-SA 4.0.
