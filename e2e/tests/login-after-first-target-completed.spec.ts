import { expect, test, type Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { MissionBoardPage } from '../page-objects/mission-board.page';

const FIRST_TARGET_MISSION_ID = 'first-target';

const characterWithCompletedFirstTarget = {
  id: 'char-complete-1',
  characterName: 'Survey Veteran',
  level: 8,
  missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'completed' }],
};

function characterListResponse(characters: object[]) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    characters,
  };
}

function missionListResponse() {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    characterId: characterWithCompletedFirstTarget.id,
    missions: [
      {
        missionId: FIRST_TARGET_MISSION_ID,
        status: 'completed',
        completedAt: '2026-05-10T00:00:00.000Z',
        updatedAt: '2026-05-10T00:00:00.000Z',
      },
    ],
  };
}

async function setupCompletedFirstTargetLogin(page: Page) {
  const mock = new SocketIOMock(page);
  await mock.setup();

  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: characterListResponse([characterWithCompletedFirstTarget]),
  }));

  mock.on('game-join-request', () => null);
  mock.on('list-missions-request', () => ({
    event: 'list-missions-response',
    data: missionListResponse(),
  }));

  await loginViaUI(page, mock);
  return { mock };
}

test.describe('Login Resume — first-target completed', () => {
  test('routes to game-main + mission-board instead of cold boot after login and join', async ({ page }) => {
    await setupCompletedFirstTargetLogin(page);
    const gameShell = new GameShellPage(page);
    const missionBoardPage = new MissionBoardPage(page);

    const joinButton = gameShell.joinButton();
    await expect(joinButton).toBeVisible({ timeout: 10000 });
    await expect(joinButton).toBeEnabled({ timeout: 10000 });
    await gameShell.joinGame();

    await expect(page).toHaveURL(/left:game-main/, { timeout: 10000 });
    await expect(page).toHaveURL(/right:mission-board/, { timeout: 10000 });
    await expect(page).not.toHaveURL(/opening-cold-boot/);

    const missionBoardHeading = missionBoardPage.heading;
    await expect(missionBoardHeading).toBeVisible({ timeout: 10000 });
  });
});
