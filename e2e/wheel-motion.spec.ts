import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/*
 * The wheel's motion: every way of choosing a moment spins it until the selection rests under the fixed
 * indicator at the top. Angles are measured from the rendered page, so these tests hold the real geometry.
 */

const ASHOKA = 'person.ashoka';
const KALI_YUGA = 'cosmology.kali-yuga';
const DHABA = 'site.dhaba';
const JWALAPURAM = 'site.jwalapuram';

async function openWheel(page: Page, query = '') {
  await page.goto(`/kaalchakra${query}`);
  await expect(page.locator('.kc-toolbar:not(.kc-skeleton)')).toBeVisible();
  await expect(page.locator('.kc-canvas .kc-wheel')).toBeVisible();
}

/** Angle in degrees, clockwise from 3 o'clock, of the selected mark's anchor about the wheel centre. */
async function selectedAngle(page: Page): Promise<number> {
  return page.evaluate(() => {
    const wheel = document.querySelector('.kc-canvas .kc-wheel')!.getBoundingClientRect();
    const hit = document.querySelector('.kc-canvas .kc-mark[data-active="true"] circle[fill="transparent"]');
    if (!hit) throw new Error('no selected mark');
    const r = hit.getBoundingClientRect();
    const dx = r.left + r.width / 2 - (wheel.left + wheel.width / 2);
    const dy = r.top + r.height / 2 - (wheel.top + wheel.height / 2);
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  });
}

/** Waits until the wheel has stopped moving. */
async function settled(page: Page) {
  await expect(page.locator('.kc-wheel__rotor')).not.toHaveAttribute('data-spinning', /.*/, { timeout: 5000 });
}

/** The selected mark sits under the indicator, at 12 o'clock (-90 degrees). */
async function expectAtIndicator(page: Page) {
  await settled(page);
  await expect.poll(() => selectedAngle(page)).toBeCloseTo(-90, 0);
}

/**
 * Records the rotor's transform on every animation frame until `act` has run and the wheel has settled.
 * Returns the distinct angles seen, in order.
 */
async function recordSpin(page: Page, act: () => Promise<unknown>): Promise<number[]> {
  await page.evaluate(() => {
    const w = window as unknown as { __spin: number[]; __spinOn: boolean; __spinSample: () => void };
    const rotor = document.querySelector<SVGSVGElement>('.kc-wheel__rotor')!;
    w.__spin = [];
    w.__spinOn = true;
    w.__spinSample = () => {
      const m = /rotate\((-?[\d.]+)deg\)/.exec(rotor.style.transform);
      const a = m ? Number(m[1]) : 0;
      if (w.__spin[w.__spin.length - 1] !== a) w.__spin.push(a);
    };
    const tick = () => {
      w.__spinSample();
      if (w.__spinOn) requestAnimationFrame(tick);
    };
    // The start and end are sampled directly, so a loaded engine that skips frames still reports both.
    w.__spinSample();
    requestAnimationFrame(tick);
  });
  await act();
  await page.waitForTimeout(150);
  await settled(page);
  return page.evaluate(() => {
    const w = window as unknown as { __spin: number[]; __spinOn: boolean; __spinSample: () => void };
    w.__spinOn = false;
    w.__spinSample();
    return w.__spin;
  });
}

function selectedId(page: Page): string | null {
  return new URL(page.url()).searchParams.get('id');
}

test.describe('wheel motion', () => {
  test('clicking a mark spins it to the indicator, the short way round', async ({ page }) => {
    await openWheel(page, `?id=${ASHOKA}`);
    await expectAtIndicator(page);
    const mark = page.locator('.kc-canvas .kc-mark circle[fill="transparent"]').nth(40);
    const angles = await recordSpin(page, () => mark.click({ force: true }));
    await expect(page).not.toHaveURL(new RegExp(`id=${ASHOKA}`));
    await expectAtIndicator(page);
    // It animated through intermediate angles and turned less than half a circle. A jump shows only the start
    // and end angles; how many frames fall in between depends on the engine's frame rate under load.
    expect(angles.length).toBeGreaterThan(2);
    expect(Math.abs(angles[angles.length - 1] - angles[0])).toBeLessThanOrEqual(180.5);
  });

  test('tapping an era away from any mark selects the nearest entry in that era', async ({ page }) => {
    await openWheel(page);
    const era = page.locator('.kc-wheel__era[data-era="classical"]');
    await era.click({ position: await eraPoint(page, 'classical'), force: true });
    await expect(page).toHaveURL(/[?&]id=/);
    await expectAtIndicator(page);
  });

  test('keyboard arrows, Home and End spin with the same animation', async ({ page, isMobile }) => {
    test.skip(isMobile, 'hardware keyboard');
    await openWheel(page, `?id=${ASHOKA}`);
    await page.locator('.kc-canvas').focus();
    const step = await recordSpin(page, () => page.keyboard.press('ArrowRight'));
    expect(step.length).toBeGreaterThan(2);
    await expectAtIndicator(page);
    await expect(page).not.toHaveURL(new RegExp(`id=${ASHOKA}`));

    await page.keyboard.press('End');
    await expectAtIndicator(page);
    const last = await page.locator('.kc-panel h2').textContent();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.kc-panel h2')).toHaveText(last!);

    await page.keyboard.press('Home');
    await expectAtIndicator(page);
    const first = await page.locator('.kc-panel h2').textContent();
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.kc-panel h2')).toHaveText(first!);
    await expect(page.locator('.kc-canvas')).toBeFocused();
  });

  test('dragging spins the wheel and it snaps to the entry nearest the indicator', async ({ page }) => {
    await openWheel(page, `?id=${ASHOKA}`);
    await expectAtIndicator(page);
    await centreWheel(page);
    const box = (await page.locator('.kc-canvas .kc-wheel').boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const r = box.width * 0.36;
    const at = (deg: number) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)] as const;
    await page.mouse.move(...at(-60));
    await page.mouse.down();
    for (let d = -60; d <= 20; d += 8) await page.mouse.move(...at(d), { steps: 2 });
    await page.mouse.up();
    await expect(page).not.toHaveURL(new RegExp(`id=${ASHOKA}`));
    await expectAtIndicator(page);
  });

  test('a drag that snaps to another entry of the same year still returns the wheel to the indicator', async ({ page, isMobile }) => {
    // Dhaba and Jwalapuram share an anchor year and Dhaba comes first, so a release with both under the indicator picks Dhaba.
    await openWheel(page, `?id=${JWALAPURAM}`);
    await expectAtIndicator(page);
    await centreWheel(page);
    const box = (await page.locator('.kc-canvas .kc-wheel').boundingBox())!;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const r = box.width * 0.36;
    const at = (deg: number) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)] as const;
    await page.mouse.move(...at(-60));
    await page.mouse.down();
    for (let d = -60; d <= -30; d += 6) await page.mouse.move(...at(d), { steps: 2 });
    await expect(page.locator('.kc-wheel__rotor')).toHaveAttribute('data-spinning', '');
    for (let d = -30; d >= -60; d -= 6) await page.mouse.move(...at(d), { steps: 2 });
    await page.waitForTimeout(200);
    await page.mouse.up();
    await expect(page).toHaveURL(new RegExp(`id=${DHABA}`));
    await expectAtIndicator(page);

    if (isMobile) return;
    await page.locator('.kc-canvas').focus();
    const step = await recordSpin(page, () => page.keyboard.press('ArrowRight'));
    await expect(page).toHaveURL(new RegExp(`id=${JWALAPURAM}`));
    await expectAtIndicator(page);
    expect(Math.abs(step[step.length - 1] - step[0])).toBeLessThanOrEqual(180.5);
  });

  test('a touch swipe on the wheel spins it, and one beside the wheel scrolls the page', async ({ page, isMobile, browserName }) => {
    test.skip(!isMobile || browserName !== 'chromium', 'touch input is driven through the Chromium DevTools protocol');
    await openWheel(page, `?id=${ASHOKA}`);
    await expectAtIndicator(page);
    const box = (await page.locator('.kc-canvas .kc-wheel').boundingBox())!;
    const cdp = await page.context().newCDPSession(page);
    const swipe = async (x0: number, y0: number, x1: number, y1: number) => {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
      for (let i = 1; i <= 12; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + ((x1 - x0) * i) / 12, y: y0 + ((y1 - y0) * i) / 12 }] });
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const cx = box.x + box.width / 2;
    const top = box.y + box.height * 0.2;
    await swipe(cx - box.width * 0.2, top, cx + box.width * 0.2, top);
    await expect(page).not.toHaveURL(new RegExp(`id=${ASHOKA}`));
    await expectAtIndicator(page);

    // Below the wheel, the scale note: a vertical swipe there scrolls the page.
    const y0 = await page.evaluate(() => window.scrollY);
    const note = (await page.locator('.kc-scale-note').boundingBox())!;
    await swipe(note.x + note.width / 2, note.y + note.height / 2, note.x + note.width / 2, note.y + note.height / 2 - 200);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(y0);
  });

  test('scroll over the wheel scrolls the page, until the wheel has focus', async ({ page, isMobile }) => {
    test.skip(isMobile, 'mouse wheel');
    await page.setViewportSize({ width: 1280, height: 700 });
    await page.clock.install();
    await openWheel(page, `?id=${ASHOKA}`);
    await centreWheel(page);
    const box = (await page.locator('.kc-canvas .kc-wheel').boundingBox())!;
    const y0 = await page.evaluate(() => window.scrollY);
    // A pointer passing over the wheel: the page clock stands still, so it never rests long enough to turn the
    // wheel, however slowly the browser delivers the scroll (WebKit can take over a second under load).
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.3);
    await page.mouse.wheel(0, 120);
    // The whole 120 px reaches the page. Waiting for all of it also waits out WebKit's animated scroll on Linux.
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeCloseTo(y0 + 120, 0);
    expect(selectedId(page)).toBe(ASHOKA);
    await page.clock.resume();

    await page.locator('.kc-canvas').focus();
    const y1 = await page.evaluate(() => window.scrollY);
    const now = await page.locator('.kc-wheel').boundingBox();
    await page.mouse.move(now!.x + now!.width / 2, now!.y + now!.height * 0.3);
    await page.mouse.wheel(0, 120);
    await expect(page).not.toHaveURL(new RegExp(`id=${ASHOKA}`));
    expect(await page.evaluate(() => window.scrollY)).toBe(y1);
    await expectAtIndicator(page);
  });

  test('Back and Forward animate to the restored selection', async ({ page, isMobile }) => {
    test.skip(isMobile, 'hardware keyboard');
    await openWheel(page, `?id=${ASHOKA}`);
    await page.locator('.kc-canvas').focus();
    await page.keyboard.press('End');
    await expect(page).not.toHaveURL(new RegExp(`id=${ASHOKA}`));
    const later = selectedId(page);
    await settled(page);

    const back = await recordSpin(page, () => page.goBack());
    await expect(page).toHaveURL(new RegExp(`id=${ASHOKA}`));
    // An animation, not a jump (a jump shows at most the start and end angles); headless engines vary in frame rate.
    expect(back.length).toBeGreaterThan(2);
    await expectAtIndicator(page);
    await expect(page.locator('.kc-panel h2')).toHaveText('Ashoka');

    const fwd = await recordSpin(page, () => page.goForward());
    expect(selectedId(page)).toBe(later);
    expect(fwd.length).toBeGreaterThan(2);
    await expectAtIndicator(page);
  });

  test('a t= link selects the entry nearest that year', async ({ page }) => {
    await openWheel(page, '?t=-267');
    await expect(page.locator('.kc-panel h2')).not.toHaveText('One wheel, two lenses');
    await expectAtIndicator(page);
    await expect(page).toHaveURL(/[?&]id=/);
  });

  test('the selection is announced once, when the spin ends', async ({ page, isMobile }) => {
    test.skip(isMobile, 'hardware keyboard');
    await openWheel(page, `?id=${ASHOKA}`);
    await settled(page);
    await page.evaluate(() => {
      const w = window as unknown as { __said: { text: string; spinning: boolean }[] };
      const live = document.querySelector('.kc [aria-live="polite"]')!;
      const rotor = document.querySelector('.kc-wheel__rotor')!;
      w.__said = [];
      new MutationObserver(() => w.__said.push({ text: live.textContent ?? '', spinning: rotor.hasAttribute('data-spinning') })).observe(live, { childList: true, characterData: true, subtree: true });
    });
    await page.locator('.kc-canvas').focus();
    await page.keyboard.press('End');
    await settled(page);
    await page.waitForTimeout(300);
    const said = await page.evaluate(() => (window as unknown as { __said: { text: string; spinning: boolean }[] }).__said);
    expect(said).toHaveLength(1);
    expect(said[0].spinning).toBe(false);
    expect(said[0].text).toContain(await page.locator('.kc-panel h2').textContent());
  });

  test('the hub always shows the whole Tradition tag, down to 320 px', async ({ page }) => {
    for (const width of [320, 360, 768, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await openWheel(page, `?id=${KALI_YUGA}`);
      const tag = page.locator('.kc-hub__tag:visible');
      await expect(tag).toHaveCount(1);
      await expect(tag.locator('text')).toHaveText('Tradition');
      const fits = await page.evaluate(() => {
        const shown = [...document.querySelectorAll('.kc-hub__tag')].find((g) => g.getBoundingClientRect().width > 0)!;
        const pill = shown.querySelector('rect')!.getBoundingClientRect();
        const word = shown.querySelector('text')!.getBoundingClientRect();
        const hub = document.querySelector('.kc-wheel__overlay circle[r="136"]')!.getBoundingClientRect();
        return word.left >= pill.left && word.right <= pill.right && pill.left >= hub.left && pill.right <= hub.right;
      });
      expect(fits, `${width} px`).toBe(true);
    }
  });

  test('with nothing selected the hub names the wheel at every size', async ({ page }) => {
    for (const width of [320, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await openWheel(page);
      await expect(page.locator('.kc-canvas .kc-hub:visible text').first()).toHaveText('Kaalchakra');
    }
  });

  test('no horizontal overflow at 320 and 360 px', async ({ page }) => {
    for (const width of [320, 360]) {
      await page.setViewportSize({ width, height: 780 });
      for (const q of ['', `?id=${KALI_YUGA}`, '?view=river', '?view=list']) {
        await openWheelOrView(page, q);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, `${width} px ${q}`).toBeLessThanOrEqual(0);
      }
    }
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`the spun wheel is axe clean in ${colorScheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await openWheel(page, `?id=${KALI_YUGA}`);
      await settled(page);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(serious.map((v) => `${v.id}: ${v.help} e.g. ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
    });
  }

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('a new selection jumps without spinning', async ({ page, isMobile }) => {
      test.skip(isMobile, 'hardware keyboard');
      await openWheel(page, `?view=wheel&id=${ASHOKA}`);
      await page.locator('.kc-canvas').focus();
      const angles = await recordSpin(page, () => page.keyboard.press('End'));
      // The starting angle and the final one, and nothing in between.
      expect(angles.length).toBeLessThanOrEqual(2);
      await expect(page.locator('.kc-wheel__rotor')).not.toHaveAttribute('data-spinning', /.*/);
      await expectAtIndicator(page);
    });

    test('the Kaalchakra link adds one history entry, so Back and Forward each take one press', async ({ page }) => {
      await page.goto(`/kaalchakra?view=list&id=${ASHOKA}`);
      await expect(page.locator('.kc-panel h2')).toHaveText('Ashoka');
      const entries = await page.evaluate(() => window.history.length);
      await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Kaalchakra' }).click();
      // The link opens /kaalchakra; its canonical form for this reader names the List view, in place. The soft
      // navigation first downloads the page's RSC payload, which carries the prerendered wheel (about 0.6 MB), and in
      // Firefox on a loaded machine that alone took over 5 s, so this wait allows for it.
      await expect(page).toHaveURL(/\/kaalchakra\?view=list$/, { timeout: 15_000 });
      await page.waitForTimeout(400);
      expect(await page.evaluate(() => window.history.length)).toBe(entries + 1);

      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`/kaalchakra\\?view=list&id=${ASHOKA.replace('.', '\\.')}$`));
      await expect(page.locator('.kc-panel h2')).toHaveText('Ashoka');
      await page.waitForTimeout(400);
      await page.goForward();
      await expect(page).toHaveURL(/\/kaalchakra\?view=list$/);
      await page.waitForTimeout(400);
      expect(await page.evaluate(() => window.history.length)).toBe(entries + 1);
      await page.goBack();
      await expect(page).toHaveURL(new RegExp(`id=${ASHOKA.replace('.', '\\.')}$`));
    });
  });
});

/** Scrolls the wheel to the middle of the viewport, clear of the sticky header. */
async function centreWheel(page: Page) {
  await page.evaluate(() => document.querySelector('.kc-canvas .kc-wheel')!.scrollIntoView({ block: 'center', behavior: 'instant' }));
}

async function openWheelOrView(page: Page, q: string) {
  await page.goto(`/kaalchakra${q}`);
  await expect(page.locator('.kc-toolbar:not(.kc-skeleton)')).toBeVisible();
}

/** A point inside an era sector, near its outer edge and between marks, relative to the sector's bounding box. */
async function eraPoint(page: Page, era: string): Promise<{ x: number; y: number }> {
  await centreWheel(page);
  return page.evaluate((id) => {
    const path = document.querySelector<SVGPathElement>(`.kc-wheel__era[data-era="${id}"]`)!;
    const box = path.getBoundingClientRect();
    // The rotor is turned, so its own box is larger than the wheel; measure the still container.
    const wheel = path.closest('.kc-wheel')!.getBoundingClientRect();
    const scale = wheel.width / 1000;
    const cx = wheel.left + wheel.width / 2;
    const cy = wheel.top + wheel.height / 2;
    // Walk the sector's middle radius ring and pick the first point that hits the sector itself.
    for (const r of [425, 400, 300, 200]) {
      for (let a = -Math.PI; a < Math.PI; a += 0.01) {
        const x = cx + Math.cos(a) * r * scale;
        const y = cy + Math.sin(a) * r * scale;
        if (y > 0 && y < window.innerHeight && document.elementFromPoint(x, y) === path) return { x: x - box.left, y: y - box.top };
      }
    }
    throw new Error(`no free point in era ${id}`);
  }, era);
}
