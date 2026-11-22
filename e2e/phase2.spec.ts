import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

interface ArchiveEntity {
  id: string;
  type: string;
  names: { en: string };
  location?: { name: string; lat: number; lon: number };
  relations: { kind: string; target: string }[];
}

let archive: ArchiveEntity[] | undefined;

/** The open data export written by the build: the same entities the pages are generated from. */
async function entities(request: APIRequestContext): Promise<ArchiveEntity[]> {
  if (!archive) {
    const res = await request.get('/data/archive.json');
    expect(res.ok()).toBe(true);
    archive = ((await res.json()) as { entities: ArchiveEntity[] }).entities;
  }
  return archive;
}

function hrefOf(id: string): string {
  const [type, slug] = id.split('.');
  return `/archive/${type}/${slug}`;
}

/**
 * Entity pages load a Wikimedia Commons photo, whose latency is outside this site's control; the page itself is
 * complete at DOMContentLoaded (static HTML), so waiting for the third-party image only makes the tests flaky.
 */
async function openEntity(page: Page, id: string) {
  await page.goto(hrefOf(id), { waitUntil: 'domcontentloaded' });
}

async function noSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes) e.g. ${v.nodes[0]?.target.join(' ')}`)).toEqual([]);
}

/** Nothing scrolls sideways, and nothing is silently clipped past the page gutter either. */
async function fitsViewport(page: Page, selector: string) {
  const { overflow, right, width } = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return {
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      right: el ? el.getBoundingClientRect().right : -1,
      width: document.documentElement.clientWidth,
    };
  }, selector);
  expect(overflow).toBeLessThanOrEqual(0);
  expect(right).toBeGreaterThan(0);
  expect(right).toBeLessThanOrEqual(width - 8);
}

const status = (page: Page) => page.getByTestId('map-status');

/** The number of entries the map says it shows. */
async function mapCount(page: Page): Promise<number> {
  const text = (await status(page).locator('span').textContent()) ?? '';
  const m = /^(\d+) entr/.exec(text);
  expect(m, `status reads "${text}"`).not.toBeNull();
  return Number(m![1]);
}

test.describe('Map view', () => {
  test('a deep link restores the moment, window, lens, kinds and region', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto('/kaalchakra?view=map&t=-268&zoom=millennium&lens=scholarship&kinds=site,event,polity&region=ganga');
    await expect(page.locator('.kc-map-svg')).toBeVisible();
    await expect(page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'Map' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('group', { name: 'Lens' }).getByRole('button', { name: 'Scholarship' })).toHaveAttribute('aria-pressed', 'true');
    await expect(status(page).locator('strong')).toHaveText('269 BCE');
    await expect(status(page)).toContainText('within 500 years of 269 BCE');
    await expect(page.getByLabel('Window')).toHaveValue('millennium');
    await expect(page.getByLabel('Region')).toHaveValue('ganga');
    await expect(page.getByRole('group', { name: 'Kinds of entry' }).getByRole('button', { pressed: true })).toHaveCount(3);
    expect(await mapCount(page)).toBeGreaterThan(0);
    // The state survives the debounced URL write unchanged.
    await page.waitForTimeout(500);
    const params = new URL(page.url()).searchParams;
    expect(Object.fromEntries(params)).toMatchObject({ view: 'map', t: '-268', zoom: 'millennium', lens: 'scholarship', kinds: 'polity,site,event', region: 'ganga' });
    expect(errors).toEqual([]);
  });

  test('a deep link to an entity selects its marker and frames it', async ({ page, request }) => {
    const all = await entities(request);
    const placed = all.find((e) => e.location && e.location.lon > 62 && e.location.lon < 96 && e.location.lat > 8 && e.location.lat < 36)!;
    await page.goto(`/kaalchakra?view=map&id=${placed.id}`);
    await expect(page.locator(`.kc-map-svg .kc-mark[data-active="true"][data-id="${placed.id}"]`)).toHaveCount(1);
    await expect(page.locator('.kc-panel h2')).toHaveText(placed.names.en);
    // A place outside the default region opens on the wide region instead of being off screen.
    const far = all.find((e) => e.location && e.location.lon < 55);
    test.skip(!far, 'no entry lies west of the default region');
    await page.goto(`/kaalchakra?view=map&id=${far!.id}`);
    await expect(page.getByLabel('Region')).toHaveValue('wide');
    await expect(page.locator(`.kc-map-svg .kc-mark[data-active="true"][data-id="${far!.id}"]`)).toHaveCount(1);
  });

  test('the entity page links to its place on the map', async ({ page, request }) => {
    const placed = (await entities(request)).find((e) => e.location)!;
    await openEntity(page, placed.id);
    await page.getByRole('link', { name: 'Show on the map' }).click();
    await expect(page).toHaveURL(/view=map/);
    await expect(page.locator(`.kc-map-svg .kc-mark[data-active="true"][data-id="${placed.id}"]`)).toHaveCount(1);
  });

  test('scrubbing time changes what is shown and is written to the URL', async ({ page }) => {
    await page.goto('/kaalchakra?view=map');
    await expect(status(page).locator('strong')).toHaveText('All time');
    const all = await mapCount(page);
    expect(all).toBeGreaterThan(50);
    await expect(page.getByRole('button', { name: 'All time' })).toHaveAttribute('aria-pressed', 'true');

    // Keyboard: each arrow press moves the moment by one window.
    const slider = page.getByRole('slider', { name: 'Moment in time' });
    await slider.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(status(page).locator('strong')).not.toHaveText('All time');
    await expect(page).toHaveURL(/[?&]t=-?\d+/);
    const first = await status(page).locator('strong').textContent();
    expect(await mapCount(page)).toBeLessThan(all);
    await page.keyboard.press('ArrowLeft');
    await expect(status(page).locator('strong')).not.toHaveText(first ?? '');
    await expect(slider).toHaveAttribute('aria-valuetext', /\d/);

    // Buttons do the same for pointer and touch users.
    const before = await status(page).locator('strong').textContent();
    await page.getByRole('button', { name: 'Earlier' }).click();
    await expect(status(page).locator('strong')).not.toHaveText(before ?? '');
    await page.getByRole('button', { name: 'Later' }).click();
    await expect(status(page).locator('strong')).toHaveText(before ?? '');

    // A wider window shows at least as much as a narrower one around the same moment.
    const narrow = await mapCount(page);
    await page.getByLabel('Window').selectOption('era');
    await expect(page).toHaveURL(/zoom=era/);
    expect(await mapCount(page)).toBeGreaterThanOrEqual(narrow);

    await page.getByRole('button', { name: 'All time' }).click();
    await expect(status(page).locator('strong')).toHaveText('All time');
    await expect(page).not.toHaveURL(/[?&]t=/);
    expect(await mapCount(page)).toBe(all);
  });

  test('switching lens changes the entries on the map', async ({ page }) => {
    await page.goto('/kaalchakra?view=map');
    const both = await mapCount(page);
    await page.getByRole('group', { name: 'Lens' }).getByRole('button', { name: 'Tradition' }).click();
    await expect(page).toHaveURL(/lens=tradition/);
    const tradition = await mapCount(page);
    expect(tradition).toBeGreaterThan(0);
    expect(tradition).toBeLessThan(both);
    await page.getByRole('group', { name: 'Lens' }).getByRole('button', { name: 'Scholarship' }).click();
    await expect(page).toHaveURL(/lens=scholarship/);
    const scholarship = await mapCount(page);
    expect(scholarship).toBeGreaterThan(tradition);
    expect(scholarship).toBeLessThanOrEqual(both);
  });

  test('the list fallback gives every entry on the map and selects from it', async ({ page }) => {
    await page.goto('/kaalchakra?view=map&t=1000&zoom=century');
    const n = await mapCount(page);
    expect(n).toBeGreaterThan(0);
    const list = page.locator('.kc-map-list');
    await expect(list.locator('summary')).toContainText(`List of the ${n} `);
    await list.locator('summary').click();
    const rows = list.locator('li button');
    await expect(rows).toHaveCount(n);
    const row = rows.first();
    await row.click();
    await expect(row).toHaveAttribute('aria-current', 'true');
    await expect(page).toHaveURL(/[?&]id=/);
    const id = new URL(page.url()).searchParams.get('id')!;
    await expect(page.locator(`.kc-map-svg .kc-mark[data-active="true"][data-id="${id}"]`)).toHaveCount(1);
    await expect(page.locator('.kc-panel .btn--primary')).toHaveAttribute('href', hrefOf(id));
  });

  test('a moment with nothing placed shows a definitive empty state', async ({ page }) => {
    await page.goto('/kaalchakra?view=map&q=zzzzqqqq');
    await expect(status(page)).toContainText('0 entries on the map');
    await page.locator('.kc-map-list summary').click();
    await expect(page.getByText('0 entries with a recorded place match these filters and this moment.')).toBeVisible();
  });

  test('clusters open: they zoom in, or list their members when zooming cannot separate them', async ({ page }) => {
    await page.goto('/kaalchakra?view=map');
    const clusters = page.locator('.kc-map-svg .kc-map-cluster');
    await expect(clusters.first()).toBeVisible();
    const before = await clusters.count();
    expect(before).toBeGreaterThan(3);
    const members = Number(await clusters.first().getAttribute('data-count'));
    expect(members).toBeGreaterThan(1);
    await clusters.first().locator('circle').last().click({ force: true });
    const open = page.locator('.kc-map-open');
    await expect.poll(async () => /region=/.test(page.url()) || (await open.count()) > 0).toBe(true);
    if (await open.count()) await expect(open.locator('li button')).toHaveCount(members);
    else await expect(page.getByLabel('Region')).toHaveValue('custom');
  });

  test('zoom, pan and stepping work from the keyboard', async ({ page }) => {
    await page.goto('/kaalchakra?view=map');
    await expect(page.locator('.kc-map-svg')).toBeVisible();
    await page.locator('.kc-canvas').focus();
    await page.keyboard.press('+');
    await expect(page).toHaveURL(/region=[\d.]+%2C[\d.]+%2C[\d.]+/);
    const zoomed = new URL(page.url()).searchParams.get('region');
    await page.keyboard.press('Shift+ArrowRight');
    await expect.poll(() => new URL(page.url()).searchParams.get('region')).not.toBe(zoomed);
    const [lonA] = zoomed!.split(',').map(Number);
    const [lonB] = new URL(page.url()).searchParams.get('region')!.split(',').map(Number);
    expect(lonB).toBeGreaterThan(lonA);

    await page.keyboard.press('ArrowRight');
    const first = await page.locator('.kc-panel h2').textContent();
    expect(first).not.toBe('Places in time');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('.kc-panel h2')).not.toHaveText(first ?? '');
    // The map follows the selection, so the selected marker is always drawn.
    await expect(page.locator('.kc-map-svg .kc-mark[data-active="true"]')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.locator('.kc-panel h2')).toHaveText('Places in time');

    // The zoom buttons are reachable and reversible.
    await page.getByLabel('Region').selectOption('south');
    await expect(page).toHaveURL(/region=south/);
    await page.getByRole('button', { name: 'Zoom out' }).click();
    await expect(page.getByLabel('Region')).toHaveValue('custom');
  });

  test('markers and clusters are buttons that open from the keyboard, and focus is never lost', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard access is covered on desktop');
    await page.goto('/kaalchakra?view=map');
    const marks = page.locator('.kc-map-svg .kc-mark');
    await expect(marks.first()).toBeVisible();
    const focused = () => page.evaluate(() => ({ key: (document.activeElement as HTMLElement | null)?.dataset.key ?? null, visible: document.activeElement?.matches(':focus-visible') ?? false }));

    // Tab reaches the markers from the controls above the map.
    await page.getByRole('button', { name: 'Zoom out' }).focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const first = await focused();
    expect(first.key).not.toBeNull();
    expect(first.visible).toBe(true);
    await expect(page.locator('.kc-map-svg [role="button"]:focus .kc-map-focus')).toHaveCSS('opacity', '1');

    // Enter opens a marker; focus stays on it, and the arrow keys carry focus along with the selection.
    const marker = marks.first();
    const id = await marker.getAttribute('data-id');
    const label = await marker.getAttribute('aria-label');
    await marker.focus();
    await expect(page.locator('.kc-tooltip')).toContainText(label!.split(',')[0]);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`id=${id!.replace('.', '\\.')}`));
    await expect(page.locator('.kc-panel h2')).not.toHaveText('Places in time');
    expect((await focused()).key).toBe(id);
    await page.keyboard.press('ArrowRight');
    await expect.poll(async () => (await focused()).key).not.toBe(id);
    const next = (await focused()).key;
    await expect(page.locator(`.kc-map-svg .kc-mark[data-key="${next}"]`)).toHaveAttribute('data-active', 'true');

    // Space on a cluster zooms in and hands focus to one of its members, or opens its list of members.
    const cluster = page.locator('.kc-map-svg .kc-map-cluster').first();
    await cluster.focus();
    await page.keyboard.press(' ');
    const open = page.locator('.kc-map-open');
    await expect.poll(async () => (await open.count()) > 0 || /region=/.test(page.url())).toBe(true);
    if (await open.count()) await expect(open.locator('li button').first()).toBeFocused();
    else await expect.poll(async () => (await focused()).key).not.toBeNull();
  });

  test('on a touch screen one finger scrolls the page and two fingers move the map', async ({ page, isMobile, context }) => {
    test.skip(!isMobile, 'touch gestures are covered on the mobile project');
    await page.goto('/kaalchakra?view=map');
    const svg = page.locator('.kc-map-svg');
    await expect(svg).toBeVisible();
    await expect(page.locator('.kc-map-hint__touch')).toBeVisible();
    await svg.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    const cdp = await context.newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: [number, number][]) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });
    const centre = async () => {
      const b = (await svg.boundingBox())!;
      return [b.x + b.width / 2, b.y + b.height / 2] as const;
    };
    const drag = async (from: [number, number][], dx: number, dy: number) => {
      await touch('touchStart', from);
      for (let i = 1; i <= 10; i++) {
        await touch('touchMove', from.map(([x, y]) => [x + (dx * i) / 10, y + (dy * i) / 10]));
        await page.waitForTimeout(16);
      }
      await touch('touchEnd', []);
    };

    // One finger upward scrolls the page and leaves the map where it was.
    const scrolled = await page.evaluate(() => window.scrollY);
    let [x, y] = await centre();
    await drag([[x, y]], 0, -200);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrolled + 50);
    await page.waitForTimeout(400);
    expect(page.url()).not.toMatch(/region=/);

    // One finger sideways does not move the map either; the hint says how to.
    [x, y] = await centre();
    await touch('touchStart', [[x, y]]);
    for (let i = 1; i <= 8; i++) await touch('touchMove', [[x - i * 20, y]]);
    await expect(page.locator('.kc-map-gesture')).toHaveAttribute('data-show', 'true');
    await touch('touchEnd', []);
    await page.waitForTimeout(400);
    expect(page.url()).not.toMatch(/region=/);

    // Two fingers pan the map without scrolling the page, and spreading them zooms in.
    const still = await page.evaluate(() => window.scrollY);
    [x, y] = await centre();
    await drag([[x - 40, y], [x + 40, y]], 60, 60);
    await expect(page).toHaveURL(/region=/);
    expect(await page.evaluate(() => window.scrollY)).toBe(still);
    const panned = new URL(page.url()).searchParams.get('region')!;
    await touch('touchStart', [[x - 30, y], [x + 30, y]]);
    for (let i = 1; i <= 8; i++) await touch('touchMove', [[x - 30 - i * 10, y], [x + 30 + i * 10, y]]);
    await touch('touchEnd', []);
    await expect.poll(() => Number(new URL(page.url()).searchParams.get('region')!.split(',')[2])).toBeLessThan(Number(panned.split(',')[2]));
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`is accessible and fits the viewport in the ${scheme} theme with reduced motion`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await page.goto('/kaalchakra?view=map&t=-268&zoom=era');
      await expect(page.locator('.kc-map-svg')).toBeVisible();
      await page.locator('.kc-map-list summary').click();
      await expect(page.locator('.kc-map-list li button').first()).toBeVisible();
      await expect(page.locator('.kc-map-svg')).toHaveAttribute('aria-label', /Map of South Asia and its neighbours\. \d+ entr/);
      await fitsViewport(page, '.kc-canvas');
      await noSeriousA11yViolations(page);
    });
  }

  test('switching views keeps the shared filters', async ({ page }) => {
    await page.goto('/kaalchakra?view=map&lens=scholarship&kinds=site&t=-2500&zoom=era');
    const onMap = await mapCount(page);
    expect(onMap).toBeGreaterThan(0);
    await page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'List' }).click();
    await expect(page.locator('.kc-canvas > .kc-list')).toBeVisible();
    await expect(page).toHaveURL(/view=list/);
    await expect(page).toHaveURL(/lens=scholarship/);
    await expect(page).toHaveURL(/kinds=site/);
    // Map-only parameters leave the URL with the Map view and come back with it.
    await expect(page).not.toHaveURL(/[?&]t=/);
    await page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'Map' }).click();
    await expect(page).toHaveURL(/t=-2500/);
    expect(await mapCount(page)).toBe(onMap);
  });
});

test.describe('Relation graph', () => {
  test('shows typed outgoing and incoming relations that link both ways', async ({ page, request }) => {
    const all = await entities(request);
    const inboundTo = new Set(all.flatMap((e) => e.relations.map((r) => r.target)));
    const subject = all.find((e) => e.relations.length >= 2 && inboundTo.has(e.id))!;
    expect(subject).toBeTruthy();
    await openEntity(page, subject.id);
    const graph = page.locator('.relgraph');
    await expect(graph.getByRole('heading', { name: 'Connections' })).toBeVisible();
    await expect(graph.locator('.relgraph__summary')).toHaveText(/^\d+ connections? to other entries: \d+ stated on this record, \d+ stated on other records, \d+ stated on both\.$/);
    await expect(graph.locator('.relgraph__root')).toHaveText(subject.names.en);

    // Every declared target appears once, as a link to that entity, under a typed branch.
    const links = graph.locator('.relgraph__nodes a');
    const hrefs = await links.evaluateAll((els) => els.map((a) => a.getAttribute('href')));
    expect(new Set(hrefs).size).toBe(new Set(hrefs.filter(Boolean)).size);
    for (const target of new Set(subject.relations.map((r) => r.target))) expect(hrefs).toContain(hrefOf(target));
    const directions = await links.evaluateAll((els) => els.map((a) => a.getAttribute('data-direction')));
    for (const d of directions) expect(['out', 'in', 'both']).toContain(d);
    const summary = (await graph.locator('.relgraph__summary').textContent()) ?? '';
    expect(Number(/^(\d+)/.exec(summary)![1])).toBe(hrefs.length);
    expect(await graph.locator('.relgraph__branch .relgraph__label').count()).toBeGreaterThan(0);
    // Each link names its direction for screen readers, not by arrow shape alone.
    await expect(links.first().locator('.visually-hidden')).toHaveText(/stated on (this record|the other record|both records)/);

    // Following an edge reaches a page whose graph links back.
    const target = subject.relations[0].target;
    await graph.locator(`.relgraph__nodes a[href="${hrefOf(target)}"]`).click();
    await expect(page).toHaveURL(new RegExp(`${hrefOf(target)}$`));
    await expect(page.locator(`.relgraph__nodes a[href="${hrefOf(subject.id)}"]`)).toHaveCount(1);
    await fitsViewport(page, '.relgraph__tree');
    await noSeriousA11yViolations(page);
  });

  test('an entity without relations says so', async ({ page, request }) => {
    const all = await entities(request);
    const inboundTo = new Set(all.flatMap((e) => e.relations.map((r) => r.target)));
    const lonely = all.find((e) => e.relations.length === 0 && !inboundTo.has(e.id));
    test.skip(!lonely, 'every entity has at least one relation');
    await openEntity(page, lonely!.id);
    await expect(page.locator('.relgraph__none')).toHaveText('0 connections: no relation between this entry and another is recorded yet.');
    await expect(page.locator('.relgraph__tree')).toHaveCount(0);
  });

  test('is accessible in the dark theme', async ({ page, request }) => {
    const all = await entities(request);
    const busiest = [...all].sort((a, b) => b.relations.length - a.relations.length)[0];
    await page.emulateMedia({ colorScheme: 'dark' });
    await openEntity(page, busiest.id);
    await expect(page.locator('.relgraph__tree')).toBeVisible();
    await fitsViewport(page, '.relgraph__tree');
    await noSeriousA11yViolations(page);
  });
});

test.describe('Entity pages', () => {
  const TYPES = ['event', 'person', 'text', 'site', 'polity', 'artifact', 'tradition', 'concept', 'cosmology'];

  for (const type of TYPES) {
    test(`a ${type} page shows datings, grades, sources, relations and its place in time`, async ({ page, request }) => {
      const entity = (await entities(request)).find((e) => e.type === type);
      expect(entity, `no entity of type ${type}`).toBeTruthy();
      await openEntity(page, entity!.id);
      await expect(page.locator('h1')).toHaveText(entity!.names.en);
      await expect(page.getByRole('heading', { name: 'When, and how we know' })).toBeVisible();
      await expect(page.locator('.datings .dating').first()).toBeVisible();
      await expect(page.locator('.datings .dating .grade').first()).toBeVisible();
      await expect(page.locator('.datings .dating__sources li').first()).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Connections' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Sources', exact: true })).toBeVisible();
      expect(await page.locator('.entity-sources li').count()).toBeGreaterThan(0);
      const strip = page.getByRole('region', { name: 'Place in the Kaalchakra' });
      await expect(strip).toBeVisible();
      for (const group of ['before', 'during', 'after']) await expect(strip.locator(`[data-neighbours="${group}"]`)).toBeVisible();
      await expect(strip.getByRole('link', { name: 'Open in the Kaalchakra' })).toBeVisible();
      await fitsViewport(page, '.kc-strip');
      // A long DOI must wrap inside its card instead of pushing the card past the gutter.
      await fitsViewport(page, '.datings .dating');
      await fitsViewport(page, '.entity-sources');
      await noSeriousA11yViolations(page);
    });
  }

  test('every entity page in the archive carries all five sections', async ({ request }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop', 'the generated HTML does not depend on the viewport');
    test.setTimeout(120_000);
    const all = await entities(request);
    expect(all.length).toBeGreaterThan(300);
    const required: [string, RegExp][] = [
      ['datings', /class="dating dating--(scholarship|tradition)"/],
      ['grade', /class="grade grade--[A-E]"/],
      ['dating sources', /class="dating__sources"><li>/],
      ['relations', /<section class="relgraph"[^>]*>[\s\S]*?(class="relgraph__tree"|class="relgraph__none")/],
      ['sources', /<h2 id="sources">Sources<\/h2>/],
      ['strip', /class="kc-strip"/],
      ['before', /data-neighbours="before"/],
      ['during', /data-neighbours="during"/],
      ['after', /data-neighbours="after"/],
      ['kaalchakra link', /href="\/kaalchakra\?id=[^"]+"/],
    ];
    const missing: string[] = [];
    const byType: Record<string, number> = {};
    for (let i = 0; i < all.length; i += 16) {
      await Promise.all(
        all.slice(i, i + 16).map(async (e) => {
          const res = await request.get(hrefOf(e.id));
          if (!res.ok()) return void missing.push(`${e.id}: HTTP ${res.status()}`);
          const html = await res.text();
          for (const [name, pattern] of required) if (!pattern.test(html)) missing.push(`${e.id}: ${name}`);
          byType[e.type] = (byType[e.type] ?? 0) + 1;
        }),
      );
    }
    expect(missing).toEqual([]);
    expect(Object.keys(byType).sort()).toEqual([...TYPES].sort());
    console.log(`checked ${all.length} entity pages: ${Object.entries(byType).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  });
});
