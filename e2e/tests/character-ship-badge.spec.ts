import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import {
  CHARACTER_WITH_MISSION,
  PRIMARY_SHIP,
  registerCharacterShipBadgeSessionHandlers,
  SECONDARY_SHIP,
  shipListByOwnerResponse,
} from '../fixtures/character-ship-badge-scenario';
import { bootstrapSharedGameMainSession } from '../fixtures/shared-session-bootstrap';
import { SocketIOMock } from '../fixtures/socket-mock';
import { TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { ShipHangarPage } from '../page-objects/ship-hangar.page';

let sharedContext: BrowserContext;
let sharedPage: Page;
let sharedMock: SocketIOMock;
let sharedGameShell: GameShellPage;

test.describe.configure({ mode: 'serial', timeout: 60_000 });

test.beforeAll(async ({ browser }) => {
  sharedContext = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
  sharedPage = await sharedContext.newPage();
  sharedMock = new SocketIOMock(sharedPage);
  sharedGameShell = new GameShellPage(sharedPage);

  await sharedMock.setup();
  await bootstrapSharedGameMainSession({
    page: sharedPage,
    mock: sharedMock,
    gameShell: sharedGameShell,
    registerSessionHandlers: (mock) => registerCharacterShipBadgeSessionHandlers(mock, [PRIMARY_SHIP]),
  });
});

test.afterEach(async () => {
  if (!sharedPage || sharedPage.isClosed()) return;
  sharedMock.reset();
  registerCharacterShipBadgeSessionHandlers(sharedMock, [PRIMARY_SHIP]);

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

    const shipHangarPage = new ShipHangarPage(sharedPage);
    await shipHangarPage.openAndWaitForLoadedReadiness({
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

    const shipHangarPage = new ShipHangarPage(sharedPage);
    await shipHangarPage.openAndWaitForLoadedReadiness({
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
