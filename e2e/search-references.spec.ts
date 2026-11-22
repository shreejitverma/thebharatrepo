import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function noSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes) e.g. ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

const status = (page: Page) => page.getByRole('status').filter({ hasText: /results?|records indexed|Loading|Searching/ });
const results = (page: Page) => page.locator('.search-results > li');

/** On narrow viewports the filters sit behind a disclosure button. */
async function openFilters(page: Page) {
  const toggle = page.locator('.search-filters-toggle');
  if (await toggle.isVisible()) {
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  }
}

test.describe('search', () => {
  test('a ?q= link runs the query and shows excerpts with highlights', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/search?q=Harappa');
    await expect(status(page)).toHaveText(/^\d+ results? for “Harappa”\.$/);
    await expect(results(page).first()).toBeVisible();
    await expect(page.getByLabel('Search entities, articles and sources')).toHaveValue('Harappa');
    await expect(results(page).first().locator('.search-result__excerpt mark').first()).toBeVisible();
    const href = await results(page).first().locator('a[data-result]').getAttribute('href');
    expect(href).toMatch(/^\/(archive\/[a-z]+|sources|[a-z-]+)\/[a-z0-9-]+$/);
    await noHorizontalScroll(page);
    await noSeriousA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('typing searches as you type and keeps the URL in sync', async ({ page }) => {
    await page.goto('/search');
    await expect(status(page)).toContainText('records indexed');
    await page.getByLabel('Search entities, articles and sources').fill('Rigveda');
    await expect(status(page)).toHaveText(/results? for “Rigveda”/);
    await expect(page).toHaveURL(/\/search\?q=Rigveda$/);
    await expect(results(page).first()).toBeVisible();
  });

  test('the header search box goes to the search page', async ({ page }) => {
    await page.goto('/archive');
    const box = page.getByRole('search', { name: 'Site' }).getByRole('searchbox');
    await box.fill('Chola');
    await box.press('Enter');
    await expect(page).toHaveURL(/\/search\?q=Chola$/);
    await expect(status(page)).toHaveText(/results? for “Chola”/);
  });

  test('kind, category, grade and lens filters narrow results and are reflected in the URL', async ({ page }) => {
    await page.goto('/search?q=ashoka');
    await expect(status(page)).toHaveText(/results? for “ashoka”\.$/);
    const all = Number((await status(page).textContent())!.match(/^(\d+)/)![1]);

    await openFilters(page);
    await page.getByRole('group', { name: 'Kind' }).getByLabel(/^Articles/).check();
    await expect(page).toHaveURL(/kind=article/);
    await expect(status(page)).toHaveText(/results? for “ashoka” with 1 filter\./);
    const articles = Number((await status(page).textContent())!.match(/^(\d+)/)![1]);
    expect(articles).toBeGreaterThan(0);
    expect(articles).toBeLessThan(all);
    for (const kind of await results(page).locator('.search-result__kind').allTextContents()) expect(kind).toBe('Articles');

    // Another option in the same facet stays available (OR within a facet).
    await expect(page.getByRole('group', { name: 'Kind' }).getByLabel(/^People/)).toBeVisible();

    await page.getByRole('group', { name: 'Article category' }).getByLabel(/^History/).check();
    await expect(page).toHaveURL(/kind=article&category=history/);
    await expect(status(page)).toHaveText(/with 2 filters\./);
    for (const href of await results(page).locator('a[data-result]').evaluateAll((as) => as.map((a) => a.getAttribute('href')))) expect(href).toMatch(/^\/history\//);

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(page).toHaveURL(/\/search\?q=ashoka$/);
    await expect(status(page)).toHaveText(`${all} results for “ashoka”.`);
  });

  test('filters alone browse the archive, and deep links restore them', async ({ page }) => {
    await page.goto('/search?grade=E&lens=scholarship');
    await expect(status(page)).toHaveText(/^\d+ results? match these filters\.$/);
    await openFilters(page);
    await expect(page.getByRole('group', { name: 'Evidence grade' }).getByRole('checkbox', { name: /Grade E/ })).toBeChecked();
    await expect(page.getByRole('group', { name: 'Lens' }).getByRole('checkbox', { name: /Scholarship/ })).toBeChecked();
    const n = await results(page).count();
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++) await expect(results(page).nth(i).locator('.grade--E')).toHaveCount(1);
    await noSeriousA11yViolations(page);

    await page.goto('/search?lens=tradition');
    await expect(status(page)).toHaveText(/match these filters/);
    await expect(results(page).first()).toBeVisible();
  });

  test('keyboard: arrows move between the box and results, Enter opens one', async ({ page }) => {
    await page.goto('/search');
    const box = page.getByLabel('Search entities, articles and sources');
    await page.locator('h1').click();
    await page.keyboard.press('/');
    await expect(box).toBeFocused();
    await page.keyboard.type('maurya');
    await expect(status(page)).toHaveText(/results? for “maurya”/);
    const links = results(page).locator('a[data-result]');
    expect(await links.count()).toBeGreaterThan(1);

    await page.keyboard.press('ArrowDown');
    await expect(links.nth(0)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(links.nth(1)).toBeFocused();
    await page.keyboard.press('End');
    await expect(links.last()).toBeFocused();
    await page.keyboard.press('Home');
    await expect(links.nth(0)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(box).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Escape');
    await expect(box).toBeFocused();

    await page.keyboard.press('ArrowDown');
    const href = await links.nth(0).getAttribute('href');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${href}$`));
  });

  test('a name query puts the record with that exact title first', async ({ page }) => {
    for (const [q, title] of [
      ['ashoka', 'Ashoka'],
      ['buddha', 'Gautama Buddha'],
      ['aryabhata', 'Aryabhata'],
    ]) {
      await page.goto(`/search?q=${q}`);
      await expect(status(page)).toHaveText(new RegExp(`results? for “${q}”`));
      await expect(results(page).first().locator('a[data-result]')).toHaveText(title);
    }
  });

  test('a result is dated by its primary dating, and a traditional reckoning says so', async ({ page }) => {
    await page.goto('/search?q=kali%20yuga');
    const first = results(page).first();
    await expect(first.locator('a[data-result]')).toHaveText('Kali Yuga');
    await expect(first.locator('.search-result__meta > span').first()).toHaveText(/\(tradition\)$/);
    // The Mahabharata has a traditional and a scholarly dating; the scholarly one stands for it, unmarked.
    await page.goto('/search?q=mahabharata');
    const epic = results(page).first();
    await expect(epic.locator('a[data-result]')).toHaveText('Mahabharata');
    await expect(epic.locator('.search-result__meta > span').first()).toHaveText(/ CE$/);
  });

  test('a hard load of results does not shift the page as they arrive', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as { cls: number }).cls = 0;
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) if (!e.hadRecentInput) (window as unknown as { cls: number }).cls += e.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto('/search?q=Harappa');
    await expect(results(page).first()).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { cls: number }).cls)).toBeLessThan(0.1);
  });

  test('on a phone, the filter panel closes onto the updated results', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile', 'the filter panel is a disclosure only on narrow screens');
    await page.goto('/search?q=veda');
    await expect(status(page)).toHaveText(/results? for “veda”\./);
    await openFilters(page);
    await page.getByRole('group', { name: 'Kind' }).getByLabel(/^Texts/).check();
    await expect(status(page)).toHaveText(/results? for “veda” with 1 filter\./);
    const show = page.getByRole('button', { name: /^Show \d+ results?$/ });
    await expect(show).toBeVisible();
    const n = (await show.textContent())!.match(/\d+/)![0];
    await show.click();
    await expect(page.locator('.search-filters-toggle')).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('#search-filters')).toBeHidden();
    await expect(status(page)).toHaveText(`${n} results for “veda” with 1 filter.`);
    await expect(status(page)).toBeFocused();
  });

  test('no match shows an explicit 0 results state', async ({ page }) => {
    await page.goto('/search?q=xyzzyplugh');
    await expect(status(page)).toHaveText('0 results for “xyzzyplugh”.');
    await expect(results(page)).toHaveCount(0);
    await expect(page.getByText('Try a shorter or more general term')).toBeVisible();
    await noSeriousA11yViolations(page);

    // With a filter, nonsense still yields 0 and offers no misleading option counts.
    await page.goto('/search?q=xyzzyplugh&kind=text');
    await expect(status(page)).toHaveText('0 results for “xyzzyplugh” with 1 filter.');
    await openFilters(page);
    await expect(page.locator('.search-facet__option')).toHaveCount(1);
    await expect(page.locator('.search-facet__count')).toHaveText(' (0)');
  });

  test('without JavaScript the page explains itself and offers browsing', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('/search?q=Harappa');
    await expect(page.getByText('Search needs JavaScript')).toBeVisible();
    await expect(page.locator('.search-noscript a[href="/archive"]')).toBeVisible();
    await expect(page.locator('.search-loading')).toBeHidden();
    await context.close();
  });
});

test.describe('references', () => {
  test('an article shows its evidence summary and numbered, deduplicated references', async ({ page }) => {
    await page.goto('/history/maurya-empire');
    const summary = page.getByRole('complementary', { name: 'Evidence at a glance' });
    await expect(summary).toBeVisible();
    await expect(summary.locator('.grade').first()).toBeVisible();

    const refs = page.locator('.references ol > li');
    const n = await refs.count();
    expect(n).toBeGreaterThan(0);
    await expect(summary.getByRole('link', { name: `${n} references` })).toHaveAttribute('href', '#refs');
    // Numbered 1..n, one entry per source, and every in-text number points at an existing entry.
    expect(await refs.evaluateAll((lis) => lis.map((li) => li.id))).toEqual(Array.from({ length: n }, (_, i) => `ref-${i + 1}`));
    const records = await refs.locator('a.source-record').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    expect(new Set(records).size).toBe(n);
    const targets = await page.locator('sup.cite a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
    for (const t of new Set(targets)) await expect(page.locator(t!)).toHaveCount(1);

    // A citation jumps to its reference, and the reference links back to that citation.
    const cite = page.locator('sup.cite a').first();
    const citeId = await cite.getAttribute('id');
    await cite.click();
    await expect(page).toHaveURL(/#ref-\d+$/);
    await expect(page.locator(`.references a.references__back[href="#${citeId}"]`)).toHaveCount(1);

    // Fragment targets land below the sticky header, not under it.
    for (const link of [summary.getByRole('link', { name: `${n} references` }), page.locator('.references a.references__back').first()]) {
      await link.click();
      const hash = await page.evaluate(() => location.hash);
      const [targetTop, headerBottom] = await page.evaluate((h) => [document.querySelector(h)!.getBoundingClientRect().top, document.querySelector('.site-header')!.getBoundingClientRect().bottom], hash);
      expect(targetTop).toBeGreaterThanOrEqual(headerBottom);
    }

    await noHorizontalScroll(page);
    await noSeriousA11yViolations(page);
  });

  test('a source record lists the article, entities and corrections that cite it', async ({ page }) => {
    await page.goto('/history/maurya-empire');
    const title = await page.locator('h1').textContent();
    await page.locator('.references a.source-record').first().click();
    await expect(page).toHaveURL(/\/sources\/[a-z0-9-]+$/);
    await expect(page.getByRole('heading', { name: 'Cited in the archive' })).toBeVisible();
    await expect(page.locator('.cited-by__summary')).toHaveText(/^Cited by \d+ articles?, \d+ archive records? and \d+ corrections?\.$/);
    await expect(page.locator('.cited-by').getByRole('link', { name: title!, exact: true })).toHaveAttribute('href', '/history/maurya-empire');
    await noHorizontalScroll(page);
    await noSeriousA11yViolations(page);
  });

  test('a correction cited by a source links to its anchor in the log', async ({ page }) => {
    await page.goto('/corrections');
    const record = page.locator('.correction a.source-record').first();
    await record.click();
    await expect(page).toHaveURL(/\/sources\//);
    const link = page.locator('.cited-by a[href^="/corrections#correction-"]').first();
    const href = await link.getAttribute('href');
    await link.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.locator(href!.replace('/corrections', ''))).toBeVisible();
  });

  test('the bibliography links every source to its record', async ({ page }) => {
    await page.goto('/sources');
    const items = page.locator('.biblio > li');
    const n = await items.count();
    expect(n).toBeGreaterThan(0);
    await expect(items.locator('a[href^="/sources/"]')).toHaveCount(n);
  });

  test('an entity page links its sources to their records', async ({ page }) => {
    await page.goto('/archive');
    await page.locator('a.card[href^="/archive/"]').first().click();
    const record = page.locator('.dating__sources a.source-record').first();
    await expect(record).toBeVisible();
    const entity = await page.locator('h1').textContent();
    await record.click();
    await expect(page.locator('.cited-by').getByRole('link', { name: entity!, exact: true })).toBeVisible();
  });
});
