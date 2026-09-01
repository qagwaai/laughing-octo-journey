import { expect, test } from '@playwright/test';
import { OPENING_STAGE_TIMINGS_MS } from '../../src/app/model/opening-sequence';
import { setupLocaleOpeningMissionFlowTest } from '../fixtures/locale-opening-mission-flow-scenario';

test.describe('Cold boot refresh context', () => {
  test('keeps the cold-boot scan flow usable after page refresh', async ({ page }) => {
    await page.clock.install();

    const { gameShell, mock } = await setupLocaleOpeningMissionFlowTest(page, {
      characterId: 'char-refresh-1',
      characterName: 'Nova',
      missionStatus: 'not-started',
      includeMissionAndShipHandlers: true,
    });

    await gameShell.joinGame();
    await expect(page).toHaveURL(/left:opening-cold-boot/, { timeout: 10_000 });

    const reconnectAfterReload = mock.waitForNextConnect();
    mock.reset();
    await page.reload();
    await expect(page).toHaveURL(/left:opening-cold-boot/, { timeout: 10_000 });
    await reconnectAfterReload;

    // The installed clock continues in real time, so a loaded component may
    // already be at any cinematic stage under suite load. Jump beyond every
    // remaining deadline without executing every angular-three animation frame.
    await page.clock.fastForward(OPENING_STAGE_TIMINGS_MS.aiReveal);

    // The enabled action is the stable, user-observable completion state. Resume
    // normal scheduling before exercising the async mission handoff.
    const scanAction = page.locator('.scan-action');
    const scanActionButton = page.locator('.scan-action-button');
    await expect(scanAction).toHaveClass(/visible/);
    await expect(scanActionButton).toBeEnabled();
    await page.clock.resume();
    await scanActionButton.click();

    await expect(page).toHaveURL(/ship-exterior-view\(left:game-main\/\/right:opening-cold-boot-scan\)/, {
      timeout: 15_000,
    });
    await expect(page).toHaveURL(/left:game-main/, { timeout: 15_000 });
  });
});
