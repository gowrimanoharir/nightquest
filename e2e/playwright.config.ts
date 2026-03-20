import { defineConfig, devices } from '@playwright/test';

/**
 * Base URL for the Expo web dev server.
 * Override with NIGHTQUEST_URL env var for CI or a deployed build.
 *
 * Local dev:  NIGHTQUEST_URL=http://localhost:8081 (default)
 * Web export: NIGHTQUEST_URL=http://localhost:4000  (after `expo export --platform web` + serve)
 */
const BASE_URL = process.env.NIGHTQUEST_URL ?? 'http://localhost:8081';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
  },

  projects: [
    // ─── Desktop / Web ──────────────────────────────────────────────────────
    {
      name: 'web',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
      },
    },

    // ─── Tablet (768px triggers isTabletOrWeb breakpoint) ───────────────────
    {
      name: 'tablet',
      use: {
        ...devices['iPad (gen 7)'],
        viewport: { width: 820, height: 1180 },
        isMobile: true,
        hasTouch: true,
      },
    },

    // ─── Mobile (<768px, arrow year-selector, horizontal filter scroll) ─────
    {
      name: 'mobile',
      use: {
        ...devices['iPhone 13'],
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
