import { test, expect, mockSpots } from '../fixtures/base';

/**
 *
 * Covers:
 *  - Screen loads with today's date in the date picker
 *  - Location picker is present in the header
 *  - "What's Visible Tonight" section renders
 *  - "Find Dark Skies" button is visible and opens the distance modal
 *  - Distance options are selectable in the modal
 *  - Searching with mock API returns spot results in the list
 *  - Spot cards show name, score, Bortle tag, certified badge
 *  - "View Details" CTA is present on each spot card
 *  - Empty state shown when API returns no spots
 *  - Error state shown when API fails, with Retry button
 *  - Pre-fill banner shows when arriving via "Find Dark Skies" from Explore
 *
 * API calls and geolocation are mocked via the `appPage` fixture.
 * react-native-maps is not supported on web; tests validate the web list view.
 */

test.describe('Stargaze screen', () => {
  // ── Screen loads ────────────────────────────────────────────────────────────

  test('loads the Stargaze tab', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    await expect(appPage).toHaveURL(/stargaze/);
  });

  test('shows the Stargaze heading', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    // The screen-level "⭐ Stargaze" logo text
    await expect(appPage.getByText(/Stargaze/i).first()).toBeVisible();
  });

  // ── Date picker ─────────────────────────────────────────────────────────────

  test('date picker shows "Today" for the default date', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    await expect(appPage.getByText('Today')).toBeVisible();
  });

  test('date picker advances to tomorrow with next arrow', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowISO = tomorrow.toISOString().slice(0, 10);

    // Click the › arrow (next day)
    await appPage.getByLabel('Next day').click();
    await expect(appPage.getByText('Tomorrow')).toBeVisible();
    await expect(appPage.getByText(tomorrowISO)).toBeVisible();
  });

  test('date picker goes back to yesterday with prev arrow', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayISO = yesterday.toISOString().slice(0, 10);

    await appPage.getByLabel('Previous day').click();
    await expect(appPage.getByText('Yesterday')).toBeVisible();
    await expect(appPage.getByText(yesterdayISO)).toBeVisible();
  });

  test('shows historical averages label for dates beyond 16 days', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();

    // Advance 17 days by clicking › 17 times
    const nextBtn = appPage.getByLabel('Next day');
    for (let i = 0; i < 17; i++) {
      await nextBtn.click();
    }

    await expect(
      appPage.getByText(/Historical averages — no live forecast/, { exact: false })
    ).toBeVisible();
  });

  // ── What's Visible section ──────────────────────────────────────────────────

  test('What\'s Visible Tonight section is shown', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    await expect(appPage.getByText("What's Visible Tonight")).toBeVisible();
  });

  test('Moon and Milky Way items appear in What\'s Visible section', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    await expect(appPage.getByText('Moon')).toBeVisible();
    await expect(appPage.getByText('Milky Way')).toBeVisible();
  });

  // ── Find Dark Skies CTA ─────────────────────────────────────────────────────

  test('"Find Dark Skies" button is visible', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    await expect(appPage.getByText(/Find Dark Skies/i)).toBeVisible();
  });

  test('"Find Dark Skies" opens the distance picker modal', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    await appPage.getByText(/Find Dark Skies/i).click();

    await expect(appPage.getByText('Search Radius')).toBeVisible();
    await expect(appPage.getByText(/Find dark sky spots within/i)).toBeVisible();
  });

  test('distance picker shows all distance options', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    await appPage.getByText(/Find Dark Skies/i).click();

    for (const km of [20, 50, 80, 150, 200, 300]) {
      await expect(appPage.getByText(`${km} km`)).toBeVisible();
    }
  });

  test('can select a different distance option', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    await appPage.getByText(/Find Dark Skies/i).click();

    await appPage.getByText('150 km').click();
    // The option should now be highlighted (active) — verify it remains visible
    await expect(appPage.getByText('150 km')).toBeVisible();
  });

  // ── Search results ──────────────────────────────────────────────────────────

  test('searching returns spot results from the mock API', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    await appPage.getByText(/Find Dark Skies/i).click();

    await appPage.getByText('Search').click();

    // Wait for results (web renders the list view)
    await expect(appPage.getByText('McDonald Observatory')).toBeVisible({ timeout: 8000 });
  });

  test('spot cards show all mock spots', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    await appPage.getByText(/Find Dark Skies/i).click();
    await appPage.getByText('Search').click();

    for (const spot of mockSpots.spots) {
      await expect(appPage.getByText(spot.name)).toBeVisible({ timeout: 8000 });
    }
  });

  test('spot card shows Bortle tag', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    await appPage.getByText(/Find Dark Skies/i).click();
    await appPage.getByText('Search').click();

    await expect(appPage.getByText('Bortle 2').first()).toBeVisible({ timeout: 8000 });
  });

  test('IDA Certified badge shown for certified spots', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    await appPage.getByText(/Find Dark Skies/i).click();
    await appPage.getByText('Search').click();

    await expect(appPage.getByText('IDA Certified').first()).toBeVisible({ timeout: 8000 });
  });

  test('"View Details" button present on spot cards', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    await appPage.getByText(/Find Dark Skies/i).click();
    await appPage.getByText('Search').click();

    await expect(appPage.getByText(/View Details/i).first()).toBeVisible({ timeout: 8000 });
  });

  test('spot score is displayed on cards', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    await appPage.getByText(/Find Dark Skies/i).click();
    await appPage.getByText('Search').click();

    // Top spot score from mock is 88.5 → rounds to 89
    await expect(appPage.getByText('89').first()).toBeVisible({ timeout: 8000 });
  });

  // ── Empty state ─────────────────────────────────────────────────────────────

  test('shows empty state when API returns no spots', async ({ appPage, page }) => {
    // Override the spots mock to return empty
    await page.route('**/api/spots', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ spots: [] }),
      });
    });

    await appPage.getByText('Stargaze').first().click();
    await appPage.getByText(/Find Dark Skies/i).click();
    await appPage.getByText('Search').click();

    await expect(appPage.getByText(/No spots found/i)).toBeVisible({ timeout: 8000 });
    await expect(appPage.getByText('Adjust distance')).toBeVisible();
  });

  // ── Error state ─────────────────────────────────────────────────────────────

  test('shows error state and Retry button when API fails', async ({ appPage, page }) => {
    await page.route('**/api/spots', async (route) => {
      await route.fulfill({ status: 500, body: 'Internal Server Error' });
    });

    await appPage.getByText('Stargaze').first().click();
    await appPage.getByText(/Find Dark Skies/i).click();
    await appPage.getByText('Search').click();

    await expect(appPage.getByText('Retry')).toBeVisible({ timeout: 8000 });
  });

  // ── Explore → Stargaze handoff ──────────────────────────────────────────────

  test('arriving from Explore "Find Dark Skies" shows Planning banner', async ({ appPage }) => {
    // Enable show-past so the Perseid event is reachable
    await appPage.getByText('Show past events').click();
    await appPage.getByText('Perseid Meteor Shower').first().click();
    await expect(appPage).toHaveURL(/event-detail/);

    await appPage.getByText(/Find Dark Skies/i).click();
    await expect(appPage).toHaveURL(/stargaze/);

    // Banner should say "Planning for: Perseid Meteor Shower"
    await expect(
      appPage.getByText(/Planning for.*Perseid/i, { exact: false })
    ).toBeVisible({ timeout: 6000 });
  });

  test('arriving from Explore auto-triggers spot search', async ({ appPage }) => {
    await appPage.getByText('Show past events').click();
    await appPage.getByText('Perseid Meteor Shower').first().click();
    await appPage.getByText(/Find Dark Skies/i).click();

    // Auto-search should fire — spots should appear without manually clicking Search
    await expect(appPage.getByText('McDonald Observatory')).toBeVisible({ timeout: 8000 });
  });
});
