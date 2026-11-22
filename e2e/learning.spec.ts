import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PATH = '/learn/how-we-date-ashoka';
const BUDDHA = '/archive/person/gautama-buddha';

async function noSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes) e.g. ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
}

test.describe('debates: unpublished drafts stay out of the public build', () => {
  test('the index shows a definitive empty state and no draft link', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/debates');
    await expect(page.locator('h1')).toHaveText('Where the evidence is contested');
    await expect(page.getByText('0 debates published yet.')).toBeVisible();
    await expect(page.locator('a[href^="/debates/"]')).toHaveCount(0);
    // An empty index is kept out of search results and out of the site footer until a debate is approved.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('.site-footer a[href="/debates"]')).toHaveCount(0);
    await noHorizontalScroll(page);
    await noSeriousA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('the draft page is not built', async ({ page }) => {
    const res = await page.goto('/debates/date-of-the-buddha');
    expect(res?.status()).toBe(404);
  });

  test('related entity pages and search do not link the draft', async ({ page, request }) => {
    await page.goto(BUDDHA);
    await expect(page.getByRole('heading', { name: 'Debates' })).toHaveCount(0);
    await expect(page.locator('a[href^="/debates/"]')).toHaveCount(0);
    const search = await (await request.get('/search.json')).text();
    expect(search).not.toContain('/debates/');
    expect(search).toContain('/learn/how-we-date-ashoka');
  });
});

test.describe('names in native script and IAST', () => {
  test('entity page tags Devanagari and IAST with their languages', async ({ page }) => {
    await page.goto(BUDDHA);
    await expect(page.locator('.names .name-native')).toHaveAttribute('lang', 'sa-Deva');
    await expect(page.locator('.names .name-native')).toHaveText('सिद्धार्थ गौतम');
    await expect(page.locator('.names .name-iast')).toHaveAttribute('lang', 'sa-Latn');
    await expect(page.locator('.names .name-iast')).toHaveText('Siddhārtha Gautama');
    const font = await page.locator('.names .name-native').evaluate((el) => getComputedStyle(el).fontFamily);
    expect(font).toContain('Devanagari');
  });

  test('a Tamil name is tagged ta and its romanisation ta-Latn', async ({ page }) => {
    await page.goto('/archive');
    const card = page.locator('a.card').filter({ has: page.locator('.name-native[lang="ta"]') }).filter({ has: page.locator('.name-iast') }).first();
    await expect(card.locator('.name-native')).toBeVisible();
    await expect(card.locator('.name-iast')).toHaveAttribute('lang', 'ta-Latn');
  });

  test('archive cards show names', async ({ page }) => {
    await page.goto('/archive');
    expect(await page.locator('a.card .card__names .name-native').count()).toBeGreaterThan(100);
    await noHorizontalScroll(page);
  });
});

test.describe('reading level switcher', () => {
  test('switches the summary, persists across pages and reloads, and the URL wins', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(BUDDHA);
    const lede = page.locator('.entity-lede');
    await expect(lede.locator('[data-rl="adult"]')).toBeVisible();
    await expect(lede.locator('[data-rl="teen"]')).toBeHidden();

    const group = page.getByRole('group', { name: 'Reading level' });
    await group.getByRole('button', { name: 'Teen' }).click();
    await expect(group.getByRole('button', { name: 'Teen' })).toHaveAttribute('aria-pressed', 'true');
    await expect(lede.locator('[data-rl="teen"]')).toBeVisible();
    await expect(lede.locator('[data-rl="adult"]')).toBeHidden();
    await expect(page).toHaveURL(/[?&]level=teen/);

    // Stored per viewer: a fresh visit without the parameter keeps the choice.
    await page.goto('/archive/person/ashoka');
    await expect(page.locator('.entity-lede [data-rl="teen"]')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Reading level' }).getByRole('button', { name: 'Teen' })).toHaveAttribute('aria-pressed', 'true');

    // The Kaalchakra panel follows the same preference.
    await page.goto('/kaalchakra?view=list&id=person.ashoka');
    await expect(page.locator('.kc-panel .level-tabs button[aria-pressed="true"]')).toHaveText('Teen');

    // A shared link with ?level= wins over the stored choice.
    await page.goto(`${BUDDHA}?level=kids`);
    await expect(page.locator('.entity-lede [data-rl="kids"]')).toBeVisible();
    await expect(page.locator('.entity-lede [data-rl="teen"]')).toBeHidden();

    await page.getByRole('group', { name: 'Reading level' }).getByRole('button', { name: 'Full' }).click();
    await expect(page.locator('.entity-lede [data-rl="adult"]')).toBeVisible();
    await expect(page).not.toHaveURL(/level=/);
    await noSeriousA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('works when storage is blocked', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('blocked', 'SecurityError');
        },
      });
    });
    const errors = collectErrors(page);
    await page.goto(BUDDHA);
    await page.getByRole('group', { name: 'Reading level' }).getByRole('button', { name: 'Kids' }).click();
    await expect(page.locator('.entity-lede [data-rl="kids"]')).toBeVisible();
    expect(errors).toEqual([]);
  });
});

test.describe('learning path', () => {
  test('the index lists the path', async ({ page }) => {
    await page.goto('/learn');
    await expect(page.locator('h1')).toHaveText('Learning paths');
    await page.locator(`a.card[href="${PATH}"]`).click();
    await expect(page).toHaveURL(PATH);
    await expect(page.locator('h1')).toHaveText('How do we know when Ashoka lived?');
  });

  test('shows steps with names and evidence, and tracks progress per viewer', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(PATH);
    const steps = page.locator('ol.steps > li.step');
    await expect(steps).toHaveCount(7);
    await expect(steps.nth(1).locator('.name-native')).toHaveAttribute('lang', 'sa-Deva');
    await expect(steps.nth(2).locator('.step__evidence')).toContainText('How do we know?');
    await expect(page.getByText('0 of 7 steps done.')).toBeVisible();

    await steps.nth(0).getByRole('checkbox').check();
    await steps.nth(2).getByRole('checkbox').check();
    await expect(page.getByText('2 of 7 steps done.')).toBeVisible();
    await expect(steps.nth(0)).toHaveAttribute('data-done', 'true');

    await page.reload();
    await expect(page.getByText('2 of 7 steps done.')).toBeVisible();
    await page.getByRole('button', { name: 'Reset progress' }).click();
    await expect(page.getByText('0 of 7 steps done.')).toBeVisible();
    await noHorizontalScroll(page);
    await noSeriousA11yViolations(page);
    expect(errors).toEqual([]);
  });

  test('the quiz scores answers on the client and explains and cites every answer', async ({ page }) => {
    await page.goto(PATH);
    const quiz = page.locator('.quiz');
    const qs = quiz.locator('fieldset.quiz__q');
    await expect(qs).toHaveCount(5);

    // Checking without a choice asks for one.
    await qs.nth(0).getByRole('button', { name: 'Check answer' }).click();
    await expect(qs.nth(0)).toContainText('Choose an answer first.');

    await qs.nth(0).getByRole('radio', { name: 'Major Rock Edict XIII' }).check();
    await qs.nth(0).getByRole('button', { name: 'Check answer' }).click();
    await expect(qs.nth(0)).toContainText('Correct.');
    await expect(qs.nth(0)).toContainText('Your answer: correct');
    await expect(qs.nth(0).locator('.quiz__sources li').first()).toContainText('Hultzsch');
    await expect(qs.nth(0).getByRole('radio').first()).toBeDisabled();

    await qs.nth(1).getByRole('radio', { name: /Egyptian hieroglyphs/ }).check();
    await qs.nth(1).getByRole('button', { name: 'Check answer' }).click();
    await expect(qs.nth(1)).toContainText('Not quite.');
    await expect(qs.nth(1)).toContainText('About your answer:');
    await expect(qs.nth(1)).toContainText('Correct answer');
    await expect(quiz.locator('.quiz__score')).toHaveText('1 of 2 checked answers correct so far; 3 to go.');

    const correct = ['Sandrokottos', /Shakyamuni was born there/, /tied to Greek kings/];
    for (let i = 2; i < 5; i++) {
      await qs.nth(i).getByRole('radio', { name: correct[i - 2] }).check();
      await qs.nth(i).getByRole('button', { name: 'Check answer' }).click();
    }
    await expect(quiz.locator('.quiz__score')).toHaveText('You answered 4 of 5 correctly.');
    await noSeriousA11yViolations(page);

    await page.getByRole('button', { name: 'Start the quiz again' }).click();
    await expect(quiz.locator('.quiz__score')).toHaveText('5 questions. Choose an answer, then check it.');
    await expect(qs.nth(0).getByRole('radio').first()).toBeEnabled();
    await expect(qs.nth(0).getByRole('radio').first()).not.toBeChecked();
  });

  test('keyboard users can answer a question', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard flow is a desktop concern');
    await page.goto(PATH);
    const q = page.locator('fieldset.quiz__q').nth(2);
    await q.getByRole('radio').first().focus();
    await page.keyboard.press('Space');
    await expect(q.getByRole('radio').first()).toBeChecked();
    await q.getByRole('button', { name: 'Check answer' }).focus();
    await page.keyboard.press('Enter');
    await expect(q).toContainText('Correct.');
  });
});

test.describe('printable pack', () => {
  test('renders the pack with the answer key on its own printed page', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(`${PATH}/print`);
    await expect(page.locator('h1')).toHaveText('How do we know when Ashoka lived?');
    await expect(page.locator('.print-card')).toHaveCount(7);
    await expect(page.locator('.print-quiz > li')).toHaveCount(5);
    await expect(page.locator('.answer-key > li')).toHaveCount(5);
    await expect(page.locator('.answer-key > li').first()).toContainText('B. Major Rock Edict XIII');
    await expect(page.getByRole('button', { name: 'Print this pack' })).toBeVisible();
    await noHorizontalScroll(page);
    await noSeriousA11yViolations(page);

    await page.emulateMedia({ media: 'print' });
    await expect(page.locator('.site-header')).toBeHidden();
    await expect(page.locator('.site-footer')).toBeHidden();
    await expect(page.locator('.print-toolbar')).toBeHidden();
    await expect(page.locator('.draft-notice')).toBeVisible();
    expect(await page.locator('.print-break').evaluate((el) => getComputedStyle(el).breakBefore)).toBe('page');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(255, 255, 255)');
    expect(errors).toEqual([]);
  });

  test('prints in light colours even in dark mode', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark', media: 'print' });
    await page.goto(`${PATH}/print`);
    const ink = await page.locator('h1').evaluate((el) => getComputedStyle(el).color);
    expect(ink).toBe('rgb(0, 0, 0)');
  });
});
