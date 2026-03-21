import { test, expect, mockConditions } from '../fixtures/base';

/**
 * Phase 3B — Spot Detail screen tests.
 *
 * Covers:
 *  - Navigating to spot detail from the stargaze list
 *  - All 8 condition factor rows are displayed
 *  - Overall score and label are shown
 *  - "How is this calculated?" expands and collapses the breakdown
 *  - Moon section shows phase, illumination, rise/set times, best viewing window
 *  - Getting There section shows Get Directions button
 *  - View Website button shown only for spots with a website
 *  - AI Take section is present
 *  - Historical averages banner shown for far-future dates (data_type mock override)
 *  - Back button navigates back to stargaze
 *
 * All API calls are mocked via the appPage fixture.
 */

test.describe('Spot Detail screen', () => {

  test('navigates to spot detail from stargaze list', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    await appPage.getByText(/Find Dark Skies/i).click();
    await appPage.getByText('Search').click();

    await expect(appPage.getByText('McDonald Observatory')).toBeVisible({ timeout: 8000 });
    await appPage.getByText(/View Details/i).first().click();

    // Should land on spot-detail route
    await expect(appPage).toHaveURL(/spot-detail/, { timeout: 6000 });
  });

  test('shows spot name on detail screen', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    await appPage.getByText(/Find Dark Skies/i).click();
    await appPage.getByText('Search').click();
    await expect(appPage.getByText('McDonald Observatory')).toBeVisible({ timeout: 8000 });
    await appPage.getByText(/View Details/i).first().click();

    await expect(appPage.getByText('McDonald Observatory').first()).toBeVisible({ timeout: 8000 });
  });

  test('shows overall score from mock conditions', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    await appPage.getByText(/Find Dark Skies/i).click();
    await appPage.getByText('Search').click();
    await expect(appPage.getByText('McDonald Observatory')).toBeVisible({ timeout: 8000 });
    await appPage.getByText(/View Details/i).first().click();

    // Mock score is 87
    await expect(appPage.getByText('87')).toBeVisible({ timeout: 8000 });
  });

  test('shows conditions label Excellent from mock', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    await appPage.getByText(/Find Dark Skies/i).click();
    await appPage.getByText('Search').click();
    await expect(appPage.getByText('McDonald Observatory')).toBeVisible({ timeout: 8000 });
    await appPage.getByText(/View Details/i).first().click();

    await expect(appPage.getByText('Excellent').first()).toBeVisible({ timeout: 8000 });
  });

  test('shows all 8 condition factor names', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    await appPage.getByText(/Find Dark Skies/i).click();
    await appPage.getByText('Search').click();
    await expect(appPage.getByText('McDonald Observatory')).toBeVisible({ timeout: 8000 });
    await appPage.getByText(/View Details/i).first().click();

    const factorNames = mockConditions.factors.map((f) => f.name.toUpperCase());
    for (const name of factorNames) {
      await expect(appPage.getByText(name, { exact: false })).toBeVisible({ timeout: 8000 });
    }
  });

  test('"How is this calculated?" is present and expands breakdown', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    await appPage.getByText(/Find Dark Skies/i).click();
    await appPage.getByText('Search').click();
    await expect(appPage.getByText('McDonald Observatory')).toBeVisible({ timeout: 8000 });
    await appPage.getByText(/View Details/i).first().click();

    await expect(appPage.getByText(/How is this calculated/i)).toBeVisible({ timeout: 8000 });
    await appPage.getByText(/How is this calculated/i).click();

    // After expansion, "Cloud Cover" appears in the breakdown list
    await expect(appPage.getByText('Cloud Cover', { exact: false }).first()).toBeVisible({ timeout: 3000 });
  });

  test('shows moon phase from mock', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    await appPage.getByText(/Find Dark Skies/i).click();
    await appPage.getByText('Search').click();
    await expect(appPage.getByText('McDonald Observatory')).toBeVisible({ timeout: 8000 });
    await appPage.getByText(/View Details/i).first().click();

    await expect(appPage.getByText(mockConditions.moon.phase)).toBeVisible({ timeout: 8000 });
  });

  test('shows moon rise and set times from mock', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    await appPage.getByText(/Find Dark Skies/i).click();
    await appPage.getByText('Search').click();
    await expect(appPage.getByText('McDonald Observatory')).toBeVisible({ timeout: 8000 });
    await appPage.getByText(/View Details/i).first().click();

    await expect(appPage.getByText(mockConditions.moon.rise_time)).toBeVisible({ timeout: 8000 });
    await expect(appPage.getByText(mockConditions.moon.set_time)).toBeVisible({ timeout: 8000 });
  });

  test('shows best viewing window from mock', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    await appPage.getByText(/Find Dark Skies/i).click();
    await appPage.getByText('Search').click();
    await expect(appPage.getByText('McDonald Observatory')).toBeVisible({ timeout: 8000 });
    await appPage.getByText(/View Details/i).first().click();

    await expect(
      appPage.getByText(mockConditions.moon.best_viewing_window, { exact: false })
    ).toBeVisible({ timeout: 8000 });
  });

  test('shows AI Take section with mock ai_take text', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    await appPage.getByText(/Find Dark Skies/i).click();
    await appPage.getByText('Search').click();
    await expect(appPage.getByText('McDonald Observatory')).toBeVisible({ timeout: 8000 });
    await appPage.getByText(/View Details/i).first().click();

    await expect(appPage.getByText('AI Take')).toBeVisible({ timeout: 8000 });
    await expect(
      appPage.getByText(/Conditions look excellent/, { exact: false })
    ).toBeVisible({ timeout: 8000 });
  });

  test('shows Get Directions button', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    await appPage.getByText(/Find Dark Skies/i).click();
    await appPage.getByText('Search').click();
    await expect(appPage.getByText('McDonald Observatory')).toBeVisible({ timeout: 8000 });
    await appPage.getByText(/View Details/i).first().click();

    await expect(appPage.getByText(/Get Directions/i)).toBeVisible({ timeout: 8000 });
  });

  test('shows View Website button for spots that have a website', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    await appPage.getByText(/Find Dark Skies/i).click();
    await appPage.getByText('Search').click();
    await expect(appPage.getByText('McDonald Observatory')).toBeVisible({ timeout: 8000 });
    await appPage.getByText(/View Details/i).first().click();

    await expect(appPage.getByText(/View Website/i)).toBeVisible({ timeout: 8000 });
  });

  test('shows historical averages banner when data_type is historical_average', async ({ appPage, page }) => {
    // Override conditions mock to return historical_average
    await page.route('**/api/conditions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...mockConditions, data_type: 'historical_average' }),
      });
    });

    await appPage.getByText('Stargaze').first().click();
    await appPage.getByText(/Find Dark Skies/i).click();
    await appPage.getByText('Search').click();
    await expect(appPage.getByText('McDonald Observatory')).toBeVisible({ timeout: 8000 });
    await appPage.getByText(/View Details/i).first().click();

    await expect(
      appPage.getByText(/historical averages/i, { exact: false })
    ).toBeVisible({ timeout: 8000 });
  });

  test('back button navigates back to stargaze', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    await appPage.getByText(/Find Dark Skies/i).click();
    await appPage.getByText('Search').click();
    await expect(appPage.getByText('McDonald Observatory')).toBeVisible({ timeout: 8000 });
    await appPage.getByText(/View Details/i).first().click();
    await expect(appPage).toHaveURL(/spot-detail/, { timeout: 6000 });

    await appPage.getByText('Back').click();
    await expect(appPage).toHaveURL(/stargaze/, { timeout: 6000 });
  });

  test('shows error state with Retry when conditions API fails', async ({ appPage, page }) => {
    await page.route('**/api/conditions', async (route) => {
      await route.fulfill({ status: 500, body: 'Internal Server Error' });
    });

    await appPage.getByText('Stargaze').first().click();
    await appPage.getByText(/Find Dark Skies/i).click();
    await appPage.getByText('Search').click();
    await expect(appPage.getByText('McDonald Observatory')).toBeVisible({ timeout: 8000 });
    await appPage.getByText(/View Details/i).first().click();

    await expect(appPage.getByText('Retry')).toBeVisible({ timeout: 8000 });
  });

  test('spot detail shows Bortle badge', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    await appPage.getByText(/Find Dark Skies/i).click();
    await appPage.getByText('Search').click();
    await expect(appPage.getByText('McDonald Observatory')).toBeVisible({ timeout: 8000 });
    await appPage.getByText(/View Details/i).first().click();

    await expect(appPage.getByText(/Bortle 2/i).first()).toBeVisible({ timeout: 8000 });
  });

  test('IDA Certified badge on spot detail header', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    await appPage.getByText(/Find Dark Skies/i).click();
    await appPage.getByText('Search').click();
    await expect(appPage.getByText('McDonald Observatory')).toBeVisible({ timeout: 8000 });
    await appPage.getByText(/View Details/i).first().click();

    await expect(appPage.getByText(/IDA Certified/i).first()).toBeVisible({ timeout: 8000 });
  });
});
