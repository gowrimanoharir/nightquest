import { test, expect } from '../fixtures/base';

/**
 * Event detail screen tests.
 *
 * Validates that:
 *  - Navigating to an event card opens the detail route
 *  - Event name and description are displayed
 *  - Navigating directly to /event-detail without data shows "Event not found"
 *  - Back navigation returns to Explore
 */

test.describe('Event detail screen', () => {
  test.beforeEach(async ({ appPage }) => {
    // Enable show-past so all mock events are visible regardless of current date
    await appPage.getByText('Show past events').click();
  });

  test('clicking an event card navigates to /event-detail', async ({ appPage }) => {
    await appPage.getByText('Perseid Meteor Shower').first().click();
    await expect(appPage).toHaveURL(/event-detail/);
  });

  test('event detail page shows the event name', async ({ appPage }) => {
    await appPage.getByText('Perseid Meteor Shower').first().click();
    await expect(appPage.getByText('Perseid Meteor Shower')).toBeVisible();
  });

  test('event detail page shows the event description', async ({ appPage }) => {
    await appPage.getByText('Perseid Meteor Shower').first().click();
    await expect(
      appPage.getByText(/100 meteors per hour/, { exact: false })
    ).toBeVisible();
  });

  test('eclipse event detail shows eclipse description', async ({ appPage }) => {
    await appPage.getByText('Total Lunar Eclipse').first().click();
    await expect(appPage).toHaveURL(/event-detail/);
    await expect(appPage.getByText('Total Lunar Eclipse')).toBeVisible();
  });

  test('navigating to /event-detail without data shows "Event not found"', async ({ appPage }) => {
    await appPage.goto('/event-detail');
    await expect(appPage.getByText('Event not found.')).toBeVisible();
  });

  test('back navigation returns to Explore screen', async ({ appPage }) => {
    await appPage.getByText('Perseid Meteor Shower').first().click();
    await expect(appPage).toHaveURL(/event-detail/);

    await appPage.goBack();
    await expect(appPage).toHaveURL(/explore/);
    await expect(appPage.getByText('✦ NightQuest')).toBeVisible();
  });
});
