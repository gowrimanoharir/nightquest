# E2E Testing Agent — NightQuest

## Overview

This skill enables the AI to generate, run, and maintain Playwright e2e tests for NightQuest across **mobile** (390×844), **tablet** (820×1180), and **web** (1280×800) viewport profiles.

All tests live in `e2e/` at the project root (separate package from the Expo frontend).

---

## Project Context

| Layer | Technology | Dev URL |
|---|---|---|
| Frontend | Expo / React Native Web (Expo Router) | `http://localhost:8081` |
| Backend | FastAPI | `http://localhost:8000` |

**Key breakpoint**: `768px` — below this width the app uses mobile UI (arrow year selector, horizontal-scroll filter row); at or above it uses tablet/web UI (year pills, wrapping filter row).

**Routes**:
- `/` → redirects to `/(tabs)/explore`
- `/(tabs)/explore` — main screen with year selector, filter pills, event list
- `/(tabs)/stargaze` — placeholder (Phase 3A)
- `/event-detail?data=<JSON>` — event detail, data passed via search param

---

## Test Infrastructure

```
e2e/
├── package.json              # @playwright/test only
├── playwright.config.ts      # 3 projects: web | tablet | mobile
├── fixtures/
│   ├── base.ts               # Extended test fixture: mocks geolocation + POST /api/events
│   └── events-mock.json      # Deterministic API response with 6 events across all types
└── tests/
    ├── navigation.spec.ts    # Shell, redirect, tab switching
    ├── explore.spec.ts       # Year selector, filters, event list, error state
    └── event-detail.spec.ts  # Detail route, back navigation, missing-data guard
```

### The `appPage` Fixture

Import from `../fixtures/base` instead of `@playwright/test`.

```ts
import { test, expect, mockEvents } from '../fixtures/base';
```

`appPage` provides a `Page` that has:
1. **Geolocation granted** and set to London (51.5074, -0.1278)
2. **`POST /api/events` intercepted** — returns `fixtures/events-mock.json`
3. **Navigated to `/`** (which redirects to Explore)

---

## Running Tests

```bash
# From the e2e/ directory:
npm test                  # all viewports
npm run test:web          # desktop only
npm run test:tablet       # tablet only
npm run test:mobile       # mobile only
npm run test:ui           # Playwright UI mode (interactive)
npm run test:debug        # step-by-step debugger
npm run report            # open last HTML report

# Target a specific spec:
npx playwright test tests/explore.spec.ts --project=mobile

# Override the app URL (e.g. web export served on port 4000):
NIGHTQUEST_URL=http://localhost:4000 npm test
```

**Prerequisites** — both servers must be running:
```bash
# Terminal 1 — backend
cd backend && uvicorn api:app --reload --port 8000

# Terminal 2 — frontend (Expo web)
cd frontend && npx expo start --web
```

---

## Writing New Tests

### Template

```ts
import { test, expect } from '../fixtures/base';

test.describe('<Feature name>', () => {
  // Skip for specific viewport sizes when needed:
  // test.skip(({ viewport }) => !viewport || viewport.width >= 768, 'mobile only');
  // test.skip(({ viewport }) => !viewport || viewport.width < 768,  'tablet/web only');

  test('should <expected behaviour>', async ({ appPage }) => {
    // Wait for UI to settle
    await appPage.waitForLoadState('networkidle');

    // Use text-based selectors (React Native Web renders no semantic HTML)
    await expect(appPage.getByText('some text')).toBeVisible();

    // Interact
    await appPage.getByText('Meteor Showers').click();

    // Assert URL
    await expect(appPage).toHaveURL(/explore/);
  });
});
```

### Selector Strategy

React Native Web renders `Text` → `<div>`, `Pressable` → `<div>`. Use:
- `page.getByText('label')` — preferred
- `page.getByText(/partial/, { exact: false })` — partial matches
- `page.locator('[data-testid="..."]')` — only if `testID` props have been added to the component

### Mocking a Different API Response

```ts
test('handles empty events', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278, accuracy: 10 });

  await page.route('**/api/events', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ events: [], generated_at: new Date().toISOString() }),
    })
  );

  await page.goto('/');
  await expect(page.getByText('No events match this filter.')).toBeVisible();
});
```

### Viewport-Conditional Tests

```ts
// Mobile-only test (< 768px)
test.skip(({ viewport }) => !viewport || viewport.width >= 768, 'mobile only');

// Tablet/web-only test (≥ 768px)
test.skip(({ viewport }) => !viewport || viewport.width < 768, 'tablet/web only');
```

---

## Adding a New Viewport

In `playwright.config.ts`, add a new entry to the `projects` array:

```ts
{
  name: 'tablet-landscape',
  use: {
    viewport: { width: 1180, height: 820 },
    isMobile: true,
    hasTouch: true,
  },
},
```

---

## Common Patterns

| Task | Code |
|---|---|
| Wait for loading to finish | `await page.waitForLoadState('networkidle')` |
| Wait for spinner to disappear | `await page.waitForSelector('[aria-busy="true"]', { state: 'hidden' })` |
| Enable "Show past events" | `await appPage.getByText('Show past events').click()` |
| Switch year (mobile) | `await appPage.getByText('›').click()` |
| Switch year (tablet/web) | `await appPage.getByText(String(year + 1)).click()` |
| Apply event type filter | `await appPage.getByText('Eclipses').click()` |
| Go to event detail | `await appPage.getByText('Perseid Meteor Shower').first().click()` |
| Navigate back | `await appPage.goBack()` |

---

## CI Integration

Set the `NIGHTQUEST_URL` env var to point to a running preview deployment:

```yaml
- name: Run e2e tests
  working-directory: e2e
  env:
    NIGHTQUEST_URL: ${{ env.PREVIEW_URL }}
  run: npm test
```
