import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3107);
/** A dev server with DEBATES_PREVIEW=1, the owner's review build: renders unpublished debate drafts. */
const PREVIEW_PORT = Number(process.env.E2E_PREVIEW_PORT ?? PORT + 20);
const PREVIEW = /\.preview\.spec\.ts$/;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: PREVIEW },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: PREVIEW },
    { name: 'preview-desktop', use: { ...devices['Desktop Chrome'], baseURL: `http://localhost:${PREVIEW_PORT}` }, testMatch: PREVIEW },
    { name: 'preview-mobile', use: { ...devices['Pixel 7'], baseURL: `http://localhost:${PREVIEW_PORT}` }, testMatch: PREVIEW },
  ],
  webServer: [
    {
      command: `npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: `DEBATES_PREVIEW=1 npx next dev -p ${PREVIEW_PORT}`,
      url: `http://localhost:${PREVIEW_PORT}/debates`,
      reuseExistingServer: true,
      timeout: 120_000,
    },
  ],
});
