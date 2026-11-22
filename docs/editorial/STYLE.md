# Editorial Standard and Content Format

This is the contract every piece of content in The Bharat Repo must meet, whether written by a person or a model.
The build enforces the mechanical parts; reviewers enforce the rest.

## 1. The one rule

Never overstate.
Every claim carries its evidence and its evidence grade.
Where credible positions disagree, show all of them, each with its best evidence and named proponents.
Tradition is presented faithfully as tradition, and scholarship faithfully as scholarship.

## 2. Evidence grades

| Grade | Meaning | Typical basis |
|---|---|---|
| A | Directly attested | Dated inscription, coin legend, contemporary foreign record, calibrated radiocarbon series from a stratified excavation, contemporary documents for modern events |
| B | Strong scholarly consensus | Multiple independent lines converge; mainstream peer-reviewed position |
| C | Reasoned estimate, debated | Textual-internal, linguistic or stylistic dating with live scholarly disagreement |
| D | Traditional reckoning | Puranic, Siddhantic, Itihasa or sampradaya chronology |
| E | Speculative or fringe | Single-author reconstructions (for example astronomical datings of epic events) without wide acceptance |

Mechanical rules (the validator rejects violations):

- Methods `traditional-puranic`, `traditional-siddhantic` and `traditional-sampradaya` are always grade D, and grade D is only for those methods.
- `cosmological` precision is only for traditional methods.
- Entities of type `cosmology` carry only traditional datings.
- Every dating and every claim cites at least one source.

## 3. Years

**Write years as strings** and let the build convert them: `"7000 BCE"`, `"320 CE"`, `"1947"`, `"385 ka"`, `"1.5 Ma"`, `"1.97 Ga"`.
Every BCE year must be written as an `"N BCE"` string (or as `ka`, `Ma`, `Ga` for deep time), because BCE arithmetic is the most common authoring error.
The loader rejects any raw negative year in an entity or article dating (`earliest`, `latest` or `best`); raw non-negative numbers such as `1947` are still accepted.
Dates a source reports in years before present must be written `"385 ka"` or `"1.5 Ma"`, not `"385000 BCE"`, which would land about 2,025 years too early; the loader rejects a non-traditional `"N BCE"` endpoint with N above 10000.
CE years need no shift: a range that ends in the fifth century CE ends at `"500 CE"`, not `"499 CE"`.
The loader rejects a non-traditional `latest` of the form N99 CE when the entity's or article's own text names (N+1)00 CE or the century ending then, and never names the N99 year itself.

Internally all years are **astronomical year numbers**: 1 CE = `1`, 1 BCE = `0`, 2 BCE = `-1`, N BCE = `1 - N`.
The table shows that internal form for reference only; never write the right-hand column in content.

| Historical | Astronomical |
|---|---|
| 3102 BCE | -3101 |
| 2600 BCE | -2599 |
| 1500 BCE | -1499 |
| 563 BCE | -562 |
| 322 BCE | -321 |
| 1 BCE | 0 |
| 1 CE | 1 |
| 1947 CE | 1947 |
| 385,000 years ago | -382974 (2026 - 385000) |
| 1.5 million years ago | -1497974 |

A dating is a range: `{ earliest, latest, best?, precision, circa }`.
A single year is `earliest == latest`.
`precision` is one of `day`, `year`, `decade`, `century`, `millennium`, `ka`, `Ma`, `cosmological`.
Set `circa: true` for any estimate.
Use the widest range the evidence supports, not the narrowest one you have seen quoted.

## 4. Dating methods

`archaeological-radiocarbon`, `archaeological-stratigraphic`, `luminescence`, `epigraphic`, `numismatic`, `foreign-synchronism`, `textual-internal`, `linguistic`, `astronomical-reference`, `art-historical`, `genetic`, `geological`, `documentary`, `scholarly-consensus`, `traditional-puranic`, `traditional-siddhantic`, `traditional-sampradaya`.

A dating places the entity itself.
Never date a figure or event by the composition date of a text about it.
For a figure or event known only from tradition (Rama, Krishna, Manu, the churning of the ocean), scholarship dates the texts and inscriptions that tell of it, not the figure, so it carries only traditional datings and records those dates as graded claims; the texts carry their own datings.
The validator rejects a non-traditional dating on a non-text entity whose label or note calls it the date of the text.
Give an entity several datings when methods disagree.
For example, a text can have a `linguistic` dating graded C and a `traditional-puranic` dating graded D.
Use the `label` field to name the position, for example `label: "Mainstream Indology"` or `label: "Kanchi and Dwaraka matha tradition"`, and the `note` field to explain the basis in one or two sentences.

## 5. Sources

### 5.1 Hierarchy

1. Primary: the text (critical edition, with verse or section), the inscription (with corpus reference), the excavation report, the coin catalogue, the genome paper.
2. Peer-reviewed scholarship: journal articles with DOI, academic books with ISBN.
3. Reference works: encyclopaedias and handbooks from academic publishers.
4. Government and institutional records: ASI, ISRO, UNESCO, Government of India gazettes, for modern events.

Wikipedia, blogs, news aggregators, social media and devotional websites are never sources.
UNESCO, ASI, ISRO and similar official pages are acceptable as `web` or `government-record` sources for modern events and site inscriptions.

### 5.2 Verification

Every DOI is resolved against Crossref and every ISBN against Open Library and Google Books, and the resolved title must match the cited title.
Every Wikidata QID must resolve to an item whose English label or alias matches the entity name.
Every Wikimedia Commons file must exist.
A source you cannot verify must not be used.
Never invent a DOI, ISBN, QID, file name, page number or locator.
A `locator` (page, chapter, verse, edict number, figure) is included only when you are confident it is correct; otherwise omit it.

### 5.3 Source file

One file per source at `sources/<slug>.yaml`, id `src.<slug>`, slug pattern `<firstauthorsurname>-<year>-<short-title>`.

```yaml
id: src.thapar-2002-early-india
type: book
title: "Early India: From the Origins to AD 1300"
authors: [Romila Thapar]
year: 2002
publisher: University of California Press
isbn: "9780520242258"
```

Types: `primary-text`, `translation`, `inscription`, `excavation-report`, `coin-catalogue`, `manuscript`, `foreign-account`, `journal-article`, `book`, `book-chapter`, `reference-work`, `museum-record`, `dataset`, `government-record`, `web`.
Journal articles need a `doi` (or a stable `url`, such as JSTOR, for pre-DOI articles).
Books need an `isbn` (digits only, no hyphens, quoted), `oclc`, `doi` or stable `url` such as archive.org for out-of-copyright editions.
Web sources need a `url`.

## 6. Entities

One file per entity at `entities/<type>/<slug>.yaml`, id `<type>.<slug>`.

Types: `event`, `person`, `text`, `site`, `polity`, `artifact`, `tradition`, `concept`, `cosmology`.
Kinds (the ring on the Kaalchakra wheel): `cosmology`, `prehistory`, `civilisation`, `polity`, `text`, `person`, `science`, `art`, `dharma`, `site`, `event`.

```yaml
id: event.ashoka-major-rock-edict-xiii
type: event
kind: event
names:
  en: Major Rock Edict XIII of Ashoka
  iast: null
  native: null
summary: >-
  Ashoka records his remorse over the conquest of Kalinga and names five Hellenistic kings,
  which anchors Mauryan chronology to independently dated Greek reigns.
summaries:
  kids: >-
    After a terrible war in Kalinga, Emperor Ashoka carved a message in stone saying he was sorry
    and that he would now rule by dharma.
  teen: >-
    Edict XIII is one of the most important inscriptions in Indian history: it names Greek kings
    whose dates are known, so historians can date Ashoka himself.
region: Pan-Indian (copies at Kalsi, Shahbazgarhi, Mansehra, Girnar and elsewhere)
location: { name: Kalsi, lat: 30.52, lon: 77.85 }
datings:
  - method: foreign-synchronism
    range: { earliest: "262 BCE", latest: "255 BCE", precision: decade, circa: true }
    grade: A
    label: Synchronism with Hellenistic kings
    sources: [src.example-a]
    note: The five kings named reigned together only in the mid-3rd century BCE.
claims:
  - text: The edict names Antiochus, Ptolemy, Antigonus, Magas and Alexander.
    grade: A
    sources: [src.example-b]
relations:
  - { kind: issued-by, target: person.ashoka }
wikidata: null
image:
  commons: "File:Example.jpg"
  alt: Inscribed rock face of the Kalsi edicts
  credit: Photographer name
  license: CC BY-SA 4.0
tags: [inscription, maurya]
review: { status: draft, author: "<model or person>" }
```

Rules:

- `summary` is 1 to 3 sentences, at most 600 characters, factual, no superlatives without evidence.
- `summaries.kids` (ages 8 to 12, at most 400 characters) and `summaries.teen` (ages 13 to 17, at most 500 characters) follow the same evidence standard; simpler is never looser.
- `claims` are the 1 to 4 most important checkable statements, each graded and sourced.
- `relations` target only entity ids that exist.
  A relation always reads as a sentence with this entity as the subject: `<this entity> <kind> <target>`.
  For example, on `text.aitareya-brahmana` write `{ kind: commented-on, target: text.rigveda }` (the Brahmana comments on the Rigveda), and on `person.ashoka` write `{ kind: ruled, target: polity.maurya-empire }`.
  Never use a kind in the reverse sense; the site shows inbound relations automatically.
  Author each connection once, on one of the two entities: the validator rejects a second relation between the same pair, in either direction and of any kind, because the page would list the other entity twice.
  Keep the most specific kind and put any further detail in `note`.
  Relation kinds: `part-of`, `authored`, `authored-by`, `ruled`, `ruled-by`, `patronised`, `patronised-by`, `succeeded`, `preceded`, `commented-on`, `located-at`, `excavated-at`, `issued-by`, `founded`, `founded-by`, `taught`, `student-of`, `influenced`, `contemporary-of`, `related-to`.
- `aliases` (optional) lists former ids of entities merged into this one, for example `aliases: [concept.rigvedic-sarasvati]` on `concept.ghaggar-hakra-sarasvati-debate`.
  The build turns each alias into a permanent (308) redirect from `/archive/<type>/<slug>` and from the Kaalchakra deep link `/kaalchakra?id=<id>`, so published URLs keep working.
  An alias must not be a live entity id and may be claimed by only one entity; relations and articles link to the surviving id, never to an alias.
  When you merge or rename an entity, add its old id here and record the merge in `corrections.yaml`.
- `debate` (optional) is a short neutral paragraph, shown under "Where scholars disagree", summarising the positions for a contested entity.
- `wikidata` and `image` are optional; include them only when verified.
- `review.status` is `draft` for new content.

## 7. Articles

Articles live at `_content/<category>/<slug>.md`.

```markdown
---
title: "The Maurya Empire"
summary: "One to three sentences, at most 400 characters."
date: "2026-01-10"
updated: "2026-11-21"
tags: [ancient history, maurya]
datings:
  - method: scholarly-consensus
    range: { earliest: "322 BCE", latest: "185 BCE", precision: year, circa: true }
    grade: B
    sources: [src.thapar-2002-early-india]
entities: [polity.maurya-empire, person.ashoka]
readingLevel: adult
review: { status: draft, author: "<model or person>" }
---

Body in Markdown. Cite inline with [@src.thapar-2002-early-india, p. 175] or
[@src.a; @src.b, ch. 3] for several sources.
```

Rules:

- Every substantive paragraph cites at least one source inline.
- `datings` places the article on the Kaalchakra; `entities` links it to the archive.
- Headings use `##` and `###`; the title is not repeated in the body.
- No references section in the body: it is generated from the citations.

## 8. Contested topics

When a topic is contested, the entity carries one dating per serious position, each labelled and graded honestly, and the summary says plainly that it is contested.
Examples: the date of the Rigveda, the date of the Mahabharata war, the date of Adi Shankara, the Indo-Aryan migration, the identification of the Sarasvati.
Name the proponents in `label` or `note` (for example "B. N. Narahari Achar (astronomical reconstruction)").
Never dismiss a traditional position with mockery, and never present it as established history.

## 9. Language

- Dignified, warm, precise, and free of propaganda in either direction.
- Use IAST in `names.iast` and Devanagari (or the relevant native script) in `names.native` where useful; plain English spelling in prose (Ashoka, Shankara, Rigveda).
- Avoid outdated or loaded vocabulary: write "Indo-Aryan speakers" or "Vedic people", not "Aryans" as a race; describe varna and jati with historical nuance and sources.
- "First", "oldest", "earliest" and "greatest" each need a citation and a qualifier ("earliest known", "among the earliest").
- No emojis, no em dashes.

## 10. Corrections

Every substantive change to an existing published claim is recorded in `content/corrections.yaml` with the date, the target, the text before and after, the reason, and sources.
