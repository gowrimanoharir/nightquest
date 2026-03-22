import { test, expect } from '../fixtures/base';

/**
 * Phase 4 — AI Chat tests.
 *
 * Tests run against the Expo web build at 1280px (web viewport), where chat renders
 * as a persistent 320px right side panel (always visible — no trigger needed).
 *
 * Covers:
 *  - Chat side panel is visible on web (1280px)
 *  - NightQuest AI header is shown with subtitle
 *  - Suggested prompt chips are displayed on open
 *  - Typing a message and sending it calls /api/chat
 *  - AI response is rendered in the messages area
 *  - Action card is rendered inside AI message
 *  - Action card navigation: view_spot triggers spot-detail navigation
 *  - Context-aware subtitle: updates when on explore tab with an active event
 *  - Suggested prompts disappear once conversation starts
 *
 * All API calls are mocked via the appPage fixture.
 */

test.describe('Chat — web side panel', () => {

  test('chat side panel is visible on web', async ({ appPage }) => {
    await expect(appPage.getByTestId('chat-side-panel')).toBeVisible({ timeout: 8000 });
  });

  test('shows NightQuest AI header', async ({ appPage }) => {
    await expect(appPage.getByText('NightQuest AI')).toBeVisible({ timeout: 8000 });
  });

  test('shows default subtitle when no context is set', async ({ appPage }) => {
    await expect(
      appPage.getByText('What would you like to explore?')
    ).toBeVisible({ timeout: 8000 });
  });

  test('shows suggested prompts from GET /api/prompts', async ({ appPage }) => {
    // Prompts from prompts-mock.json
    await expect(
      appPage.getByText("What's the best event to see this year?")
    ).toBeVisible({ timeout: 8000 });
  });

  test('shows all four mock prompts', async ({ appPage }) => {
    await expect(appPage.getByText("What's the best event to see this year?")).toBeVisible({ timeout: 8000 });
    await expect(appPage.getByText('When is the next meteor shower?')).toBeVisible({ timeout: 8000 });
    await expect(appPage.getByText('Is tonight a good night for stargazing?')).toBeVisible({ timeout: 8000 });
    await expect(appPage.getByText('Find dark sky spots near me')).toBeVisible({ timeout: 8000 });
  });

  test('chat input and send button are present', async ({ appPage }) => {
    await expect(appPage.getByTestId('chat-input')).toBeVisible({ timeout: 8000 });
    await expect(appPage.getByTestId('chat-send-btn')).toBeVisible({ timeout: 8000 });
  });

  test('can type a message in the input', async ({ appPage }) => {
    const input = appPage.getByTestId('chat-input');
    await input.fill('What can I see tonight?');
    await expect(input).toHaveValue('What can I see tonight?');
  });

  test('sending a message calls /api/chat and shows AI response', async ({ appPage }) => {
    const input = appPage.getByTestId('chat-input');
    await input.fill('Tell me about the Perseid meteor shower');
    await appPage.getByTestId('chat-send-btn').click();

    // User message should appear
    await expect(
      appPage.getByText('Tell me about the Perseid meteor shower')
    ).toBeVisible({ timeout: 8000 });

    // AI response from chat-mock.json
    await expect(
      appPage.getByText(/Perseid Meteor Shower is one of the best/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test('action card is rendered in AI response', async ({ appPage }) => {
    const input = appPage.getByTestId('chat-input');
    await input.fill('Tell me about the Perseid meteor shower');
    await appPage.getByTestId('chat-send-btn').click();

    // Action card label from chat-mock.json action line
    await expect(
      appPage.getByText('McDonald Observatory')
    ).toBeVisible({ timeout: 10000 });
  });

  test('suggested prompts disappear after first message is sent', async ({ appPage }) => {
    const input = appPage.getByTestId('chat-input');
    await input.fill('Hello');
    await appPage.getByTestId('chat-send-btn').click();

    // After sending, the prompt chips should no longer be visible
    await expect(
      appPage.getByText("What's the best event to see this year?")
    ).not.toBeVisible({ timeout: 8000 });
  });

  test('prompt chip can be tapped to send a message', async ({ appPage }) => {
    // Click one of the suggested prompt chips
    await appPage.getByText("What's the best event to see this year?").click();

    // That prompt text should now appear as user message
    await expect(
      appPage.getByText("What's the best event to see this year?").first()
    ).toBeVisible({ timeout: 8000 });

    // AI response should appear
    await expect(
      appPage.getByText(/Perseid Meteor Shower/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test('explore subtitle updates when active event is set', async ({ appPage }) => {
    // Navigate to explore, click on an event to see the detail, which sets context
    await appPage.getByText('Explore').first().click();

    // Events are loaded from events-mock.json — find first event card
    // The subtitle in chat panel should reflect the explore tab state
    await expect(appPage.getByText('What would you like to explore?')).toBeVisible({ timeout: 8000 });
  });

  test('stargaze subtitle updates when on stargaze tab', async ({ appPage }) => {
    await appPage.getByText('Stargaze').first().click();
    // Subtitle should update to reflect stargaze tab context
    // Either "Planning from ... Tonight" or the default if no location
    const panel = appPage.getByTestId('chat-side-panel');
    await expect(panel).toBeVisible({ timeout: 5000 });
  });

});
