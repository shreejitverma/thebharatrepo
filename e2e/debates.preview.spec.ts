/**
 * Runs against the owner's preview server (DEBATES_PREVIEW=1, see playwright.config.ts), the only place unpublished
 * debate drafts render. The server also loads e2e/fixtures/content, so the draft here is the test fixture
 * e2e/fixtures/content/debates/e2e-unpublished-fixture.yaml, never real content. The public build is covered in
 * debates.spec.ts.
 */
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const DRAFT = '/debates/e2e-unpublished-fixture';
const PUBLISHED = '/debates/date-of-the-buddha';
const BUDDHA = '/archive/person/gautama-buddha';

async function noSeriousA11yViolations(page: Page) {
  // The dev-mode tools overlay is not part of the page.
  const results = await new AxeBuilder({ page }).exclude('nextjs-portal').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes) e.g. ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
}

test.describe.configure({ timeout: 90_000 });

test('the preview index lists the draft as unpublished, beside the published debates, and says it is a preview', async ({ page }) => {
  await page.goto('/debates');
  await expect(page.locator('.unpublished-banner')).toContainText('Preview build.');
  const draft = page.locator(`a.card[href="${DRAFT}"]`);
  await expect(draft).toContainText('Test fixture: an unpublished debate draft');
  await expect(draft).toContainText('unpublished draft');
  const published = page.locator(`a.card[href="${PUBLISHED}"]`);
  await expect(published).toContainText('The date of the Buddha');
  await expect(published).not.toContainText('unpublished draft');
});

test('the draft page is marked, kept out of search engines, and shows positions with proponents, graded cited evidence and what would change it', async ({ page }) => {
  await page.goto(DRAFT);
  await expect(page.locator('h1')).toHaveText('Test fixture: an unpublished debate draft');
  await expect(page.locator('.unpublished-banner')).toContainText('Unpublished draft.');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  // Not marked for the search index, even in a preview build.
  await expect(page.locator('[data-pagefind-body]')).toHaveCount(0);

  const positions = page.locator('section.position');
  await expect(positions).toHaveCount(2);
  for (const p of await positions.all()) {
    expect(await p.locator('ul.proponents > li').count()).toBeGreaterThan(0);
    expect(await p.locator('ul.evidence-list > li').count()).toBeGreaterThan(0);
    await expect(p.locator('ul.evidence-list > li .grade').first()).toBeVisible();
    await expect(p.locator('ul.evidence-list > li .dating__sources li').first()).toContainText(/pp?\./);
  }
  await expect(page.locator('#tradition-fixture .lens-tag')).toHaveText('Tradition');
  await expect(page.locator('#tradition-fixture .position__meta .grade--D')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'What would change this' })).toBeVisible();
  // Only the scholarship position proposes a range.
  await expect(page.locator('.position-chart li')).toHaveCount(1);
  await expect(page.locator('.kc-strip')).toBeVisible();
  await expect(page.locator(`a.card[href="${BUDDHA}"] .name-native`)).toHaveAttribute('lang', 'sa-Deva');
  await expect(page.locator('.review-note')).toContainText('Not yet approved for publication.');

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await noSeriousA11yViolations(page);
});

test('the draft debate states its review status in the same words as an entity page', async ({ page }) => {
  // The fixture and the Buddha's entry are both drafts, so the entity page's wording is the expected wording.
  const clause = async (path: string) => {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    const text = (await page.locator('.review-note').first().textContent()) ?? '';
    return /Review status: ([^.]*)\./.exec(text)?.[1];
  };
  const entity = await clause(BUDDHA);
  expect(entity).toMatch(/^draft, .*awaiting editor review$/);
  expect(await clause(DRAFT)).toBe(entity);
});

test('a published debate in the preview build carries no draft marking', async ({ page }) => {
  await page.goto(PUBLISHED);
  await expect(page.locator('.unpublished-banner')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(0);
  await expect(page.locator('.review-note')).toContainText('Approved for publication by');
});

test('related entity pages link the draft in the preview build, marked as a draft', async ({ page }) => {
  await page.goto(BUDDHA);
  await expect(page.getByRole('heading', { name: 'Debates' })).toBeVisible();
  await expect(page.locator(`a[href="${DRAFT}"]`)).toContainText('unpublished draft');
  await expect(page.locator(`a[href="${PUBLISHED}"]`)).not.toContainText('unpublished draft');
  await page.locator(`a[href="${DRAFT}"]`).click();
  // The dev server compiles the route on first navigation.
  await expect(page).toHaveURL(DRAFT, { timeout: 30_000 });
});

test('a source cited by the draft never lists it, even in the preview build', async ({ page }) => {
  await page.goto('/sources/coningham-2013-earliest-buddhist-shrine');
  await expect(page.getByRole('heading', { name: 'Cited in the archive' })).toBeVisible();
  await expect(page.locator(`.cited-by a[href^="${DEBATE}"]`)).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /^Debates/ })).toHaveCount(0);
  await expect(page.locator('.cited-by__summary, .cited-by .empty')).not.toContainText('debate');
});
