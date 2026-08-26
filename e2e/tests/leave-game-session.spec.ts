import { expect, test } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { CharacterListPage } from '../page-objects/character-list.page';
import {
  configureLeaveGameSessionMock,
  LEAVE_GAME_CHARACTER_ID,
  setupLeaveGameSessionTest,
} from '../fixtures/leave-game-session-scenario';

/**
 * Regression guard for the "Leave this game session" navigation flow.
 *
 * Before the fix, clicking this button from ship-exterior-view caused a
 * NavigationError (NG0201: NgtStore not provided) that left both panes blank
 * and the URL unchanged. The fix routes primary to 'intro' instead of 'knot'
 * so the ngt-canvas is never required during the transition.
 */

test.describe('Leave game session — navigation regression', () => {
  test('navigates to character-list in left pane when leaving from game-main', async ({ page }) => {
    const characterListPage = new CharacterListPage(page);
    const { leaveButton } = await setupLeaveGameSessionTest(page);

    await leaveButton.click();

    // Left pane must show the character list — not blank, not login
    await expect(page).toHaveURL(/left:character-list/, { timeout: 10_000 });

    // Right outlet must be cleared
    expect(page.url()).not.toMatch(/right:/);

    // The character list page itself must be visible and functional
    await expect(characterListPage.heading).toBeVisible({ timeout: 5_000 });
  });

  test('navigates to character-list in left pane when leaving from ship-exterior-view + cold-boot-scan', async ({
    page,
  }) => {
    const mock = new SocketIOMock(page);
    const characterListPage = new CharacterListPage(page);

    await mock.setup();
    configureLeaveGameSessionMock(mock);

    // Log in first so the Angular app has an in-memory session
    await loginViaUI(page, mock);

    // Navigate to the exact URL that was the reported regression scenario,
    // using domcontentloaded to avoid hanging on socket connections
    await page.goto(
      'http://localhost:4200/ship-exterior-view(left:logout//right:opening-cold-boot-scan)',
      { waitUntil: 'domcontentloaded' },
    );

    // Wait for Angular to process the route and render the logout page in the left pane
    await expect(page.locator('button.character-list-link')).toBeVisible({ timeout: 15_000 });

    // Register a fresh handler for the character-list request that will follow navigation
    mock.on('character-list-request', () => ({
      event: 'character-list-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        characters: [
          {
            id: LEAVE_GAME_CHARACTER_ID,
            characterName: 'Navigator Yael',
            level: 4,
            missions: [],
          },
        ],
      },
    }));

    await page.locator('button.character-list-link').click();

    // Both panes must render — URL changes and both stale routes are cleared
    await expect(page).toHaveURL(/left:character-list/, { timeout: 10_000 });
    expect(page.url()).not.toMatch(/right:/);
    expect(page.url()).not.toMatch(/ship-exterior-view/);

    // Character list page is visible — neither pane is blank
    await expect(characterListPage.heading).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('app-character-list-page')).toBeVisible();
  });
});
