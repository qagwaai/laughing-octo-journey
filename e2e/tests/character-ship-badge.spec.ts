import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
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

function shipListByOwnerResponse(ships: object[]) {
  return {
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
  };
}

let sharedContext: BrowserContext;
let sharedPage: Page;
let sharedMock: SocketIOMock;
let sharedGameShell: GameShellPage;

function registerSharedSessionHandlers(): void {
  sharedMock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: characterListResponse([CHARACTER_WITH_MISSION]),
  }));
  sharedMock.on('game-join-request', () => null);
  sharedMock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: shipListByOwnerResponse([PRIMARY_SHIP]),
  }));
}

test.describe.configure({ mode: 'serial', timeout: 60_000 });

test.beforeAll(async ({ browser }) => {
  sharedContext = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
  sharedPage = await sharedContext.newPage();
  sharedMock = new SocketIOMock(sharedPage);
  sharedGameShell = new GameShellPage(sharedPage);

  await sharedMock.setup();
  registerSharedSessionHandlers();

  await sharedPage.goto('http://localhost:4200/(left:character-list)');
  
  // Try-catch retry-on-login pattern
  try {
    await expect(sharedPage).toHaveURL(/left:character-list/, { timeout: 10_000 });
  } catch {
    // Full-suite runs can briefly bounce back to login even after storageState hydrate.
    await loginViaUI(sharedPage, sharedMock);
    await expect(sharedPage).toHaveURL(/left:character-list/, { timeout: 10_000 });
  }

  // Pre-load login recheck
  const loginFormVisibleBeforeLoad = await sharedPage
    .locator('#playerName')
    .isVisible({ timeout: 1_000 })
    .catch(() => false);
  if (sharedPage.url().includes('left:login') || loginFormVisibleBeforeLoad) {
    await loginViaUI(sharedPage, sharedMock);
    await expect(sharedPage).toHaveURL(/left:character-list/, { timeout: 10_000 });
  }

  if ((await sharedPage.locator('.character-item').count()) === 0) {
    const loadButton = sharedPage.locator('.load-btn');
    const loadButtonVisible = (await loadButton.count()) > 0 && (await loadButton.first().isVisible());
    if (!loadButtonVisible) {
      throw new Error(`Character list is empty and load button is unavailable (url=${sharedPage.url()}).`);
    }

    await expect(loadButton.first()).toBeEnabled({ timeout: 5_000 });
    await loadButton.first().click();
    await expect(sharedPage.locator('.character-item')).toHaveCount(1, { timeout: 10_000 });
  }

  await sharedGameShell.joinGame('Join Game in Progress');
  await expect(sharedPage).toHaveURL(/left:game-main/, { timeout: 10_000 });
});

test.afterEach(async () => {
  if (!sharedPage || sharedPage.isClosed()) return;
  sharedMock.reset();
  registerSharedSessionHandlers();

  let attempts = 0;
  while (!sharedPage.url().includes('left:game-main') && attempts < 4) {
    attempts += 1;
    await sharedPage.goBack();
  }
  await expect(sharedPage).toHaveURL(/left:game-main/, { timeout: 10_000 });
});

test.afterAll(async () => {
  await sharedContext.close();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('Character ship badge', () => {
  test('ship badge shows hydrated active ship after joining first-target in progress', async () => {
    sharedMock.on('ship-list-by-owner-request', () => ({
      event: 'ship-list-by-owner-response',
      data: shipListByOwnerResponse([PRIMARY_SHIP]),
    }));

    await sharedGameShell.openShipHangar();
    const shipHangarPage = new ShipHangarPage(sharedPage);
    await shipHangarPage.waitForLoadedReadiness({
      routeContext: {
        playerName: TEST_PLAYER,
        characterId: CHARACTER_WITH_MISSION.id,
        shipId: PRIMARY_SHIP.id,
      },
      timeout: 20_000,
    });

    const badgeName = shipHangarPage.shipBadgeName;
    await expect(badgeName).toBeVisible({ timeout: 10_000 });
    await expect(badgeName).toHaveText('Surveyor');

    await shipHangarPage.waitForShipByNameVisible('Surveyor');
    await shipHangarPage.expectActiveShipControlByName('Surveyor', {
      text: 'Active Ship',
      enabled: false,
    });
  });

  test('ship badge shows active ship name after choosing another ship in hangar', async () => {
    sharedMock.on('ship-list-by-owner-request', () => ({
      event: 'ship-list-by-owner-response',
      data: shipListByOwnerResponse([PRIMARY_SHIP, SECONDARY_SHIP]),
    }));

    await sharedGameShell.openShipHangar();
    const shipHangarPage = new ShipHangarPage(sharedPage);
    await shipHangarPage.waitForLoadedReadiness({
      minimumShipCount: 2,
      routeContext: {
        playerName: TEST_PLAYER,
        characterId: CHARACTER_WITH_MISSION.id,
        shipId: PRIMARY_SHIP.id,
      },
      timeout: 20_000,
    });

    await shipHangarPage.waitForShipByNameVisible('Surveyor');
    await shipHangarPage.waitForShipByNameVisible('Pathfinder');

    await shipHangarPage.expectActiveShipControlByName('Surveyor', {
      text: 'Active Ship',
      enabled: false,
    });
    await shipHangarPage.expectActiveShipControlByName('Pathfinder', {
      text: 'Set as Active Ship',
      enabled: true,
    });
    await shipHangarPage.setActiveShipByName('Pathfinder');

    const badgeName = shipHangarPage.shipBadgeName;
    await expect(badgeName).toHaveText('Pathfinder', { timeout: 10_000 });

    await shipHangarPage.expectActiveShipControlByName('Pathfinder', {
      text: 'Active Ship',
      enabled: false,
    });
  });
});
