import { test as base, Page, expect } from '@playwright/test';
import mockEvents from './events-mock.json';
import mockSpots from './spots-mock.json';
import mockConditions from './conditions-mock.json';

/** Lat/lng used for all mocked geolocation (London) */
const MOCK_LOCATION = { latitude: 51.5074, longitude: -0.1278, accuracy: 10 };

type NightQuestFixtures = {
  /** Page pre-configured with geolocation + API mocks, navigated to root */
  appPage: Page;
};

export const test = base.extend<NightQuestFixtures>({
  appPage: async ({ page, context }, use) => {
    // Grant and set geolocation so Expo's expo-location resolves immediately
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation(MOCK_LOCATION);

    // Intercept POST /api/events — return deterministic mock payload
    await page.route('**/api/events', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockEvents),
      });
    });

    // Intercept POST /api/spots — return deterministic mock payload
    await page.route('**/api/spots', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSpots),
      });
    });

    // Intercept POST /api/conditions — return deterministic mock payload
    await page.route('**/api/conditions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockConditions),
      });
    });

    // Also intercept GET /health (keeps backend optional during tests)
    await page.route('**/health', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{"status":"ok"}' });
    });

    await page.goto('/');
    await use(page);
  },
});

export { expect };
export { mockEvents };
export { mockSpots };
export { mockConditions };
