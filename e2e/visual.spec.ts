import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { KC_ITEMS_URL } from '../src/lib/content/public-data';

/**
 * Visual regression of the Kaalchakra views. The items come from a fixed fixture rather than the live archive,
 * so a snapshot changes only when rendering changes, not when content is added.
 * Snapshots are per platform (font rasterisation differs); refresh them with `npx playwright test e2e/visual.spec.ts --update-snapshots=all`
 * on macOS, and in the Playwright Linux image for CI (see README).
 */
const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures', 'kaalchakra.json'), 'utf8');

async function openWithFixture(page: Page, query: string) {
  await page.route(`**${KC_ITEMS_URL}`, (route) => route.fulfill({ contentType: 'application/json', body: FIXTURE }));
  await page.goto(`/kaalchakra${query}`);
  await expect(page.locator('.kc-toolbar:not(.kc-skeleton)')).toBeVisible();
  await expect(page.locator('.kc-panel')).toContainText('39 entries currently shown');
  await page.evaluate(() => document.fonts.ready);
  // The sticky header would otherwise be drawn over the top of the element when the screenshot scrolls to it.
  await page.addStyleTag({ content: '.site-header { position: static !important; }' });
  // Keep the pointer off the marks so no tooltip or hover glow is drawn.
  await page.mouse.move(0, 0);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} scheme`, () => {
    test.use({ colorScheme });
    // Each engine rasterises text its own way; one baseline per Chromium project keeps the set reviewable.
    test.skip(({ browserName }) => browserName !== 'chromium', 'visual baselines are kept for Chromium');

    test('wheel', async ({ page, isMobile }) => {
      test.skip(isMobile && colorScheme === 'dark', 'the dark scheme is covered on desktop');
      await openWithFixture(page, '?view=wheel');
      await expect(page.locator('.kc-stage')).toHaveScreenshot(`wheel-${colorScheme}.png`);
    });

    test('river', async ({ page, isMobile }) => {
      test.skip(isMobile && colorScheme === 'dark', 'the dark scheme is covered on desktop');
      await openWithFixture(page, '?view=river');
      await expect(page.locator('.kc-stage')).toHaveScreenshot(`river-${colorScheme}.png`);
    });
  });
}
