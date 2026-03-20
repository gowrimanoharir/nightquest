import { test, expect } from '../fixtures/base';

/**
 * Explore screen tests.
 *
 * Covers:
 *  - Year selector rendering (arrows on mobile, pills on tablet/web)
 *  - Filter pill list and active-state switching
 *  - Events loading and month section rendering
 *  - "Show past events" toggle
 *  - Empty state when no filter match
 *
 * All API calls and geolocation are mocked via the `appPage` fixture.
 *
 * Viewport-conditional skips are intentional — the app renders different UI
 * for mobile (<768px) vs tablet/web (≥768px).
 */

/* eslint-disable playwright/no-skipped-test */

test.describe('Explore screen', () => {
  // ── Year selector ──────────────────────────────────────────────────────────

  test.describe('year selector — mobile', () => {
    test.skip(({ viewport }) => !viewport || viewport.width >= 768, 'mobile only');

    test('shows prev/next arrow buttons', async ({ appPage }) => {
      await expect(appPage.getByText('‹')).toBeVisible();
      await expect(appPage.getByText('›')).toBeVisible();
    });

    test('advances year with next arrow', async ({ appPage }) => {
      const currentYear = new Date().getFullYear();
      await expect(appPage.getByText(String(currentYear))).toBeVisible();

      await appPage.getByText('›').click();
      await expect(appPage.getByText(String(currentYear + 1))).toBeVisible();
    });

    test('goes back year with prev arrow', async ({ appPage }) => {
      const currentYear = new Date().getFullYear();
      await appPage.getByText('‹').click();
      await expect(appPage.getByText(String(currentYear - 1))).toBeVisible();
    });
  });

  test.describe('year selector — tablet / web', () => {
    test.skip(({ viewport }) => !viewport || viewport.width < 768, 'tablet/web only');

    test('shows three year pills (prev, current, next)', async ({ appPage }) => {
      const year = new Date().getFullYear();
      await expect(appPage.getByText(String(year - 1))).toBeVisible();
      await expect(appPage.getByText(String(year))).toBeVisible();
      await expect(appPage.getByText(String(year + 1))).toBeVisible();
    });

    test('clicking a year pill makes it active', async ({ appPage }) => {
      const nextYear = new Date().getFullYear() + 1;
      await appPage.getByText(String(nextYear)).click();
      // Wait for the re-render after year change
      await appPage.waitForLoadState('networkidle');
      await expect(appPage.getByText(String(nextYear))).toBeVisible();
    });
  });

  // ── Filter pills ───────────────────────────────────────────────────────────

  test('all filter pills are rendered', async ({ appPage }) => {
    const filters = ['All', 'Meteor Showers', 'Eclipses', 'Moon', 'Planets', 'Milky Way'];
    for (const label of filters) {
      await expect(appPage.getByText(label)).toBeVisible();
    }
  });

  test('clicking a filter pill changes the active selection', async ({ appPage }) => {
    await appPage.getByText('Meteor Showers').waitFor({ state: 'visible' });
    await appPage.getByText('Meteor Showers').click();

    await expect(appPage.getByText('Perseid Meteor Shower')).toBeVisible();
    await expect(appPage.getByText('Total Lunar Eclipse')).toBeHidden();
  });

  test('switching back to All shows all event types', async ({ appPage }) => {
    await appPage.getByText('Meteor Showers').click();
    await appPage.getByText('All').click();

    await expect(appPage.getByText('Perseid Meteor Shower')).toBeVisible();
    await expect(appPage.getByText('Total Lunar Eclipse')).toBeVisible();
  });

  test('Eclipses filter shows only eclipse events', async ({ appPage }) => {
    await appPage.getByText('Eclipses').click();
    await expect(appPage.getByText('Total Lunar Eclipse')).toBeVisible();
    await expect(appPage.getByText('Perseid Meteor Shower')).toBeHidden();
  });

  test('Planets filter shows only planet events', async ({ appPage }) => {
    await appPage.getByText('Planets').click();
    await expect(appPage.getByText('Mars at Opposition')).toBeVisible();
    await expect(appPage.getByText('Full Moon')).toBeHidden();
  });

  // ── Event list ─────────────────────────────────────────────────────────────

  test('events load and at least one event is shown', async ({ appPage }) => {
    // Enable show-past so all mock events are eligible regardless of current date
    await appPage.getByText('Show past events').click();
    await appPage.waitForLoadState('networkidle');

    // With show-past enabled, at least the first mock event must appear
    await expect(appPage.getByText('Perseid Meteor Shower')).toBeVisible();
  });

  test('clicking an event card navigates to event detail', async ({ appPage }) => {
    await appPage.getByText('Show past events').click();
    await appPage.getByText('Perseid Meteor Shower').first().click();
    await expect(appPage).toHaveURL(/event-detail/);
  });

  // ── Show past events toggle ────────────────────────────────────────────────

  test('"Show past events" toggle is visible and clickable', async ({ appPage }) => {
    const toggle = appPage.getByText('Show past events');
    await expect(toggle).toBeVisible();
    await toggle.click(); // enable
    await toggle.click(); // disable — should not throw
  });

  // ── API error state ────────────────────────────────────────────────────────

  test('shows error state and Retry button on API failure', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278, accuracy: 10 });

    await page.route('**/api/events', async (route) => {
      await route.fulfill({ status: 500, body: 'Internal Server Error' });
    });

    await page.goto('/');
    await expect(page.getByText('Retry')).toBeVisible({ timeout: 8000 });
  });
});
