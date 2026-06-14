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
  missions: [{ missionId: MISSION_ID, status: 'active' }],
};

const PRIMARY_SHIP = {
  id: 'd-1',
  name: 'Surveyor',
  model: 'Scavenger Pod',
  tier: 1,
  status: 'ACTIVE',
  spatial: {
    solarSystemId: 'sol',
    frame: 'barycentric',
    positionKm: { x: 1, y: 0, z: 0 },
    epochMs: 0,
  },
};

const SECONDARY_SHIP = {
  id: 'd-2',
  name: 'Pathfinder',
  model: 'Scavenger Pod',
  tier: 1,
  status: 'ACTIVE',
  spatial: {
    solarSystemId: 'sol',
    frame: 'barycentric',
    positionKm: { x: 2, y: 0, z: 0 },
    epochMs: 0,
  },
};

function characterListResponse(characters: object[]) {
  return { success: true, message: '', playerName: TEST_PLAYER, characters };
}

// ── Helper ─────────────────────────────────────────────────────────────────────

async function setupAndNavigateToShipHangar(page: Page, ships = [PRIMARY_SHIP]) {
  const mock = new SocketIOMock(page);
  const gameShell = new GameShellPage(page);
  await mock.setup();

  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: characterListResponse([CHARACTER_WITH_MISSION]),
  }));

  mock.on('game-join-request', () => null);

  // Ship-list-by-owner loads in ship-hangar
  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: {
      success: true,
      message: '',
      owner: {
        ownerType: 'player-character',
        playerId: 'player-1',
        characterId: CHARACTER_WITH_MISSION.id,
        npcId: null,
        factionId: null,
      },
      ships,
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
  test('ship badge shows hydrated active ship after joining first-target in progress', async ({ page }) => {
    await setupAndNavigateToShipHangar(page);
    const shipHangarPage = new ShipHangarPage(page);

    // Started-mission join hydrates active ship from ship-list before routing.
    const badgeName = shipHangarPage.shipBadgeName;
    await expect(badgeName).toBeVisible({ timeout: 10_000 });
    await expect(badgeName).toHaveText('Surveyor');

    await expect.poll(async () => shipHangarPage.shipItems.count(), { timeout: 20_000 }).toBeGreaterThan(0);
    await expect(shipHangarPage.shipItemByName('Surveyor')).toBeVisible({ timeout: 20_000 });

    const surveyorActiveControl = shipHangarPage.activeShipControlButtonByName('Surveyor');
    await expect(surveyorActiveControl).toHaveText('Active Ship');
    await expect(surveyorActiveControl).toBeDisabled();
  });

  test('ship badge shows active ship name after choosing another ship in hangar', async ({ page }) => {
    await setupAndNavigateToShipHangar(page, [PRIMARY_SHIP, SECONDARY_SHIP]);
    const shipHangarPage = new ShipHangarPage(page);

    // Wait for ship list to populate (headed mode can be slower to render rows)
    await expect.poll(async () => shipHangarPage.shipItems.count(), { timeout: 20_000 }).toBeGreaterThan(0);
    await expect(shipHangarPage.shipItemByName('Surveyor')).toBeVisible({ timeout: 20_000 });
    await expect(shipHangarPage.shipItemByName('Pathfinder')).toBeVisible({ timeout: 20_000 });

    const surveyorActiveControl = shipHangarPage.activeShipControlButtonByName('Surveyor');
    await expect(surveyorActiveControl).toHaveText('Active Ship');
    await expect(surveyorActiveControl).toBeDisabled();

    // Click the "Set as Active Ship" button for Pathfinder.
    const pathfinderActiveControl = shipHangarPage.activeShipControlButtonByName('Pathfinder');
    await expect(pathfinderActiveControl).toHaveText('Set as Active Ship');
    await expect(pathfinderActiveControl).toBeEnabled();
    await pathfinderActiveControl.click();

    // Badge should now reflect the chosen ship name
    const badgeName = shipHangarPage.shipBadgeName;
    await expect(badgeName).toHaveText('Pathfinder', { timeout: 10_000 });

    await expect(pathfinderActiveControl).toHaveText('Active Ship');
    await expect(pathfinderActiveControl).toBeDisabled();
  });
});
