/**
 * Lighthouse CI: performance budgets as hard gates, measured on a throttled mid-tier Android profile.
 *
 * Profile: Lighthouse mobile defaults made explicit, a Moto G Power class phone (412 x 823, DPR 1.75) with
 * simulated slow 4G (150 ms RTT, 1.6 Mbit/s down, 750 kbit/s up) and a 4x CPU slowdown.
 *
 * Budgets (from section 12 of docs/prompts/kaalchakra-master-prompt.md where it sets one):
 *   LCP <= 2.0 s, TBT <= 200 ms (the lab stand-in for INP, which a page load cannot measure), CLS <= 0.1.
 *   JavaScript, compressed: Kaalchakra <= 250 KB before data; every other page <= 150 KB.
 *   The brief asks for article pages under 100 KB, but React 19 and the Next.js 16 App Router runtime alone
 *   are about 128 KB compressed, so 150 KB is the tightest budget this stack can meet; see README.
 *   Total transfer <= 1.2 MB per page, which catches font, image and data regressions.
 *
 * Two documented exceptions, both on the search page, where the search engine runs in the browser:
 *   JavaScript: /search carries Pagefind's runtime (pagefind.js, 13.4 KB compressed) and the search interface
 *   (6.3 KB) on top of the 133 KB every page ships, 153.3 KB in all. Neither can be dropped without dropping
 *   search, so /search is held to 160 KB; every other page stays at 150 KB.
 *   LCP: a hard load of search results (/search?q=...) paints its first result only after hydration and a chain
 *   of downloads (runtime, index entry, engine and metadata, index chunk, result fragments), so it cannot reach
 *   2.0 s with a static, client-searched index; that needs server-rendered results. It is held to a ratchet just
 *   above its measured 3.6 to 3.8 s (it was 4.5 s before the page chrome stopped prefetching other routes ahead of
 *   the search requests). The search page itself (/search) meets every other budget.
 *
 * Page types measured: home, Kaalchakra (wheel and Map view), entity, article, search and search results, a source
 * record, the learning index and a learning path, a debate (the longest, the Mahabharata war), and the open data page.
 *
 * Run locally after `npm run build`: `npm run test:lighthouse` (port 3118 unless LHCI_PORT is set).
 */
const PORT = Number(process.env.LHCI_PORT ?? 3118);
const base = `http://localhost:${PORT}`;
const KB = 1024;

const pages = {
  home: `${base}/`,
  kaalchakra: `${base}/kaalchakra`,
  entity: `${base}/archive/artifact/ashoka-major-rock-edict-xiii`,
  article: `${base}/music/the-72-melakartas`,
  search: `${base}/search`,
  searchResults: `${base}/search?q=Harappa`,
  kaalchakraMap: `${base}/kaalchakra?view=map`,
  source: `${base}/sources/thapar-2012-asoka-decline-mauryas`,
  learn: `${base}/learn`,
  learningPath: `${base}/learn/how-we-date-ashoka`,
  debate: `${base}/debates/date-of-the-mahabharata-war`,
  data: `${base}/data`,
};

const everyPage = {
  'categories:performance': ['error', { minScore: 0.9, aggregationMethod: 'median' }],
  'categories:accessibility': ['error', { minScore: 0.95, aggregationMethod: 'median' }],
  'largest-contentful-paint': ['error', { maxNumericValue: 2000, aggregationMethod: 'median' }],
  'total-blocking-time': ['error', { maxNumericValue: 200, aggregationMethod: 'median' }],
  'cumulative-layout-shift': ['error', { maxNumericValue: 0.1, aggregationMethod: 'median' }],
  'resource-summary:total:size': ['error', { maxNumericValue: 1200 * KB, aggregationMethod: 'median' }],
};

module.exports = {
  ci: {
    collect: {
      url: Object.values(pages),
      numberOfRuns: 3,
      startServerCommand: `npx next start -p ${PORT}`,
      startServerReadyPattern: 'Ready',
      settings: {
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
        formFactor: 'mobile',
        screenEmulation: { mobile: true, width: 412, height: 823, deviceScaleFactor: 1.75, disabled: false },
        throttlingMethod: 'simulate',
        throttling: { rttMs: 150, throughputKbps: 1638.4, requestLatencyMs: 562.5, downloadThroughputKbps: 1474.56, uploadThroughputKbps: 675, cpuSlowdownMultiplier: 4 },
        // GitHub-hosted Ubuntu runners restrict the user namespaces Chrome's sandbox needs.
        chromeFlags: process.env.CI ? '--headless=new --no-sandbox' : '--headless=new',
      },
    },
    assert: {
      assertMatrix: [
        { matchingUrlPattern: '^(?!.*[?&]q=)', assertions: everyPage },
        {
          matchingUrlPattern: '[?&]q=',
          assertions: {
            ...everyPage,
            'categories:performance': ['error', { minScore: 0.85, aggregationMethod: 'median' }],
            'largest-contentful-paint': ['error', { maxNumericValue: 4000, aggregationMethod: 'median' }],
          },
        },
        {
          matchingUrlPattern: '/kaalchakra',
          assertions: { 'resource-summary:script:size': ['error', { maxNumericValue: 250 * KB, aggregationMethod: 'median' }] },
        },
        {
          matchingUrlPattern: `^${base}/search`,
          assertions: { 'resource-summary:script:size': ['error', { maxNumericValue: 160 * KB, aggregationMethod: 'median' }] },
        },
        {
          matchingUrlPattern: `^${base}/(?!kaalchakra|search)`,
          assertions: { 'resource-summary:script:size': ['error', { maxNumericValue: 150 * KB, aggregationMethod: 'median' }] },
        },
      ],
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci/reports' },
  },
};
