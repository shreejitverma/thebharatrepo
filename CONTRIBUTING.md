# Contribute to The Bharat Repo

A content contribution adds a dated, sourced record to the archive.
Read the [editorial standard](docs/editorial/STYLE.md) before preparing your entry.

## 1. Fork and set up the repository

Fork [The Bharat Repo](https://github.com/shreejitverma/thebharatrepo) on GitHub.
Clone your fork and create a branch for one contribution.

```sh
git clone https://github.com/YOUR-USERNAME/thebharatrepo.git
cd thebharatrepo
git switch -c content/add-sanchi-world-heritage-inscription
npm ci
```

## 2. Scaffold the files

Create an entity using its type and a lowercase, hyphen-separated slug.
The worked example records the inscription of the Buddhist Monuments at Sanchi on the World Heritage List in 1989.

```sh
npm run content:new -- event sanchi-world-heritage-inscription
```

This creates `content/entities/event/sanchi-world-heritage-inscription.yaml` with ID `event.sanchi-world-heritage-inscription`.
The starting date, dating method, precision, grade, and kind are examples to replace or confirm.
Fill the TODO fields and cite real sources before checking the entry.

Search `content/sources/` for the work you used.
If it already has an ID, cite it directly.
The example uses [World Heritage Committee Decision 13 COM XV.A](https://whc.unesco.org/en/decisions/3636/), which has a separate record from the existing Sanchi property listing.

```sh
npm run content:new-source -- unesco-1989-sanchi-inscription
```

## 3. Research, cite, and grade the evidence

Open the source and check that it supports each claim and dating.
Record a DOI, ISBN, OCLC number, or stable URL, and copy the edition title as it appears in the registry or on the publisher's page.
Use a locator such as a page, section, or decision number when you can check it.

Replace the example source scaffold with the following record.

```yaml
id: src.unesco-1989-sanchi-inscription
type: government-record
title: UNESCO World Heritage Centre - Decision - 13 COM XV.A
publisher: UNESCO World Heritage Centre
year: 1989
url: https://whc.unesco.org/en/decisions/3636/
```

Replace the entity scaffold with the following record.

```yaml
id: event.sanchi-world-heritage-inscription
type: event
kind: event
names:
  en: World Heritage inscription of the Buddhist Monuments at Sanchi
summary: UNESCO's World Heritage Committee inscribed the Buddhist Monuments at Sanchi on the World Heritage List in 1989.
datings:
  - method: documentary
    range:
      earliest: "1989"
      latest: "1989"
      precision: year
      circa: false
    grade: A
    sources:
      - id: src.unesco-1989-sanchi-inscription
        locator: Decision 13 COM XV.A
claims:
  - text: The World Heritage Committee inscribed the Buddhist Monuments at Sanchi at its 13th session.
    grade: A
    sources:
      - id: src.unesco-1989-sanchi-inscription
        locator: Decision 13 COM XV.A
relations:
  - kind: related-to
    target: site.sanchi-stupa
review:
  status: draft
```

The committee decision directly attests the inscription and the session year, which supports the documentary method and grade A.
Use quoted years such as `"250 BCE"` for earlier entities.
For estimated dates, use `circa: true` and the range the evidence supports.
For an article, use inline citations such as `[@src.unesco-1989-sanchi-inscription, Decision 13 COM XV.A]`.

## 4. Validate and verify the evidence

Run the scoped check with all the files you changed.
It validates the selected files against the archive and verifies their identifiers and cited sources online.
With `--write-cache`, successful checks update `content/verification.json` for the offline build.

```sh
npm run content:check -- \
  content/entities/event/sanchi-world-heritage-inscription.yaml \
  content/sources/unesco-1989-sanchi-inscription.yaml \
  --write-cache
npm run content:validate
```

If the command reports an unknown source, check that the citation matches a source file's `id`.
If an identifier resolves to a different title, find the identifier for the edition you actually used.
If it resolves to one volume of a multi-volume work, name that volume in the title ("The Ain-i Akbari, Volume 1"), or, when your citations reach several volumes, use an identifier for the whole work, such as an Open Library edition record of the set.
An unnumbered title never matches a single-volume record.
If a registry is unavailable, retry when it is reachable or use a verifiable source that supports the same claim.

## 5. Open a pull request

Commit your entity, its new source files, and any verification cache changes produced by the check.
Push the branch to your fork and open a pull request against the upstream repository using the template.
List the main claims and datings, link the evidence with locators, and explain the grades.
Include the check results and identify any genuine uncertainty an editor should assess.

Keep `review.status: draft` for new submissions.
After human sign-off, the editor sets `reviewed` and records their name in `reviewer` and the review date in `lastReviewed` using `YYYY-MM-DD`.
Editors may set `published` once the approved version is released.
Run `npm run content:review-queue` to see entries still awaiting human review.

For a substantive change to a published claim, include an entry in [the corrections log](content/corrections.yaml) with the target, date, text before and after, reason, and sources.
If you are reporting an issue without submitting a change, choose the relevant [issue form](https://github.com/shreejitverma/thebharatrepo/issues/new/choose).

Contributions to the archive are published under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
The repository's code is under the [MIT License](LICENSE).
