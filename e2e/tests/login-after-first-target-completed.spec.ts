import { expect } from '@playwright/test';
import { createJoinedGameTest } from '../fixtures/joined-game-fixture';
import { registerSharedSessionHandlers } from '../fixtures/login-after-first-target-completed-scenario';
import { MissionBoardPage } from '../page-objects/mission-board.page';
import { OverlayClosePage } from '../page-objects/overlay-close.page';

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
    await expect(sharedPage).toHaveURL(/ship-exterior-view/, { timeout: 10000 });
    await expect(sharedPage).not.toHaveURL(/opening-cold-boot/);
    await expect(missionBoardPage.heading).toBeVisible({ timeout: 10000 });
  });

  test('hydrates an active ship so the exterior scene is not left without a selection', async ({
    sharedPage,
    prepareJoinedPage,
  }) => {
    await prepareJoinedPage();

    await expect(sharedPage).toHaveURL(/ship-exterior-view/, { timeout: 10000 });
    await expect(sharedPage.locator('.ship-exterior-bare-scene__title')).not.toContainText('No ship selected', {
      timeout: 10000,
    });
    await expect(sharedPage.locator('.ship-exterior-bare-scene__empty-state')).toHaveCount(0);
  });

  // This join path navigates with `{ right, left }` and no `primary`, so the primary outlet is
  // still whatever the login flow left behind. Asserting the close button's *intent* in a unit
  // test cannot catch that; only a real router can show which scene you actually land on.
  test('closing the mission board overlay lands on the ship exterior scene', async ({
    sharedPage,
    sharedGameShell,
    prepareJoinedPage,
  }) => {
    await prepareJoinedPage();

    const missionBoardPage = new MissionBoardPage(sharedPage);
    const overlayClose = new OverlayClosePage(sharedPage);

    await expect(sharedPage).toHaveURL(/right:mission-board/, { timeout: 10000 });
    await expect(missionBoardPage.heading).toBeVisible({ timeout: 10000 });

    await overlayClose.expectTuckedIntoCard(sharedPage.locator('app-mission-board-page .ops-page-container').first());

    await overlayClose.close();

    await expect(sharedPage).toHaveURL(/ship-exterior-view/, { timeout: 10000 });
    await expect(sharedPage).not.toHaveURL(/right:mission-board/);
    await expect(sharedPage).not.toHaveURL(/knot/);
    await expect(sharedPage).toHaveURL(/left:game-main/);
    await expect(overlayClose.closeButton).toHaveCount(0);

    // Backend-supplied local celestial bodies must survive the overlay round trip, so the
    // scene is never reduced to a lone ship in an empty field.
    await expect(sharedPage.locator('.ship-exterior-bare-scene__empty-state')).toHaveCount(0);

    // Restore the overlay so the worker-scoped shared page stays in its joined state.
    await sharedGameShell.openMissionBoard();
    await expect(sharedPage).toHaveURL(/right:mission-board/, { timeout: 10000 });
  });
});
