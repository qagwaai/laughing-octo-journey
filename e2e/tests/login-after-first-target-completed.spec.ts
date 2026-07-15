import { expect, test, type Page, type Browser } from '@playwright/test';
import {
  CHARACTER_WITH_COMPLETED_FIRST_TARGET,
  registerSharedSessionHandlers,
} from '../fixtures/login-after-first-target-completed-scenario';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { MissionBoardPage } from '../page-objects/mission-board.page';

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

    registerSharedSessionHandlers(sharedMock);
    await loginViaUI(sharedPage, sharedMock);
  });

  test.afterAll(async () => {
    await sharedPage.close();
  });

  test.afterEach(async () => {
    if (!sharedPage || sharedPage.isClosed()) return;
    sharedMock.reset();
    registerSharedSessionHandlers(sharedMock);

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
