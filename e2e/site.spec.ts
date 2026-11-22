import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function firstEntityHref(page: Page): Promise<string> {
  await page.goto('/archive');
  const href = await page.locator('a.card[href^="/archive/"]').first().getAttribute('href');
  expect(href).toBeTruthy();
  return href!;
}

async function noSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes) e.g. ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('pages render, are accessible and fit the viewport', () => {
  for (const path of ['/', '/kaalchakra', '/archive', '/methodology', '/sources', '/corrections', '/history']) {
    test(`page ${path}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      await page.goto(path);
      await expect(page.locator('h1').first()).toBeVisible();
      await expect(page.locator('.draft-notice')).toContainText('awaiting human editorial review');
      await noHorizontalScroll(page);
      await noSeriousA11yViolations(page);
      expect(errors).toEqual([]);
    });
  }

  test('entity page shows datings with grades and sources', async ({ page }) => {
    const href = await firstEntityHref(page);
    await page.goto(href);
    await expect(page.getByRole('heading', { name: 'When, and how we know' })).toBeVisible();
    await expect(page.locator('.dating').first()).toBeVisible();
    await expect(page.locator('.dating__sources li').first()).toBeVisible();
    await expect(page.locator('.kc-strip')).toBeVisible();
    await noHorizontalScroll(page);
    await noSeriousA11yViolations(page);
  });

  test('article tables render as tables', async ({ page }) => {
    await page.goto('/music/the-72-melakartas');
    await expect(page.locator('.article-content table th').first()).toBeVisible();
    await expect(page.locator('.article-content')).not.toContainText('| ---');
    await noHorizontalScroll(page);
    await noSeriousA11yViolations(page);
  });

  test('article header shows every dating with its sources', async ({ page }) => {
    await page.goto('/philosophy/mandukya-upanishad');
    const datings = page.locator('.article-header .dating');
    await expect(datings).toHaveCount(2);
    await expect(page.locator('.article-header .dating--tradition')).toContainText('Vedanta sampradaya');
    const flood = page.locator('.article-header .dating__sources a[href="https://doi.org/10.1111/b.9780631215356.2005.00005.x"]');
    await expect(flood).toBeVisible();
    await expect(flood).toContainText('The Blackwell Companion to Hinduism');
    await expect(page.locator('.article-meta')).toContainText('3 sources cited');
    await expect(page.locator('.references li')).toHaveCount(2);
    await noHorizontalScroll(page);
    await noSeriousA11yViolations(page);
  });

  test('article page renders numbered citations and references', async ({ page }) => {
    await page.goto('/history');
    await page.locator('a.card').first().click();
    await expect(page.locator('sup.cite a').first()).toBeVisible();
    const refs = page.locator('.references li');
    expect(await refs.count()).toBeGreaterThan(0);
    await noHorizontalScroll(page);
    await noSeriousA11yViolations(page);
  });
});

test.describe('Kaalchakra', () => {
  test('selecting a point opens its record and is reflected in the URL', async ({ page }) => {
    await page.goto('/kaalchakra');
    await expect(page.locator('.kc-toolbar')).toBeVisible();
    // Click a mark's dedicated hit target: an arc's bounding-box centre can fall on the era sector beneath.
    const mark = page.locator('.kc-canvas .kc-wheel .kc-mark circle[fill="transparent"]').nth(5);
    await mark.click({ force: true });
    const heading = page.locator('.kc-panel h2');
    await expect(heading).not.toHaveText('One wheel, two lenses');
    await expect(page).toHaveURL(/[?&]id=/);
    await expect(page.locator('.kc-panel .dating').first()).toBeVisible();
  });

  test('a deep link restores view and selection', async ({ page }) => {
    const href = await firstEntityHref(page);
    const [, , type, slug] = href.split('/');
    await page.goto(`/kaalchakra?view=list&id=${type}.${slug}`);
    await expect(page.locator('.kc-list')).toBeVisible();
    await expect(page.locator('.kc-list button[aria-current="true"]')).toHaveCount(1);
    await expect(page.locator('.kc-panel .btn--primary')).toHaveAttribute('href', href);
  });

  test('lens switching filters to traditional datings only', async ({ page }) => {
    await page.goto('/kaalchakra?view=list');
    const all = await page.locator('.kc-list li').count();
    await page.getByRole('group', { name: 'Lens' }).getByRole('button', { name: 'Tradition' }).click();
    const trad = await page.locator('.kc-list li').count();
    expect(trad).toBeGreaterThan(0);
    expect(trad).toBeLessThan(all);
    await expect(page).toHaveURL(/lens=tradition/);
  });

  test('river view zooms and pans', async ({ page }) => {
    await page.goto('/kaalchakra?view=river');
    const range = page.locator('.kc-river-controls span');
    const before = await range.textContent();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await page.getByRole('button', { name: 'Zoom in' }).click();
    await expect(range).not.toHaveText(before ?? '');
    await expect(page).toHaveURL(/win=/);
  });

  test('tapping an era on the wheel zooms the river into it', async ({ page }) => {
    await page.goto('/kaalchakra');
    await page.getByRole('group', { name: 'Zoom into an era' }).getByRole('button', { name: 'Classical' }).click();
    await expect(page.locator('.kc-river')).toBeVisible();
    await expect(page.locator('.kc-river-controls span')).toContainText('BCE');
  });

  test('keyboard arrows step through entries in time order', async ({ page }) => {
    await page.goto('/kaalchakra');
    await expect(page.locator('.kc-toolbar')).toBeVisible();
    await page.locator('.kc-canvas').focus();
    await page.keyboard.press('ArrowRight');
    const first = await page.locator('.kc-panel h2').textContent();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.kc-panel h2')).not.toHaveText(first ?? '');
  });

  test('filtering by text shows a definitive empty state', async ({ page }) => {
    await page.goto('/kaalchakra?view=list');
    await page.getByLabel('Filter entries').fill('zzzzqqqq');
    await expect(page.getByText('0 entries match these filters.')).toBeVisible();
  });
});

test('search finds entities and articles', async ({ page }) => {
  await page.goto('/search?q=Harappa');
  await expect(page.locator('.card').first()).toBeVisible();
});
