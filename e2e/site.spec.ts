import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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
  { name: 'search', path: '/search' },
  { name: 'search results', path: '/search?q=Harappa', ready: 'a.card' },
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
    await expect(page.locator('.article-meta')).toContainText('3 sources cited');
    await expect(page.locator('.references li')).toHaveCount(2);
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

  test('search finds entities and articles, and says so when nothing matches', async ({ page }) => {
    await page.goto('/search?q=Harappa');
    await expect(page.locator('.card').first()).toBeVisible();
    await expect(page.getByText(/^(?:Showing \d+ of )?\d+ results?$/)).toBeVisible();
    await page.goto('/search?q=zzzzqqqq');
    await expect(page.getByText('0 results for')).toBeVisible();
  });

  test('the header search box opens results', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('searchbox', { name: 'Search the archive' }).fill('Ashoka');
    await page.getByRole('searchbox', { name: 'Search the archive' }).press('Enter');
    await expect(page).toHaveURL(/\/search\?q=Ashoka/);
    await expect(page.locator('.card').first()).toBeVisible();
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

  test('filtering by text shows a definitive empty state', async ({ page }) => {
    await openKaalchakra(page, '?view=list');
    await page.getByLabel('Filter entries').fill('zzzzqqqq');
    await expect(page.getByText('0 entries match these filters.')).toBeVisible();
  });

  test('kind filters narrow every view and are reflected in the URL', async ({ page }) => {
    await openKaalchakra(page, '?view=list');
    const all = await listCount(page);
    const kinds = page.getByRole('group', { name: 'Kinds of entry' });
    await kinds.getByRole('button', { name: 'People' }).click();
    await expect(kinds.getByRole('button', { name: 'People' })).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => listCount(page)).toBeLessThan(all);
    await expect(page.locator('.kc-list__kind', { hasText: /^People$/ })).toHaveCount(0);
    const url = await settledUrl(page, /kinds=/);
    expect(url.searchParams.get('kinds')!.split(',')).not.toContain('person');
  });

  test.describe('zoom', () => {
    test('the zoom buttons narrow and widen the river window', async ({ page }) => {
      await openKaalchakra(page, '?view=river');
      const range = page.locator('.kc-river-controls span');
      const whole = (await range.textContent())!;
      await page.getByRole('button', { name: 'Zoom in' }).click();
      await page.getByRole('button', { name: 'Zoom in' }).click();
      await expect(range).not.toHaveText(whole);
      const zoomed = await settledUrl(page, /win=/);
      const [a, b] = zoomed.searchParams.get('win')!.split(',').map(Number);
      expect(b - a).toBeCloseTo(0.25, 2);
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

    test('the list is keyboard complete', async ({ page, isMobile }) => {
      test.skip(isMobile, 'hardware keyboard navigation');
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
