import fs from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { KC_ITEMS_URL } from '../src/lib/content/public-data';

/**
 * Visual regression of the Kaalchakra Map view, in the style of the Wheel and River snapshots.
 * The items come from a fixed fixture (47 placed archive entries, plus one clearly labelled test extent) rather
 * than the live archive, so a snapshot changes only when rendering changes, not when content is added.
 * Snapshots are per platform (font rasterisation differs); refresh them with
 * `npx playwright test e2e/map-visual.spec.ts --update-snapshots` on macOS, and in the Playwright Linux image for CI.
 */
const FIXTURE = fs.readFileSync(path.join(__dirname, 'fixtures', 'kaalchakra-map.json'), 'utf8');

const SNAPSHOT = { animations: 'disabled', caret: 'hide', scale: 'css', maxDiffPixelRatio: 0.002 } as const;

async function openMap(page: Page, query: string, entries: number) {
  await page.route(`**${KC_ITEMS_URL}`, (route) => route.fulfill({ contentType: 'application/json', body: FIXTURE }));
  await page.goto(`/kaalchakra?view=map${query}`);
  const svg = page.locator('.kc-map-svg');
  await expect(svg).toBeVisible();
  await expect(page.getByTestId('map-status')).toContainText(`${entries} ${entries === 1 ? 'entry' : 'entries'} on the map`);
  // The canvas is sized to its container after the first layout; wait until the drawing matches the box.
  await expect.poll(() => svg.evaluate((el) => Math.abs(el.getBoundingClientRect().width - Number(el.getAttribute('width'))) < 1)).toBe(true);
  await page.evaluate(() => document.fonts.ready);
  // The sticky header would otherwise be drawn over the top of the element when the screenshot scrolls to it.
  await page.addStyleTag({ content: '.site-header { position: static !important; }' });
  // Keep the pointer off the markers so no tooltip or hover glow is drawn.
  await page.mouse.move(0, 0);
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} scheme`, () => {
    test.use({ colorScheme });

    test('map, all time', async ({ page, isMobile }) => {
      test.skip(isMobile && colorScheme === 'dark', 'the dark scheme is covered on desktop');
      await openMap(page, '', 47);
      await expect(page.locator('.kc-stage')).toHaveScreenshot(`map-${colorScheme}.png`, SNAPSHOT);
    });
  });
}

test('map, a moment with a selection and an extent', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the selection and extent drawing is the same on mobile');
  await openMap(page, '&t=-268&zoom=millennium&region=ganga&id=artifact.ashoka-major-rock-edict-xiii', 16);
  await expect(page.locator('.kc-map-extent')).toHaveCount(1);
  await expect(page.locator('.kc-stage')).toHaveScreenshot('map-moment.png', SNAPSHOT);
});

test('map, traditional reckoning', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the tradition markers are the same on mobile');
  await openMap(page, '&lens=tradition', 13);
  await expect(page.locator('.kc-stage')).toHaveScreenshot('map-tradition.png', SNAPSHOT);
});

test('map, keyboard focus on a marker', async ({ page, isMobile }) => {
  test.skip(isMobile, 'keyboard focus is a desktop concern');
  await openMap(page, '&region=northwest', 47);
  await page.locator('.kc-map-svg .kc-mark').first().focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(page.locator('.kc-map-svg .kc-mark:focus-visible')).toHaveCount(1);
  await expect(page.locator('.kc-map-frame')).toHaveScreenshot('map-focus.png', SNAPSHOT);
});
