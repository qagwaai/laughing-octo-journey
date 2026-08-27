import { expect } from '@playwright/test';
import {
  registerSharedSessionHandlers,
} from '../fixtures/login-after-first-target-completed-scenario';
import { createJoinedGameTest } from '../fixtures/joined-game-fixture';
import { MissionBoardPage } from '../page-objects/mission-board.page';

const test = createJoinedGameTest({
  registerSessionHandlers: registerSharedSessionHandlers,
  joinButtonText: 'Join Game in Progress',
});

test.describe('Login Resume — first-target completed', () => {
  test('routes to game-main + mission-board instead of cold boot after login and join', async ({
    sharedPage,
    prepareJoinedPage,
  }) => {
    await prepareJoinedPage();

    const missionBoardPage = new MissionBoardPage(sharedPage);

    await expect(sharedPage).toHaveURL(/left:game-main/, { timeout: 10000 });
    await expect(sharedPage).toHaveURL(/right:mission-board/, { timeout: 10000 });
    await expect(sharedPage).not.toHaveURL(/opening-cold-boot/);
    await expect(missionBoardPage.heading).toBeVisible({ timeout: 10000 });
  });
});
