import { expect, test } from '@playwright/test';
import { setupLocaleOpeningMissionFlowTest } from '../fixtures/locale-opening-mission-flow-scenario';

test.describe('Cold boot refresh context', () => {
  test('keeps the cold-boot scan flow usable after page refresh', async ({ page }) => {
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

    const scanActionButton = page.locator('.scan-action-button');
    await expect(page.locator('.scan-action')).toHaveClass(/visible/, { timeout: 15_000 });
    await scanActionButton.evaluate((button) => {
      (button as HTMLButtonElement).click();
    });

    await expect(page).toHaveURL(/ship-exterior-view\(left:game-main\/\/right:opening-cold-boot-scan\)/, {
      timeout: 15_000,
    });
    await expect(page).toHaveURL(/left:game-main/, { timeout: 15_000 });
  });
});
