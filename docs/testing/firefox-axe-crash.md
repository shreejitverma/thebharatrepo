# Firefox page crash: ARIA element reflection read from two worlds

The e2e suite never runs a Playwright role or label query that has to resolve an `aria-labelledby` name before or after an axe scan in Firefox.
It matches those elements by their attributes instead, for example `aside.evidence-summary[aria-labelledby="evidence-summary-title"]`.
This note records why, with a reproduction small enough to rerun after any Playwright, Firefox or axe-core upgrade.

## Environment

Reproduced on 2026-11-22 on macOS with Playwright 1.65.1 (its Firefox 159.0 build, `firefox-1572`), axe-core 4.14.1 and @axe-core/playwright 4.14.0.
Chromium and WebKit pass every case below.

## Reproduction

Put this file in a directory of its own, next to a Playwright config with a `Desktop Firefox` project, and run it with `npx playwright test`.

```ts
import { expect, test } from '@playwright/test';

const HTML = `<!doctype html><html lang="en"><head><title>Repro</title></head><body><main>
<section aria-labelledby="h"><h2 id="h">Evidence at a glance</h2><p>Text.</p></section>
</main></body></html>`;
const READ = `String(document.querySelector('section').ariaLabelledByElements?.length)`;

test('page world reads the reflection twice: passes', async ({ page }) => {
  await page.setContent(HTML);
  expect(await page.evaluate(READ)).toBe('1');
  expect(await page.evaluate(READ)).toBe('1');
});

test('Playwright resolves the name, then the page reads the reflection: Page crashed', async ({ page }) => {
  await page.setContent(HTML);
  await expect(page.getByRole('region', { name: 'Evidence at a glance' })).toBeVisible();
  await page.evaluate(READ);
});

test('the page reads the reflection, then Playwright resolves the name: Page crashed', async ({ page }) => {
  await page.setContent(HTML);
  await page.evaluate(READ);
  await expect(page.getByRole('region', { name: 'Evidence at a glance' })).toBeVisible();
});
```

Both crashing tests fail with `Error: Page crashed`, and every later call on the page fails the same way.

## What triggers it

Two things read `Element.ariaLabelledByElements`, the ARIA element reflection property, on the same element:

- Playwright's injected script, in its own utility world, whenever a `getByRole(..., { name })` or `getByLabel` query computes a name from `aria-labelledby` (`getAriaLabelledByElements` in `playwright-core`).
- Code in the page's main world: `page.evaluate`, a page script, or axe-core, whose attribute table maps `aria-labelledby` to `ariaLabelledByElements`.

Either order crashes the content process; two reads in the same world do not.
A named role query computes the name of every element with that role, so it reads the reflection of every `aria-labelledby` landmark on the page, not only of the one it is looking for.
The crash is in the browser, so it is most likely a bug in element reflection across JavaScript worlds in Firefox or in Playwright's patched build, not in this site's markup.
That is an inference from the cases above; the crash itself carries no stack trace.

The same page passes when any one ingredient is missing:

| Variant | Result |
|---|---|
| `getByRole('region', { name })` on an `aria-labelledby` section, then axe | Page crashed |
| The same with an `aside` (`complementary`) | Page crashed |
| `getByLabel(name)` on the same section, then axe | Page crashed |
| axe first, then the role query | Page crashed |
| `axe.run()` injected with `addScriptTag`, without @axe-core/playwright | Page crashed |
| An `aria-label` section queried by name on a page that also has an `aria-labelledby` section, then axe | Page crashed |
| The only section named by `aria-label` instead of `aria-labelledby` | Passes |
| `getByRole('region')` with no name, then axe | Passes |
| `getByRole('heading', { name })`, a name from content, then axe | Passes |
| An attribute locator, `section[aria-labelledby="h"]`, then axe | Passes |
| The role query without axe | Passes |

Run one rule at a time and axe crashes the page only in the rules that read the reflected attribute: `aria-allowed-attr`, `aria-conditional-attr`, `aria-prohibited-attr`, `hidden-content`, `label-content-name-mismatch`, `landmark-unique`, `nested-interactive` and `target-size`.

## The workaround in the suite

Any test that runs axe matches landmarks and labelled elements by their tag and attributes, never by a named role or label query, on any page that has an `aria-labelledby` landmark.
The sites are commented where they occur: `e2e/phase2.spec.ts` (the Kaalchakra strip on entity pages), `e2e/site.spec.ts` and `e2e/search-references.spec.ts` (the evidence summary).
A named query for a role no `aria-labelledby` element on the page has, such as a heading or a link, is safe.

## When to revisit

Rerun the reproduction after upgrading Playwright.
If the crashing tests pass in Firefox, the attribute locators can go back to `getByRole` queries.
