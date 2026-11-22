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
npm run dev                     # local site at http://localhost:3000
npm test                        # unit tests (time engine, scale, schemas, loader, citations)
npm run typecheck
npm run lint
npm run content:new -- <type> <slug>
npm run content:new-source -- <slug>
npm run content:check -- <file...> [--write-cache]
npm run content:review-queue    # draft entities and articles awaiting human review
npm run content:validate        # schemas and cross-references; exit 1 on any problem
npm run content:report          # coverage: entities, grades, kinds, sources
npm run content:verify-sources  # resolve every DOI, ISBN, OCLC, QID and Commons file, and each URL that is a source's only identifier; exit 1 on any mismatch
npm run data:export             # generate JSON, CSV, JSON Schema and manifest
npm run data:verify-export      # check checksums, re-import through the validators, and compare byte for byte
npm run build                   # validate, offline verification gate, search index, open data export and its round trip, then next build
npm run test:e2e                # Playwright and axe against a production build (desktop and mobile)
```

`npm run build` refuses to build when content is invalid or when any identifier lacks a matching verified record in `content/verification.json` (`content-verify-sources.ts --offline`).
Every cached verification is re-checked against the current title or name, so a reused or edited identifier cannot ride on an old success.

## Adding content

Follow the [contributor guide](CONTRIBUTING.md) to scaffold, cite, check, and submit a record for editor review.

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

## Open data

`npm run data:export` writes the download bundle to `public/data/`, and the `/data` page (`src/app/data/page.tsx`) lists it with sizes and checksums.
`npm run build` regenerates it and then runs `npm run data:verify-export`, so no build ships a bundle that fails the round trip.
`npm run dev` regenerates it first as well.

- `archive.json` includes schema version 1, entities, sources, article frontmatter and inline citation metadata, and corrections.
- `entities.csv` covers core entity fields plus `primaryDate`, the entity's primary dating as the site writes it.
- `datings.csv` has one row per entity dating, with a 1-based ordinal, a `primary` flag set by the shared ranking rule (`primaryDating` in `src/lib/content/lens.ts`), and a JSON-encoded sources field.
- `schema.json` is generated from the archive's Zod schemas and describes the exported JSON structure.
- `manifest.json` records the version, counts, licence, content commit date and SHA-256 checksums for the other files.

Exported years use [astronomical year numbering](#time-model).
The verifier runs the Zod refinements and the loader's integrity checks and compares the re-imported bundle to the current archive.

The data files are a pure function of the validated content, so their bytes change only when content changes.
Only `manifest.json` depends on git: `contentCommitDate` is the UTC committer timestamp of the most recent first-parent commit that changed `content/` or `_content/`.
When the checkout cannot answer, because it has no `.git` or is a shallow clone (as on Vercel) whose history ends before that commit and its parent, the date is `null` and `contentCommitDateNote` says why; the build warns and continues rather than guess.

The bundle is generated and gitignored, along with the rest of `public/data/`, and must be kept out of pull requests.
Other build steps may write their own files there (for example `kaalchakra.json`); the export replaces only its own files and removes only the retired `index.html`.

## Licence

Code: MIT (see `LICENSE`).
Archive content and open data are licensed under [Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/).
When redistributing, attribute The Bharat Repo, link to the licence, and indicate changes.
Wikimedia images retain their individual licences and credits.
