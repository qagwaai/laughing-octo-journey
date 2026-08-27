import { expect, type Page } from '@playwright/test';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { SocketIOMock } from './socket-mock';

export const LEAVE_GAME_CHARACTER_ID = 'char-leave-game';
const FIRST_TARGET_MISSION_ID = 'first-target';

/**
 * Registers all socket handlers needed to log in, load characters (with
 * first-target completed so join routes to game-main), and navigate back
 * to the character list via the logout page.
 */
export function configureLeaveGameSessionMock(mock: SocketIOMock): void {
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
          // completed first-target → join routes to game-main + mission-board
          missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'completed' }],
        },
      ],
    },
  }));

  mock.on('game-join-request', () => null);

  mock.on('list-missions-request', () => ({
    event: 'list-missions-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: LEAVE_GAME_CHARACTER_ID,
      missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'completed' }],
    },
  }));

  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: LEAVE_GAME_CHARACTER_ID,
      ships: [],
    },
  }));
}

/**
 * Sets up the browser at the logout page reached via the normal join flow.
 *
 * Postconditions:
 * - URL contains `left:logout`
 * - The "Leave this game session" button is visible
 */
export async function setupLeaveGameSessionTest(page: Page): Promise<{
  mock: SocketIOMock;
  gameShell: GameShellPage;
  leaveButton: ReturnType<Page['locator']>;
}> {
  const mock = new SocketIOMock(page);
  const gameShell = new GameShellPage(page);

  await mock.setup();
  configureLeaveGameSessionMock(mock);
  await loginViaUI(page, mock);

  await gameShell.joinGame();
  await expect(page).toHaveURL(/left:game-main/, { timeout: 15_000 });

  await gameShell.openNav('Logout');
  await expect(page).toHaveURL(/left:logout/, { timeout: 10_000 });

  const leaveButton = page.locator('button.character-list-link');
  await expect(leaveButton).toBeVisible({ timeout: 5_000 });

  return { mock, gameShell, leaveButton };
}
