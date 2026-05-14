import { expect, test, type Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { ShipHangarPage } from '../page-objects/ship-hangar.page';

// ── Shared test data ───────────────────────────────────────────────────────────

const MISSION_ID = 'first-target';

// Character with a started mission — join button reads "Join Game in Progress"
// which navigates directly to game-main, bypassing the opening-cold-boot sequence.
const CHARACTER_WITH_MISSION = {
  id: 'char-1',
  characterName: 'Nova-Prime',
  level: 5,
  missions: [{ missionId: MISSION_ID, status: 'started' }],
};

const SHIP = { id: 'd-1', name: 'Surveyor', model: 'Scavenger Pod', tier: 1, status: 'ACTIVE' };

function characterListResponse(characters: object[]) {
  return { success: true, message: '', playerName: TEST_PLAYER, characters };
}

// ── Helper ─────────────────────────────────────────────────────────────────────

async function setupAndNavigateToShipHangar(page: Page) {
  const mock = new SocketIOMock(page);
  const gameShell = new GameShellPage(page);
  await mock.setup();

  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: characterListResponse([CHARACTER_WITH_MISSION]),
  }));

  mock.on('game-join-request', () => null);

  // Ship-list loads in ship-hangar
  mock.on('ship-list-request', () => ({
    event: 'ship-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: CHARACTER_WITH_MISSION.id,
      ships: [SHIP],
    },
  }));

  await loginViaUI(page, mock);

  // Join in-progress game — goes directly to game-main
  await gameShell.joinGame('Join Game in Progress');
  await expect(page).toHaveURL(/left:game-main/, { timeout: 10_000 });

  // Navigate to ship-hangar via the left outlet
  await gameShell.openShipHangar();

  return { mock };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('Character ship badge', () => {
  test('ship badge defaults to "Scavenger Pod" when joining first-target in progress', async ({ page }) => {
    await setupAndNavigateToShipHangar(page);
    const shipHangarPage = new ShipHangarPage(page);

    // first-target in-progress join seeds active ship to the starter pod
    const badgeName = shipHangarPage.shipBadgeName;
    await expect(badgeName).toBeVisible({ timeout: 10_000 });
    await expect(badgeName).toHaveText('Scavenger Pod');
  });

  test('ship badge shows active ship name after clicking "Set as Active Ship"', async ({ page }) => {
    await setupAndNavigateToShipHangar(page);
    const shipHangarPage = new ShipHangarPage(page);

    // Wait for ship list to populate (headed mode can be slower to render rows)
    await expect.poll(async () => shipHangarPage.shipItems.count(), { timeout: 20_000 }).toBeGreaterThan(0);
    await expect(shipHangarPage.shipItem(0)).toBeVisible({ timeout: 20_000 });

    // Click the "Set as Active Ship" button for the first ship row
    await shipHangarPage.setActiveShipButton(0).click();

    // Badge should now reflect the chosen ship name
    const badgeName = shipHangarPage.shipBadgeName;
    await expect(badgeName).toHaveText('Surveyor', { timeout: 10_000 });
  });
});
