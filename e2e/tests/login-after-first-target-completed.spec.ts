import { expect, test, type Page, type Browser } from '@playwright/test';
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

function registerSharedSessionHandlers(): void {
  sharedMock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: characterListResponse([characterWithCompletedFirstTarget]),
  }));

  sharedMock.on('game-join-request', () => null);

  sharedMock.on('list-missions-request', () => ({
    event: 'list-missions-response',
    data: missionListResponse(),
  }));
}

let sharedPage: Page;
let sharedMock: SocketIOMock;
let sharedGameShell: GameShellPage;

test.describe.configure({ mode: 'serial' });
test.describe('Login Resume — first-target completed', () => {
  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    sharedPage = await browser.newPage();
    sharedMock = new SocketIOMock(sharedPage);
    await sharedMock.setup();
    sharedGameShell = new GameShellPage(sharedPage);

    registerSharedSessionHandlers();
    await loginViaUI(sharedPage, sharedMock);
  });

  test.afterAll(async () => {
    await sharedPage.close();
  });

  test.afterEach(async () => {
    if (!sharedPage || sharedPage.isClosed()) return;
    sharedMock.reset();
    registerSharedSessionHandlers();

    const baseUrl = 'http://localhost:4200/login';
    await sharedPage.goto(baseUrl);
  });

  test('routes to game-main + mission-board instead of cold boot after login and join', async () => {
    const missionBoardPage = new MissionBoardPage(sharedPage);

    const joinButton = sharedGameShell.joinButton();
    await expect(joinButton).toBeVisible({ timeout: 10000 });
    await expect(joinButton).toBeEnabled({ timeout: 10000 });
    await sharedGameShell.joinGame();

    await expect(sharedPage).toHaveURL(/left:game-main/, { timeout: 10000 });
    await expect(sharedPage).toHaveURL(/right:mission-board/, { timeout: 10000 });
    await expect(sharedPage).not.toHaveURL(/opening-cold-boot/);

    const missionBoardHeading = missionBoardPage.heading;
    await expect(missionBoardHeading).toBeVisible({ timeout: 10000 });
  });
});
