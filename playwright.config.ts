import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3107);
const CI = !!process.env.CI;
/** A dev server with DEBATES_PREVIEW=1, the owner's preview: renders unpublished debate drafts. */
const PREVIEW_PORT = Number(process.env.E2E_PREVIEW_PORT ?? PORT + 20);
const PREVIEW = /\.preview\.spec\.ts$/;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: 0,
  reporter: CI ? [['github'], ['list'], ['html', { open: 'never' }]] : [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  expect: {
    // Visual snapshots: no animation or caret, and a small tolerance for anti-aliasing only. The per-pixel
    // threshold is tighter than Playwright's default 0.2, which let a whole palette change pass unnoticed.
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css', maxDiffPixelRatio: 0.002, threshold: 0.05 },
  },
  // Chromium, Firefox and WebKit on desktop, plus an Android and an iOS phone. Visual snapshots run on the two Chromium projects only.
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } }, testIgnore: PREVIEW },
    { name: 'firefox', use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 900 } }, testIgnore: PREVIEW },
    { name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 900 } }, testIgnore: PREVIEW },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: PREVIEW },
    { name: 'iphone', use: { ...devices['iPhone 14'] }, testIgnore: PREVIEW },
    { name: 'preview-desktop', use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${PREVIEW_PORT}` }, testMatch: PREVIEW },
    { name: 'preview-mobile', use: { ...devices['Pixel 7'], baseURL: `http://localhost:${PREVIEW_PORT}` }, testMatch: PREVIEW },
  ],
  webServer: [
    {
      command: `npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: !CI,
      timeout: 60_000,
    },
    {
      command: `DEBATES_PREVIEW=1 npx next dev -p ${PREVIEW_PORT}`,
      url: `http://localhost:${PREVIEW_PORT}/debates`,
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
  ],
});
