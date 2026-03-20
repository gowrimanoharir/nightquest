import { test, expect } from '../fixtures/base';

/**
 * Navigation smoke tests — validates shell structure across all three
 * viewport profiles (web, tablet, mobile).
 *
 * Mobile/tablet: Expo Router tab bar at the bottom.
 * Web (≥1280px): header nav links rendered in app/_layout.tsx.
 */

test.describe('App shell and navigation', () => {
  test('redirects root path to Explore tab', async ({ appPage }) => {
    await expect(appPage).toHaveURL(/\/(tabs\/)?explore/);
  });

  test('NightQuest logo is visible on Explore screen', async ({ appPage }) => {
    await expect(appPage.getByText('✦ NightQuest')).toBeVisible();
  });

  test('Explore tab is accessible', async ({ appPage }) => {
    // Web: header nav link; mobile/tablet: tab bar item
    const exploreLink = appPage.getByText('Explore').first();
    await expect(exploreLink).toBeVisible();
  });

  test('Stargaze tab is accessible', async ({ appPage }) => {
    const stargazeLink = appPage.getByText('Stargaze').first();
    await expect(stargazeLink).toBeVisible();
  });

  test('tapping Stargaze then Explore returns to Explore screen', async ({ appPage }) => {
    // Navigate to Stargaze
    await appPage.getByText('Stargaze').first().click();
    await expect(appPage).toHaveURL(/stargaze/);

    // Navigate back to Explore
    await appPage.getByText('Explore').first().click();
    await expect(appPage).toHaveURL(/explore/);
    await expect(appPage.getByText('✦ NightQuest')).toBeVisible();
  });
});
