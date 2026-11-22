/**
 * Runs against the owner's preview server (DEBATES_PREVIEW=1, see playwright.config.ts), the only
 * place unpublished debate drafts render. The public build is covered in learning.spec.ts.
 */
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const DEBATE = '/debates/date-of-the-buddha';

async function noSeriousA11yViolations(page: Page) {
  // The dev-mode tools overlay is not part of the page.
  const results = await new AxeBuilder({ page }).exclude('nextjs-portal').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes) e.g. ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
}

test.describe.configure({ timeout: 90_000 });

test('the preview index lists the draft and says it is a preview', async ({ page }) => {
  await page.goto('/debates');
  await expect(page.locator('.unpublished-banner')).toContainText('Preview build.');
  const card = page.locator(`a.card[href="${DEBATE}"]`);
  await expect(card).toContainText('The date of the Buddha');
  await expect(card).toContainText('unpublished draft');
});

test('the draft debate page shows steelmanned positions with proponents, graded cited evidence and what would change it', async ({ page }) => {
  await page.goto(DEBATE);
  await expect(page.locator('h1')).toHaveText('The date of the Buddha');
  await expect(page.locator('.unpublished-banner')).toContainText('Unpublished draft.');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

  const positions = page.locator('section.position');
  expect(await positions.count()).toBeGreaterThanOrEqual(2);
  for (let i = 0; i < (await positions.count()); i++) {
    const p = positions.nth(i);
    expect(await p.locator('ul.proponents > li').count()).toBeGreaterThan(0);
    expect(await p.locator('ul.evidence-list > li').count()).toBeGreaterThan(0);
    await expect(p.locator('ul.evidence-list > li .grade').first()).toBeVisible();
    await expect(p.locator('ul.evidence-list > li .dating__sources li').first()).toContainText(/pp\.|Edict|inscription/);
  }
  await expect(page.locator('#theravada-buddhist-era .lens-tag')).toHaveText('Tradition');
  await expect(page.locator('#theravada-buddhist-era .position__meta .grade--D')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What would change this' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What every position accepts' })).toBeVisible();
  await expect(page.locator('.position-chart li')).toHaveCount(3);
  await expect(page.locator('.kc-strip')).toBeVisible();
  await expect(page.locator('a.card[href="/archive/person/gautama-buddha"] .name-native')).toHaveAttribute('lang', 'sa-Deva');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await noSeriousA11yViolations(page);
});

test('related entity pages link the draft in the preview build', async ({ page }) => {
  await page.goto('/archive/person/gautama-buddha');
  await expect(page.getByRole('heading', { name: 'Debates' })).toBeVisible();
  await page.locator(`a[href="${DEBATE}"]`).click();
  // The dev server compiles the route on first navigation.
  await expect(page).toHaveURL(DEBATE, { timeout: 30_000 });
});
