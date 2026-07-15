import { expect, test } from '@playwright/test';
import {
  setupLocaleOpeningMissionFlowTest,
} from '../fixtures/locale-opening-mission-flow-scenario';
import { MissionBoardPage } from '../page-objects/mission-board.page';

test.describe('Locale opening and mission flow', () => {
  test('shows Italian opening sequence text for a fresh mission join', async ({ page }) => {
    const { gameShell } = await setupLocaleOpeningMissionFlowTest(page, {
      characterId: 'char-it-1',
      characterName: 'Nova',
      missionStatus: 'not-started',
    });

    await gameShell.joinGame();

    await expect(page).toHaveURL(/left:opening-cold-boot/, { timeout: 10_000 });
    await expect(page.locator('.cold-boot-container h1')).toHaveText('Sequenza iniziale: Cold Boot');
    await expect(page.locator('.cold-boot-container .eyebrow')).toHaveText('Bootstrap missione');

    const scanAction = page.locator('.scan-action');
    await expect(scanAction).toHaveClass(/visible/, { timeout: 8_000 });
    await expect(scanAction.locator('p').first()).toHaveText(
      /Avviare la scansione della regione vicina per raccogliere materie prime/,
    );
    await expect(scanAction.locator('button.scan-action-button')).toHaveText('Avvia scansione?');
  });

  test('shows Italian mission board text after joining an in-progress mission', async ({ page }) => {
    const { gameShell } = await setupLocaleOpeningMissionFlowTest(page, {
      characterId: 'char-it-2',
      characterName: 'Astra',
      missionStatus: 'active',
      includeMissionAndShipHandlers: true,
    });
    const missionBoardPage = new MissionBoardPage(page);

    await gameShell.joinGame();
    await expect(page).toHaveURL(/left:game-main/, { timeout: 10_000 });
    await expect(page.locator('.page-main h1')).toHaveText('Principale gioco');

    await gameShell.openMissionBoard();

    const missionBoardRoot = page.locator('app-mission-board-page .ops-page-container').first();

    await expect(page).toHaveURL(/right:mission-board/, { timeout: 10_000 });
    await expect(missionBoardPage.heading).toHaveText('Bacheca missioni');
    await expect(page.locator('app-mission-board-page .page-main .subtitle').first()).toHaveText(
      'Missioni attive e completate per questo personaggio.',
    );
    await expect(missionBoardRoot.locator('.ops-card h2').first()).toHaveText('Registro missioni');
    await expect(missionBoardRoot.locator('.ops-card > p').first()).toHaveText(
      'Tutti i progressi missione registrati per questo personaggio.',
    );
  });
});
