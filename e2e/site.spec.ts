import { createHash } from 'node:crypto';
import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { formatCount } from '../src/lib/content/open-data';

/** Stable pages, also measured by Lighthouse CI (lighthouserc.js). */
const ENTITY = '/archive/artifact/ashoka-major-rock-edict-xiii';
const ARTICLE_WITH_TABLE = '/music/the-72-melakartas';

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

/** Collects uncaught errors and console errors; assert on the array at the end of a test. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return errors;
}

/** Opens the Kaalchakra and waits until the interactive views (not the server fallback) are on screen. */
async function openKaalchakra(page: Page, query = '') {
  await page.goto(`/kaalchakra${query}`);
  await expect(page.locator('.kc-toolbar')).toBeVisible();
}

/** On a phone the text filter and kind chips sit behind the Filters button; elsewhere it is hidden and they always show. */
async function showFilters(page: Page) {
  const toggle = page.locator('.kc-filters-toggle');
  if ((await toggle.isVisible()) && (await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
}

function viewButton(page: Page, name: 'Wheel' | 'River' | 'List') {
  return page.getByRole('group', { name: 'View' }).getByRole('button', { name, exact: true });
}

function lensButton(page: Page, name: 'Both lenses' | 'Scholarship' | 'Tradition') {
  return page.getByRole('group', { name: 'Lens' }).getByRole('button', { name, exact: true });
}

async function listCount(page: Page): Promise<number> {
  await expect(page.locator('.kc-list')).toBeVisible();
  return page.locator('.kc-list li').count();
}

/** The address bar follows the state after a short debounce. */
async function settledUrl(page: Page, pattern: RegExp): Promise<URL> {
  await expect(page).toHaveURL(pattern);
  return new URL(page.url());
}

// Every route type, in both colour schemes; the desktop and mobile projects double this.
const ROUTES: { name: string; path: string; ready?: string }[] = [
  { name: 'home', path: '/' },
  { name: 'kaalchakra wheel', path: '/kaalchakra', ready: '.kc-wheel' },
  { name: 'kaalchakra wheel spun to a tradition entry', path: '/kaalchakra?id=cosmology.kali-yuga', ready: '.kc-hub__tag:visible' },
  { name: 'kaalchakra river', path: '/kaalchakra?view=river', ready: '.kc-river' },
  { name: 'kaalchakra list', path: '/kaalchakra?view=list', ready: '.kc-list' },
  { name: 'kaalchakra selection', path: `/kaalchakra?view=list&id=artifact.ashoka-major-rock-edict-xiii`, ready: '.kc-panel .dating' },
  { name: 'entity', path: ENTITY, ready: '.dating' },
  { name: 'article with a table', path: ARTICLE_WITH_TABLE, ready: '.article-content table' },
  { name: 'category', path: '/history', ready: 'a.card' },
  { name: 'archive', path: '/archive', ready: 'a.card' },
  { name: 'sources', path: '/sources' },
  { name: 'corrections', path: '/corrections' },
  { name: 'methodology', path: '/methodology' },
  { name: 'open data', path: '/data', ready: '.data-file' },
  { name: 'search', path: '/search' },
  { name: 'search results', path: '/search?q=Harappa', ready: '.search-result' },
  { name: 'not found', path: '/no-such-page' },
];

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme}: pages render, are accessible and fit the viewport`, () => {
    test.use({ colorScheme });
    for (const r of ROUTES) {
      test(r.name, async ({ page }) => {
        // A full-page axe scan scales with DOM size; /corrections and /sources list the whole corpus
        // and exceed the default 30s budget under parallel load.
        test.slow();
        const errors = collectErrors(page);
        const res = await page.goto(r.path);
        expect(res?.status()).toBe(r.name === 'not found' ? 404 : 200);
        await expect(page.locator('h1').first()).toBeVisible();
        await expect(page.locator('.draft-notice')).toContainText('awaiting human editorial review');
        if (r.ready) await expect(page.locator(r.ready).first()).toBeVisible();
        await noHorizontalScroll(page);
        await noSeriousA11yViolations(page);
        // The browser logs the 404 document itself as a failed resource.
        expect(errors.filter((e) => !(r.name === 'not found' && e.includes('404')))).toEqual([]);
      });
    }
  });
}

test.describe('content pages', () => {
  test('entity page shows datings with grades and sources, and its place in time', async ({ page }) => {
    const href = await firstEntityHref(page);
    await page.goto(href);
    await expect(page.getByRole('heading', { name: 'When, and how we know' })).toBeVisible();
    await expect(page.locator('.dating').first()).toBeVisible();
    await expect(page.locator('.dating__sources li').first()).toBeVisible();
    await expect(page.locator('.kc-strip')).toBeVisible();
  });

  test('a tradition-only entity is marked as tradition in its Kaalchakra strip, among traditional neighbours', async ({ page }) => {
    await page.goto('/archive/cosmology/kali-yuga');
    await expect(page.locator('.kc-strip__head')).toContainText('(tradition)');
    await page.goto('/archive/cosmology/kalpa');
    const strip = page.locator('.kc-strip');
    await expect(strip.locator('.kc-strip__head')).toContainText('(tradition)');
    await expect(strip.locator('a[href="/archive/event/indian-plate-asia-collision"]')).toHaveCount(0);
    await expect(strip.locator('a[href="/archive/concept/siwalik-fossil-record"]')).toHaveCount(0);
    expect(await strip.locator('.kc-strip__nb a[href^="/archive/cosmology/"]').count()).toBeGreaterThan(0);
    await noHorizontalScroll(page);
    await noSeriousA11yViolations(page);
  });

  test('article tables render as tables', async ({ page }) => {
    await page.goto(ARTICLE_WITH_TABLE);
    await expect(page.locator('.article-content table th').first()).toBeVisible();
    await expect(page.locator('.article-content')).not.toContainText('| ---');
  });

  test('article header shows every dating with its sources', async ({ page }) => {
    await page.goto('/philosophy/mandukya-upanishad');
    const datings = page.locator('.article-header .dating');
    await expect(datings).toHaveCount(2);
    await expect(page.locator('.article-header .dating--tradition')).toContainText('Vedanta sampradaya');
    const flood = page.locator('.article-header .dating__sources a[href="https://doi.org/10.1111/b.9780631215356.2005.00005.x"]');
    await expect(flood).toBeVisible();
    await expect(flood).toContainText('The Blackwell Companion to Hinduism');
    // Two sources cited in the text and one cited only for a dating: all three are numbered references.
    // The labelled aside is matched by its attributes, not getByRole('complementary'): in Playwright's Firefox a named
    // role query that resolves an aria-labelledby name, before or after an axe scan, crashes the page (docs/testing/firefox-axe-crash.md).
    await expect(page.locator('aside.evidence-summary[aria-labelledby="evidence-summary-title"]').getByRole('link', { name: '3 references' })).toBeVisible();
    await expect(page.locator('#evidence-summary-title')).toHaveText('Evidence at a glance');
    await expect(page.locator('.references ol > li')).toHaveCount(3);
    await noHorizontalScroll(page);
    await noSeriousA11yViolations(page);
  });

  test('article page renders numbered citations, references and share links', async ({ page }) => {
    await page.goto('/history');
    await page.locator('a.card').first().click();
    await expect(page.locator('sup.cite a').first()).toBeVisible();
    expect(await page.locator('.references li').count()).toBeGreaterThan(0);
    const share = page.locator('.share-buttons');
    await expect(share.getByRole('link', { name: 'Share on WhatsApp' })).toHaveAttribute('href', /^https:\/\/wa\.me\/\?text=/);
    await expect(share.getByRole('link', { name: 'Share on X' })).toHaveAttribute('target', '_blank');
    await expect(share.getByRole('button', { name: 'Copy link' })).toBeVisible();
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`share links take a visible focus ring and keep their brand discs in the ${colorScheme} theme`, async ({ page, browserName }) => {
      test.skip(browserName === 'webkit', 'WebKit does not Tab to links by default');
      await page.emulateMedia({ colorScheme });
      await page.goto(ARTICLE_WITH_TABLE);
      const x = page.locator('.share-buttons').getByRole('link', { name: 'Share on X' });
      await x.scrollIntoViewIfNeeded();
      // Keyboard focus, so :focus-visible applies: Tab from the link before it.
      await page.locator('.share-buttons').getByRole('link', { name: 'Share on Facebook' }).focus();
      await page.keyboard.press('Tab');
      await expect(x).toBeFocused();
      const ring = await x.evaluate((el) => {
        const cs = getComputedStyle(el);
        return { style: cs.outlineStyle, width: cs.outlineWidth, color: cs.outlineColor, focus: getComputedStyle(document.documentElement).getPropertyValue('--focus').trim() };
      });
      expect(ring.style).toBe('solid');
      expect(ring.width).toBe('2px');
      const hex = (rgb: string) => `#${(rgb.match(/\d+/g) ?? []).slice(0, 3).map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`;
      expect(hex(ring.color)).toBe(ring.focus);
      // X's mark is black on a light page and white on a dark one.
      const disc = await x.locator('.share-icon__disc').evaluate((el) => getComputedStyle(el).fill);
      expect(disc).toBe(colorScheme === 'light' ? 'rgb(0, 0, 0)' : 'rgb(255, 255, 255)');
    });
  }

  test('search finds entities and articles, and says so when nothing matches', async ({ page }) => {
    await page.goto('/search?q=Harappa');
    await expect(page.locator('.search-result').first()).toBeVisible();
    await expect(page.locator('.search-status')).toHaveText(/^\d+ results? for “Harappa”\.$/);
    await page.goto('/search?q=zzzzqqqq');
    await expect(page.locator('.search-status')).toContainText('0 results for');
  });

  test('the header search box opens results', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('searchbox', { name: 'Search the archive' }).fill('Ashoka');
    await page.getByRole('searchbox', { name: 'Search the archive' }).press('Enter');
    await expect(page).toHaveURL(/\/search\?q=Ashoka/);
    await expect(page.locator('.search-result').first()).toBeVisible();
  });
});

test.describe('navigation', () => {
  test('the main navigation reaches every section and marks the current one', async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Main' });

    await nav.getByRole('link', { name: 'Kaalchakra' }).click();
    await expect(page).toHaveURL(/\/kaalchakra$/);
    await expect(page.locator('h1')).toHaveText('The wheel of time');
    await expect(page.locator('.kc-toolbar')).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Kaalchakra' })).toHaveAttribute('aria-current', 'page');

    await nav.getByRole('link', { name: 'Archive' }).click();
    await expect(page).toHaveURL(/\/archive$/);
    await expect(nav.getByRole('link', { name: 'Archive' })).toHaveAttribute('aria-current', 'page');

    await nav.getByRole('link', { name: 'History' }).click();
    await expect(page).toHaveURL(/\/history$/);
    const article = page.locator('a.card').first();
    const title = (await article.locator('h2, h3').first().textContent())!.trim();
    await article.click();
    await expect(page.locator('h1')).toHaveText(title);
    // An article stays under its section in the navigation.
    await expect(nav.getByRole('link', { name: 'History' })).toHaveAttribute('aria-current', 'page');

    await page.goBack();
    await expect(page).toHaveURL(/\/history$/);
    await page.getByRole('link', { name: 'The Bharat Repo, home' }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(errors).toEqual([]);
  });

  test('every main navigation link is shown whole, on one row from a 768 px tablet up', async ({ page }) => {
    // On phone and touch projects this measures the touch sizes (44 px targets), on desktop ones the mouse sizes.
    for (const width of [768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      await page.evaluate(() => document.fonts.ready);
      const nav = page.getByRole('navigation', { name: 'Main' });
      await expect(nav.getByRole('link', { name: 'Debates' })).toBeVisible();
      const fit = await nav.evaluate((el) => {
        const links = [...el.querySelectorAll('a')];
        return { overflow: el.scrollWidth - el.clientWidth, rows: new Set(links.map((a) => Math.round(a.getBoundingClientRect().top))).size, links: links.length };
      });
      expect(fit, `at ${width} px`).toEqual({ overflow: 0, rows: 1, links: 11 });
    }
  });

  test('the footer links to the evidence pages', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    for (const [name, path] of [
      ['Methodology and evidence grades', '/methodology'],
      ['Bibliography', '/sources'],
      ['Corrections log', '/corrections'],
    ] as const) {
      await footer.getByRole('link', { name }).click();
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.locator('h1')).toBeVisible();
    }
  });

  test('the skip link moves focus to the main content', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'keyboard focus order is checked in Chromium');
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#main$/);
  });

  test('an entity page opens the Kaalchakra focused on it', async ({ page }) => {
    await page.goto(ENTITY);
    const name = (await page.locator('h1').textContent())!.trim();
    await page.locator('.kc-strip').getByRole('link', { name: 'Open in the Kaalchakra' }).click();
    await expect(page.locator('.kc-river')).toBeVisible();
    await expect(viewButton(page, 'River')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.kc-panel h2')).toHaveText(name);
    await expect(page.locator('.kc-river .kc-mark[data-active="true"]')).toHaveCount(1);
  });

  test('a record in the Kaalchakra links to its entity page', async ({ page }) => {
    await openKaalchakra(page, '?view=list');
    await page.locator('.kc-list button').first().click();
    const name = (await page.locator('.kc-panel h2').textContent())!.trim();
    await page.locator('.kc-panel .btn--primary').click();
    await expect(page).toHaveURL(/\/archive\//);
    await expect(page.locator('h1')).toHaveText(name);
  });
});

test.describe('Kaalchakra', () => {
  test('selecting a point opens its record and is reflected in the URL', async ({ page }) => {
    await openKaalchakra(page);
    // Click a mark's dedicated hit target: an arc's bounding-box centre can fall on the era sector beneath.
    const mark = page.locator('.kc-canvas .kc-wheel .kc-mark circle[fill="transparent"]').nth(5);
    await mark.click({ force: true });
    const heading = page.locator('.kc-panel h2');
    await expect(heading).not.toHaveText('One wheel, two lenses');
    await expect(page).toHaveURL(/[?&]id=/);
    await expect(page.locator('.kc-panel .dating').first()).toBeVisible();
  });

  test('list rows mark traditional reckonings in the default lens', async ({ page }) => {
    await page.goto('/kaalchakra?view=list&id=cosmology.kali-yuga');
    await expect(page.locator('.kc-list button[aria-current="true"] .kc-list__date')).toHaveText('3102 BCE to 2026 CE (tradition)');
    await page.goto('/kaalchakra?view=list&id=person.ashoka');
    await expect(page.locator('.kc-list button[aria-current="true"] .kc-list__date')).not.toContainText('(tradition)');
  });

  test('keyboard arrows step through entries in time order and Escape clears the selection', async ({ page }) => {
    await openKaalchakra(page);
    await page.locator('.kc-canvas').focus();
    await page.keyboard.press('ArrowRight');
    const first = await page.locator('.kc-panel h2').textContent();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.kc-panel h2')).not.toHaveText(first ?? '');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('.kc-panel h2')).toHaveText(first ?? '');
    await page.keyboard.press('Escape');
    await expect(page.locator('.kc-panel h2')).toHaveText('One wheel, two lenses');
  });

  test('on a phone the top of the wheel and its indicator are on the first screen', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the compact toolbar is for phones');
    for (const viewport of [
      { width: 360, height: 640 },
      { width: 390, height: 664 },
      { width: 412, height: 839 },
    ]) {
      await page.setViewportSize(viewport);
      await openKaalchakra(page);
      const pin = page.locator('.kc-wheel__indicator').first();
      await expect(pin).toBeVisible();
      const box = (await pin.boundingBox())!;
      expect(box.y + box.height, `${viewport.width} x ${viewport.height}`).toBeLessThan(viewport.height - 24);
      await noHorizontalScroll(page);
    }
  });

  test('on a phone the filters fold behind a Filters button that counts them', async ({ page, isMobile }) => {
    test.skip(!isMobile, 'the compact toolbar is for phones');
    await openKaalchakra(page, '?view=list');
    const toggle = page.getByRole('button', { name: /^Filters/ });
    const input = page.getByLabel('Filter entries');
    const kinds = page.getByRole('group', { name: 'Kinds of entry' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toHaveAccessibleName('Filters');
    await expect(input).toBeHidden();
    await expect(kinds).toBeHidden();
    // Every control in the toolbar is a 44 px target.
    for (const el of [toggle, page.getByLabel('Calendar'), page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'Wheel' }), page.getByRole('group', { name: 'Lens' }).getByRole('button', { name: 'Tradition' })]) {
      expect((await el.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await input.fill('Ashoka');
    await kinds.getByRole('button', { name: 'People' }).click();
    await expect(toggle).toHaveAccessibleName('Filters 2 active');
    await toggle.click();
    await expect(input).toBeHidden();
    // Folded away, the filters still apply, and the button still says how many are in force.
    await expect(toggle).toHaveAccessibleName('Filters 2 active');
    await expect(page.locator('.kc-list__kind', { hasText: /^People$/ })).toHaveCount(0);
    await noSeriousA11yViolations(page);
  });

  test('on a wide screen the filters are always shown and there is no Filters button', async ({ page, isMobile }) => {
    test.skip(isMobile, 'phones fold the filters');
    await openKaalchakra(page);
    await expect(page.getByLabel('Filter entries')).toBeVisible();
    await expect(page.getByRole('group', { name: 'Kinds of entry' })).toBeVisible();
    await expect(page.locator('.kc-filters-toggle')).toBeHidden();
  });

  test('filtering by text shows a definitive empty state', async ({ page }) => {
    await openKaalchakra(page, '?view=list');
    await showFilters(page);
    await page.getByLabel('Filter entries').fill('zzzzqqqq');
    await expect(page.getByText('0 entries match these filters.')).toBeVisible();
  });

  test('kind filters narrow every view and are reflected in the URL', async ({ page }) => {
    await openKaalchakra(page, '?view=list');
    const all = await listCount(page);
    await showFilters(page);
    const kinds = page.getByRole('group', { name: 'Kinds of entry' });
    await kinds.getByRole('button', { name: 'People' }).click();
    await expect(kinds.getByRole('button', { name: 'People' })).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => listCount(page)).toBeLessThan(all);
    await expect(page.locator('.kc-list__kind', { hasText: /^People$/ })).toHaveCount(0);
    const url = await settledUrl(page, /kinds=/);
    expect(url.searchParams.get('kinds')!.split(',')).not.toContain('person');
  });

  for (const colorScheme of ['light', 'dark'] as const) {
    test(`river labels at whole-axis zoom never cover a mark or each other in the ${colorScheme} theme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme });
      await openKaalchakra(page, '?view=river');
      await expect(page.locator('.kc-river .kc-river__label').first()).toBeVisible();
      // Measured from the rendered glyphs, so the layout's width estimate is checked against the real font.
      const clashes = await page.locator('.kc-river').evaluate((svg) => {
        const box = (el: SVGGraphicsElement) => {
          const b = el.getBBox();
          return { x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height, name: el.textContent ?? el.tagName };
        };
        const hit = (a: ReturnType<typeof box>, b: ReturnType<typeof box>) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
        const labels = [...svg.querySelectorAll<SVGTextElement>('.kc-river__label')].map(box);
        const shapes = [...svg.querySelectorAll<SVGGraphicsElement>('.kc-river__shape')].map(box);
        const out: string[] = [];
        labels.forEach((l, i) => {
          for (const m of labels.slice(i + 1)) if (hit(l, m)) out.push(`${l.name} overlaps label ${m.name}`);
          for (const m of shapes) if (hit(l, m)) out.push(`${l.name} covers a mark at x=${m.x0.toFixed(0)}`);
        });
        return out;
      });
      expect(clashes).toEqual([]);
    });
  }

  test.describe('zoom', () => {
    test('the zoom buttons narrow and widen the river window', async ({ page }) => {
      await openKaalchakra(page, '?view=river');
      const range = page.locator('.kc-river-controls span');
      const whole = (await range.textContent())!;
      await page.getByRole('button', { name: 'Zoom in' }).click();
      await page.getByRole('button', { name: 'Zoom in' }).click();
      await expect(range).not.toHaveText(whole);
      // The window is written after a debounce, so the URL may show one zoom before it shows both.
      await expect
        .poll(() => {
          const win = new URL(page.url()).searchParams.get('win');
          if (!win) return null;
          const [a, b] = win.split(',').map(Number);
          return b - a;
        })
        .toBeCloseTo(0.25, 2);
      await page.getByRole('button', { name: 'Zoom out' }).click();
      await page.getByRole('button', { name: 'Zoom out' }).click();
      await expect(range).toHaveText(whole);
      // The whole axis is the default, so it leaves the URL.
      await expect(page).not.toHaveURL(/win=/);
    });

    test('the keyboard zooms and pans the river', async ({ page }) => {
      await openKaalchakra(page, '?view=river');
      const range = page.locator('.kc-river-controls span');
      const whole = (await range.textContent())!;
      await page.locator('.kc-canvas').focus();
      await page.keyboard.press('+');
      await expect(range).not.toHaveText(whole);
      const zoomed = (await range.textContent())!;
      await page.keyboard.press('Shift+ArrowLeft');
      await expect(range).not.toHaveText(zoomed);
      await page.keyboard.press('-');
      await page.getByRole('button', { name: 'Whole wheel' }).click();
      await expect(range).toHaveText(whole);
    });

    test('tapping an era on the wheel zooms the river into it', async ({ page }) => {
      await openKaalchakra(page);
      await page.getByRole('group', { name: 'Zoom into an era' }).getByRole('button', { name: 'Classical' }).click();
      await expect(page.locator('.kc-river')).toBeVisible();
      await expect(viewButton(page, 'River')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.kc-river-controls span')).toContainText('BCE');
      await expect(page).toHaveURL(/view=river/);
    });
  });

  test.describe('lenses', () => {
    test('each lens shows only its own datings, and Both shows everything', async ({ page }) => {
      await openKaalchakra(page, '?view=list');
      const all = await listCount(page);

      await lensButton(page, 'Tradition').click();
      await expect(lensButton(page, 'Tradition')).toHaveAttribute('aria-pressed', 'true');
      await expect(page).toHaveURL(/lens=tradition/);
      await expect.poll(() => listCount(page)).toBeLessThan(all);
      const trad = await listCount(page);
      expect(trad).toBeGreaterThan(0);

      await lensButton(page, 'Scholarship').click();
      await expect(page).toHaveURL(/lens=scholarship/);
      await expect.poll(() => listCount(page)).toBeLessThan(all);
      const schol = await listCount(page);
      expect(schol).toBeGreaterThan(trad);
      // Some entries carry both kinds of dating, so the lenses overlap but never exceed the whole.
      expect(schol + trad).toBeGreaterThanOrEqual(all);

      await lensButton(page, 'Both lenses').click();
      await expect.poll(() => listCount(page)).toBe(all);
      await expect(page).not.toHaveURL(/lens=/);
    });

    test('the selected record shows only the datings of the current lens', async ({ page }) => {
      await openKaalchakra(page, '?view=list&lens=tradition');
      await page.locator('.kc-list button').first().click();
      await expect(page.locator('.kc-panel .dating').first()).toBeVisible();
      await expect(page.locator('.kc-panel .dating--scholarship')).toHaveCount(0);
      expect(await page.locator('.kc-panel .dating--tradition').count()).toBeGreaterThan(0);
    });

    test('the wheel redraws for the lens', async ({ page }) => {
      await openKaalchakra(page);
      const marks = page.locator('.kc-canvas .kc-wheel .kc-mark');
      const both = await marks.count();
      await lensButton(page, 'Tradition').click();
      await expect.poll(() => marks.count()).toBeLessThan(both);
    });
  });

  test.describe('deep links', () => {
    test('every piece of state survives a round trip through the URL', async ({ page, context }) => {
      await openKaalchakra(page);
      await viewButton(page, 'River').click();
      await lensButton(page, 'Scholarship').click();
      await page.getByLabel('Calendar').selectOption('vs');
      await showFilters(page);
      await page.getByRole('group', { name: 'Kinds of entry' }).getByRole('button', { name: 'People' }).click();
      await page.getByLabel('Filter entries').fill('India');
      await page.getByRole('button', { name: 'Zoom in' }).click();
      await page.locator('.kc-canvas').focus();
      await page.keyboard.press('ArrowRight');
      await page.getByRole('group', { name: 'Reading level' }).getByRole('button', { name: /teen/i }).click();
      const heading = (await page.locator('.kc-panel h2').textContent())!;
      const range = (await page.locator('.kc-river-controls span').textContent())!;

      const url = await settledUrl(page, /level=teen/);
      for (const key of ['view', 'lens', 'cal', 'kinds', 'q', 'id', 'win', 'level']) expect(url.searchParams.has(key), key).toBe(true);

      const fresh = await context.newPage();
      await openKaalchakra(fresh, url.search);
      await expect(viewButton(fresh, 'River')).toHaveAttribute('aria-pressed', 'true');
      await expect(lensButton(fresh, 'Scholarship')).toHaveAttribute('aria-pressed', 'true');
      await expect(fresh.getByLabel('Calendar')).toHaveValue('vs');
      await showFilters(fresh);
      await expect(fresh.getByRole('group', { name: 'Kinds of entry' }).getByRole('button', { name: 'People' })).toHaveAttribute('aria-pressed', 'false');
      await expect(fresh.getByLabel('Filter entries')).toHaveValue('India');
      await expect(fresh.locator('.kc-river-controls span')).toHaveText(range);
      await expect(fresh.locator('.kc-panel h2')).toHaveText(heading);
      await expect(fresh.getByRole('group', { name: 'Reading level' }).getByRole('button', { name: /teen/i })).toHaveAttribute('aria-pressed', 'true');
      // Restoring a link does not rewrite it.
      await fresh.waitForTimeout(400);
      expect(new URL(fresh.url()).search).toBe(url.search);
    });

    test('a deep link restores view and selection', async ({ page }) => {
      const href = await firstEntityHref(page);
      const [, , type, slug] = href.split('/');
      await openKaalchakra(page, `?view=list&id=${type}.${slug}`);
      await expect(page.locator('.kc-list')).toBeVisible();
      await expect(page.locator('.kc-list button[aria-current="true"]')).toHaveCount(1);
      await expect(page.locator('.kc-panel .btn--primary')).toHaveAttribute('href', href);
    });

    test('Back and Forward restore earlier states', async ({ page }) => {
      await openKaalchakra(page, '?view=list&lens=tradition');
      await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Archive' }).click();
      await expect(page).toHaveURL(/\/archive$/);
      await page.goBack();
      await expect(page.locator('.kc-list')).toBeVisible();
      await expect(lensButton(page, 'Tradition')).toHaveAttribute('aria-pressed', 'true');
      await page.goForward();
      await expect(page).toHaveURL(/\/archive$/);
    });

    test('malformed parameters fall back to the defaults without errors', async ({ page }) => {
      const errors = collectErrors(page);
      await openKaalchakra(page, '?view=bogus&lens=none&cal=x&kinds=nope&win=5,9&id=missing.entry&level=old');
      await expect(page.locator('.kc-wheel').first()).toBeVisible();
      await expect(viewButton(page, 'Wheel')).toHaveAttribute('aria-pressed', 'true');
      await expect(lensButton(page, 'Both lenses')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByLabel('Calendar')).toHaveValue('ce');
      await showFilters(page);
      await expect(page.getByRole('group', { name: 'Kinds of entry' }).getByRole('button')).toHaveCount(11);
      await expect(page.getByRole('group', { name: 'Kinds of entry' }).locator('button[aria-pressed="false"]')).toHaveCount(0);
      await expect(page.locator('.kc-panel h2')).toHaveText('One wheel, two lenses');
      expect(errors).toEqual([]);
    });
  });

  test.describe('list fallback', () => {
    test('the wheel is the default view', async ({ page }) => {
      await openKaalchakra(page);
      await expect(viewButton(page, 'Wheel')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('.kc-canvas .kc-wheel')).toBeVisible();
    });

    test('the list is keyboard complete', async ({ page, isMobile, browserName }) => {
      test.skip(isMobile, 'hardware keyboard navigation');
      test.skip(browserName === 'webkit', 'WebKit moves Tab focus to links only, by default, as Safari does');
      await openKaalchakra(page, '?view=list');
      const first = page.locator('.kc-list button').first();
      await first.focus();
      await page.keyboard.press('Enter');
      await expect(first).toHaveAttribute('aria-current', 'true');
      const name = await page.locator('.kc-panel h2').textContent();
      expect(name).not.toBe('One wheel, two lenses');
      await expect(first).toContainText(name!);
      await page.keyboard.press('Tab');
      await expect(page.locator('.kc-list button').nth(1)).toBeFocused();
    });

    test('without JavaScript the page still shows the wheel and a way into the archive', async ({ browser }) => {
      const context = await browser.newContext({ javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto('/kaalchakra');
      await expect(page.locator('h1')).toHaveText('The wheel of time');
      await expect(page.locator('.kc-wheel')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Browse every entry in the archive' })).toHaveAttribute('href', '/archive');
      await context.close();
    });

    test.describe('with reduced motion', () => {
      test.use({ reducedMotion: 'reduce' });

      test('the list is the default view, and links say so', async ({ page }) => {
        await openKaalchakra(page);
        await expect(page.locator('.kc-list')).toBeVisible();
        await expect(viewButton(page, 'List')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('.kc-canvas .kc-wheel')).toHaveCount(0);
        // A shared link must open the list for everyone, not only for readers who prefer reduced motion.
        await settledUrl(page, /view=list/);
      });

      test('an explicit view in the URL still wins', async ({ page }) => {
        await openKaalchakra(page, '?view=wheel');
        await expect(viewButton(page, 'Wheel')).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('.kc-canvas .kc-wheel')).toBeVisible();
        await page.waitForTimeout(400);
        expect(new URL(page.url()).searchParams.get('view')).toBe('wheel');
      });
    });
  });
});

test.describe('merged entities keep their old URLs', () => {
  const OLD = '/archive/concept/rigvedic-sarasvati';
  const NEW = '/archive/concept/ghaggar-hakra-sarasvati-debate';

  test('an old archive URL redirects permanently to the surviving entity', async ({ page, request }) => {
    const res = await request.get(OLD, { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    expect(new URL(res.headers()['location'], 'http://x').pathname).toBe(NEW);
    await page.goto(OLD);
    await expect(page).toHaveURL(NEW);
    await expect(page.locator('h1')).toHaveText('Ghaggar-Hakra Palaeochannel and the Sarasvati Identification');
  });

  test('an old Kaalchakra deep link selects the surviving entity', async ({ page, request }) => {
    const res = await request.get('/kaalchakra?view=list&id=event.dholavira-unesco-inscription', { maxRedirects: 0 });
    expect(res.status()).toBe(308);
    const loc = new URL(res.headers()['location'], 'http://x');
    expect(loc.searchParams.get('id')).toBe('site.dholavira');
    expect(loc.searchParams.get('view')).toBe('list');
    await page.goto('/kaalchakra?view=list&id=event.dholavira-unesco-inscription');
    await expect(page.locator('.kc-list button[aria-current="true"]')).toHaveCount(1);
    await expect(page.locator('.kc-panel .btn--primary')).toHaveAttribute('href', '/archive/site/dholavira');
    await expect(page).toHaveURL(/[?&]id=site\.dholavira(&|$)/);
  });
});

test('open data page links every export file, each matching its manifest checksum', async ({ page, request }) => {
  await page.goto('/data');
  await expect(page.getByRole('heading', { level: 1, name: 'Download the archive' })).toBeVisible();
  const manifest = await (await request.get('/data/manifest.json')).json();
  const downloads = page.locator('.data-file a[download]');
  const hrefs = await downloads.evaluateAll((links) => links.map((a) => a.getAttribute('href')));
  expect(hrefs.sort()).toEqual([...Object.keys(manifest.sha256), 'manifest.json'].map((name) => `/data/${name}`).sort());
  for (const [name, sha256] of Object.entries(manifest.sha256)) {
    const response = await request.get(`/data/${name}`);
    expect(response.status()).toBe(200);
    expect(createHash('sha256').update(await response.body()).digest('hex')).toBe(sha256);
    await expect(page.locator('.data-file', { hasText: `Download ${name}` }).locator('code')).toHaveText(sha256 as string);
  }
  // Compared as the page writes it ("1,027"), through the page's own formatter.
  const entities = page.locator('.data-counts > div').filter({ has: page.locator('dt', { hasText: /^entities$/ }) });
  await expect(entities.locator('dd')).toHaveText(formatCount(manifest.counts.entities));
  await expect(page.locator('.site-footer').getByRole('link', { name: 'Open data' })).toHaveAttribute('href', '/data');
});
