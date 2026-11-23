/**
 * Debates in the public build: every published debate is first-class (index, navigation, entity pages, search,
 * open data), and the owner rule holds: an unpublished debate never reaches the site.
 *
 * No real draft has to exist for the rule to stay proven. `npm run build:e2e` (CI's e2e build) loads the fixture
 * draft e2e/fixtures/content/debates/e2e-unpublished-fixture.yaml beside the real content, and these tests first
 * confirm that the build under test loaded it, then that it is unreachable. The owner's preview, where drafts do
 * render, is covered in debates.preview.spec.ts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const FIXTURE_ID = 'debate.e2e-unpublished-fixture';
const FIXTURE = '/debates/e2e-unpublished-fixture';
const BUDDHA = '/archive/person/gautama-buddha';

/** Written by scripts/build-search.ts at the end of every build: which debates that build loaded. */
function debatesBuild(): { preview: boolean; published: string[]; unpublished: string[] } {
  const file = path.join(__dirname, '..', '.next', 'debates-build.json');
  if (!fs.existsSync(file)) throw new Error(`${file} not found: build with \`npm run build:e2e\` before running the e2e suite`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const BUILD = debatesBuild();
const PUBLISHED = BUILD.published.map((id) => `/debates/${id.slice('debate.'.length)}`);

async function noSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes) e.g. ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

const results = (page: Page) => page.locator('.search-results a[data-result]');
const status = (page: Page) => page.getByRole('status').filter({ hasText: /results?|records indexed|Loading|Searching/ });

test('the build under test is a public build that loaded the unpublished fixture draft', () => {
  // Without this, every "the draft is unreachable" check below would pass vacuously against a build that never saw a draft.
  expect(BUILD.preview, 'a DEBATES_PREVIEW build renders drafts; run the public suite against `npm run build:e2e`').toBe(false);
  expect(BUILD.unpublished, 'build with `npm run build:e2e`, which adds e2e/fixtures/content to the content roots').toContain(FIXTURE_ID);
  expect(BUILD.published.length).toBeGreaterThan(0);
});

test.describe('the debates index', () => {
  test('lists every published debate, is indexable, and is linked from the header and footer', async ({ page }) => {
    await page.goto('/debates');
    await expect(page.locator('h1')).toHaveText('Where the evidence is contested');
    const hrefs = await page.locator('main a.card').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(hrefs.sort()).toEqual([...PUBLISHED].sort());
    await expect(page.locator('.unpublished-banner')).toHaveCount(0);
    await expect(page.getByText('unpublished draft')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Debates' })).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('.site-footer a[href="/debates"]')).toHaveCount(1);
    await noHorizontalScroll(page);
    await noSeriousA11yViolations(page);
  });

  test('each card shows its question, positions, placement and one grade badge per position', async ({ page }) => {
    await page.goto('/debates');
    const card = page.locator('a.card[href="/debates/date-of-the-buddha"]');
    await expect(card.locator('h3')).toHaveText('The date of the Buddha');
    await expect(card).toContainText('When did the Buddha live, and when did he die?');
    await expect(card).toContainText(/3 positions, c\. \d+ to \d+ BCE/);
    await expect(card.locator('.grade')).toHaveCount(3);
  });
});

test.describe('the unpublished fixture draft never reaches the public build', () => {
  test('its page is not built', async ({ page, request }) => {
    const res = await page.goto(FIXTURE);
    expect(res?.status()).toBe(404);
    expect((await request.get(`${FIXTURE}.rsc`)).status()).toBe(404);
  });

  test('no page links it: not the index, not its related entity, which links the published debate', async ({ page }) => {
    await page.goto('/debates');
    await expect(page.locator(`a[href="${FIXTURE}"]`)).toHaveCount(0);
    await page.goto(BUDDHA);
    await expect(page.getByRole('heading', { name: 'Debates' })).toBeVisible();
    await expect(page.locator('a[href="/debates/date-of-the-buddha"]')).toContainText('The date of the Buddha');
    await expect(page.locator(`a[href="${FIXTURE}"]`)).toHaveCount(0);
    await expect(page.getByText('unpublished draft')).toHaveCount(0);
  });

  test('search does not index it, even for its own title', async ({ page }) => {
    await page.goto('/search?q=unpublished%20debate%20draft');
    await expect(status(page)).toHaveText(/results? for/);
    await expect(page.locator(`.search-results a[href="${FIXTURE}"]`)).toHaveCount(0);
  });

  test('the open data export holds every published debate and not the draft', async ({ request, page }) => {
    const archive = await (await request.get('/data/archive.json')).json();
    expect(archive.debates.map((d: { id: string }) => d.id).sort()).toEqual([...BUILD.published].sort());
    expect(JSON.stringify(archive)).not.toContain('e2e-unpublished-fixture');
    const manifest = await (await request.get('/data/manifest.json')).json();
    expect(manifest.counts.debates).toBe(BUILD.published.length);
    await page.goto('/data');
    await expect(page.locator('.data-counts div').filter({ hasText: /^debates/ }).locator('dd')).toHaveText(String(BUILD.published.length));
  });
});

test.describe('search finds published debates', () => {
  // A debate's own title (or its subject's name) puts it first; a name query still puts the named record first,
  // because a debate's positions and evidence are down-weighted in the index (see the debate page).
  for (const [q, href] of [
    ['ram setu', '/debates/ram-setu'],
    ['date of the buddha', '/debates/date-of-the-buddha'],
  ]) {
    test(`"${q}" ranks the debate first`, async ({ page }) => {
      await page.goto(`/search?q=${encodeURIComponent(q)}`);
      await expect(results(page).first()).toHaveAttribute('href', href);
      await expect(page.locator('.search-results > li').first().locator('.search-result__kind')).toHaveText('Debates');
    });
  }

  test('"indo-aryan migration" ranks the debate in the top three, under the archive record of the same debate', async ({ page }) => {
    await page.goto('/search?q=indo-aryan%20migration');
    await expect(results(page).first()).toHaveAttribute('href', '/archive/concept/indo-aryan-migration');
    const top = await results(page).evaluateAll((as) => as.slice(0, 3).map((a) => a.getAttribute('href')));
    expect(top).toContain('/debates/indo-aryan-migration');
  });

  test('"buddha" ranks the person first and the debate second', async ({ page }) => {
    await page.goto('/search?q=buddha');
    await expect(results(page).first()).toHaveAttribute('href', BUDDHA);
    await expect(results(page).nth(1)).toHaveAttribute('href', '/debates/date-of-the-buddha');
  });

  test('the Debates kind filter narrows results to debates', async ({ page }) => {
    await page.goto('/search?q=date');
    await expect(status(page)).toHaveText(/results? for “date”\.$/);
    const toggle = page.locator('.search-filters-toggle');
    if (await toggle.isVisible()) await toggle.click();
    await page.getByRole('group', { name: 'Kind' }).getByLabel(/^Debates/).check();
    await expect(page).toHaveURL(/kind=debate/);
    await expect(status(page)).toHaveText(/results? for “date” with 1 filter\./);
    const hrefs = await results(page).evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(hrefs.length).toBeGreaterThan(1);
    for (const h of hrefs) expect(PUBLISHED).toContain(h);
  });
});

test.describe('every published debate page', () => {
  for (const href of PUBLISHED) {
    test(href, async ({ page }) => {
      const res = await page.goto(href);
      expect(res?.status()).toBe(200);
      await expect(page.locator('h1')).not.toBeEmpty();
      await expect(page.locator('.debate-question')).toHaveText(/\?$/);
      await expect(page.locator('.unpublished-banner')).toHaveCount(0);
      await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
      expect(await page.locator('section.position').count()).toBeGreaterThanOrEqual(2);
      for (const p of await page.locator('section.position').all()) {
        await expect(p.locator('.position__meta .grade')).toBeVisible();
        expect(await p.locator('ul.proponents > li').count()).toBeGreaterThan(0);
        expect(await p.locator('ul.evidence-list > li').count()).toBeGreaterThan(0);
      }
      // Placed on the Kaalchakra, with a working deep link.
      await expect(page.locator('.kc-strip')).toBeVisible();
      await expect(page.locator('.kc-strip a', { hasText: 'Open in the Kaalchakra' })).toHaveAttribute('href', /^\/kaalchakra\?id=/);
      await expect(page.getByRole('heading', { name: 'What would change this' })).toBeVisible();
      await expect(page.locator('.review-note')).toContainText(/Review status: published after review by .+ on \d{4}-\d{2}-\d{2}\. Approved for publication by .+ on \d{4}-\d{2}-\d{2}\./);
      await noHorizontalScroll(page);
      await noSeriousA11yViolations(page);
    });
  }
});
