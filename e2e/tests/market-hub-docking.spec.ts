import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { MarketHubPage } from '../page-objects/market-hub.page';

const CHARACTER = {
  id: 'char-market-2',
  characterName: 'Dockmaster',
  level: 4,
  missions: [{ missionId: 'first-target', status: 'active' }],
};

const SHIP_WITH_POSITION = {
  id: `starter-pod-${CHARACTER.id}`,
  name: 'Scavenger Pod',
  model: 'Scavenger Pod',
  tier: 1,
  driveProfile: {
    id: 'rapid-transit',
    name: 'Rapid Transit Thruster',
    rangeAu: 0.8,
    cruiseSpeedAuPerHour: 0.4,
    fuelCostPerAu: 4,
  },
  status: 'ACTIVE',
  spatial: {
    solarSystemId: 'sol',
    frame: 'barycentric',
    positionKm: { x: 413_700_100, y: 0, z: 0 },
    epochMs: 1_777_777_888_000,
  },
  motion: {
    velocityKmPerSec: { x: 0, y: 0, z: 0 },
    angularVelocityRadPerSec: {
      x: 0,
      y: 0,
      z: 0,
    },
  },
  observability: {
    sensorConfidence: 1,
    source: {
      solarSystemId: 'sol',
      sourceType: 'server-feed',
      observedAt: new Date(1_777_777_888_000).toISOString(),
    },
  },
};

type MarketByLocationRequest = {
  distanceAu: number;
};

let sharedContext: BrowserContext;
let sharedPage: Page;
let sharedMock: SocketIOMock;
let sharedGameShell: GameShellPage;
let sharedMarketHubPage: MarketHubPage;

function registerSharedSessionHandlers(): void {
  sharedMock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characters: [CHARACTER],
    },
  }));

  sharedMock.on('game-join', () => null);

  sharedMock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: CHARACTER.id,
      ships: [SHIP_WITH_POSITION],
    },
  }));
}

function registerDefaultMarketHandler(onRequest: (request: MarketByLocationRequest) => void): void {
  sharedMock.on('market-list-by-location-request', (payload) => {
    const request = payload as MarketByLocationRequest;
    onRequest(request);

    return {
      event: 'market-list-by-location-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        solarSystemId: 'sol',
        positionKm: SHIP_WITH_POSITION.spatial.positionKm,
        distanceAu: request.distanceAu,
        locationTypes: ['station'],
        isDocked: true,
        dockedMarketId: 'sol-ceres-exchange',
        markets: [
          {
            marketId: 'sol-ceres-exchange',
            solarSystemId: 'sol',
            marketName: 'Ceres Exchange',
            siteType: 'station',
            siteName: 'Ceres Belt Trade Ring',
            spatial: {
              solarSystemId: 'sol',
              frame: 'barycentric',
              positionKm: { x: 413_700_102.5, y: 0, z: 0 },
              epochMs: Date.now(),
            },
            distanceAu: 0.02,
            isDocked: true,
            priceMultiplier: 1,
            driftPercentPerHour: 6,
            restockIntervalMinutes: 60,
          },
          {
            marketId: 'sol-remote-market',
            solarSystemId: 'sol',
            marketName: 'Remote Market',
            siteType: 'station',
            siteName: 'Outer Arc',
            spatial: {
              solarSystemId: 'sol',
              frame: 'barycentric',
              positionKm: { x: 413_700_440.2, y: 0, z: 0 },
              epochMs: Date.now(),
            },
            distanceAu: 0.6,
            isDocked: false,
            priceMultiplier: 1,
            driftPercentPerHour: 6,
            restockIntervalMinutes: 60,
          },
        ],
      },
    };
  });
}

function registerCrossSystemMarketHandler(): void {
  sharedMock.on('market-list-by-location-request', (payload) => {
    const request = payload as MarketByLocationRequest;
    return {
      event: 'market-list-by-location-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        solarSystemId: 'sol',
        positionKm: SHIP_WITH_POSITION.spatial.positionKm,
        distanceAu: request.distanceAu,
        locationTypes: ['station'],
        isDocked: true,
        dockedMarketId: 'sol-ceres-exchange',
        markets: [
          {
            marketId: 'sol-ceres-exchange',
            solarSystemId: 'sol',
            marketName: 'Ceres Exchange',
            siteType: 'station',
            siteName: 'Ceres Belt Trade Ring',
            spatial: {
              solarSystemId: 'sol',
              frame: 'barycentric',
              positionKm: { x: 413_700_102.5, y: 0, z: 0 },
              epochMs: Date.now(),
            },
            distanceAu: 0.02,
            isDocked: true,
            priceMultiplier: 1,
            driftPercentPerHour: 6,
            restockIntervalMinutes: 60,
          },
          {
            marketId: 'alpha-centauri-station',
            solarSystemId: 'alpha-centauri',
            marketName: 'Alpha Station',
            siteType: 'station',
            siteName: 'Alpha Centauri Hub',
            spatial: {
              solarSystemId: 'alpha-centauri',
              frame: 'barycentric',
              positionKm: { x: 0, y: 0, z: 0 },
              epochMs: Date.now(),
            },
            distanceAu: null,
            isDocked: false,
            priceMultiplier: 1.1,
            driftPercentPerHour: 8,
            restockIntervalMinutes: 120,
            route: { kind: 'gate-route', hops: 1 },
          },
        ],
      },
    };
  });
}

async function setupSharedMarketHubDockingSession(browser: Browser): Promise<void> {
  sharedContext = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
  sharedPage = await sharedContext.newPage();
  sharedMock = new SocketIOMock(sharedPage);
  sharedGameShell = new GameShellPage(sharedPage);
  sharedMarketHubPage = new MarketHubPage(sharedPage);

  await sharedMock.setup();
  registerSharedSessionHandlers();
  registerDefaultMarketHandler(() => {});

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
}

async function resetSharedMarketHubDockingSession(): Promise<void> {
  if (!sharedPage || sharedPage.isClosed()) {
    return;
  }

  sharedMock.reset();
  registerSharedSessionHandlers();

  let attempts = 0;
  while (!sharedPage.url().includes('left:game-main') && attempts < 4) {
    attempts += 1;
    await sharedPage.goBack();
  }

  await expect(sharedPage).toHaveURL(/left:game-main/, { timeout: 10_000 });
}

async function setupAndOpenMarketHub(onRequest: (request: MarketByLocationRequest) => void) {
  sharedMock.reset();
  registerSharedSessionHandlers();
  registerDefaultMarketHandler(onRequest);

  await sharedGameShell.openMarketHub();
}

test.describe.configure({ mode: 'serial', timeout: 60_000 });

test.beforeAll(async ({ browser }) => {
  await setupSharedMarketHubDockingSession(browser);
});

test.afterEach(async () => {
  await resetSharedMarketHubDockingSession();
});

test.afterAll(async () => {
  await sharedContext.close();
});

test.describe('Market Hub docking and radius behavior', () => {
  test('shows in-system route badge for local non-docked market', async () => {
    const requests: MarketByLocationRequest[] = [];
    await setupAndOpenMarketHub((request) => requests.push(request));

    await expect
      .poll(
        async () => {
          if (requests.length === 0) {
            await sharedMarketHubPage.reloadButton.click();
          }
          return requests.length;
        },
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);

    const marketRows = sharedMarketHubPage.marketItems;
    const remoteMarket = marketRows.nth(1);

    await expect(remoteMarket).toContainText('Remote Market');
    await expect(remoteMarket).toContainText('In-system');
  });

  test('docked cross-system market: gate-route badge shown, transact disabled when not docked there', async () => {
    sharedMock.reset();
    registerSharedSessionHandlers();
    registerCrossSystemMarketHandler();

    await sharedGameShell.openMarketHub();

    await expect
      .poll(
        async () => {
          const count = await sharedMarketHubPage.marketItems.count();
          if (count === 0) {
            await sharedMarketHubPage.reloadButton.click();
          }
          return count;
        },
        { timeout: 15_000 },
      )
      .toBe(2);

    const marketRows = sharedMarketHubPage.marketItems;

    const dockedMarket = marketRows.nth(0);
    await expect(dockedMarket).toContainText('Ceres Exchange');
    await expect(dockedMarket).toContainText('In-system');
    await expect(dockedMarket.locator('.transact-btn')).toBeEnabled();

    const crossSystemMarket = marketRows.nth(1);
    await expect(crossSystemMarket).toContainText('Alpha Station');
    await expect(crossSystemMarket).toContainText('1 gate hop');
    await expect(crossSystemMarket.locator('.transact-btn')).toBeDisabled();
  });

  test('enables transact only for docked market and refreshes with selected radius', async () => {
    const requests: MarketByLocationRequest[] = [];
    await setupAndOpenMarketHub((request) => requests.push(request));

    await expect
      .poll(
        async () => {
          if (requests.length === 0) {
            await sharedMarketHubPage.reloadButton.click();
          }
          return requests.length;
        },
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);

    const marketRows = sharedMarketHubPage.marketItems;
    await expect(marketRows).toHaveCount(2);

    const dockedMarket = marketRows.nth(0);
    const remoteMarket = marketRows.nth(1);

    await expect(dockedMarket).toContainText('Ceres Exchange');
    await expect(remoteMarket).toContainText('Remote Market');
    await expect(remoteMarket).toContainText('In-system');

    await expect(dockedMarket.locator('.transact-btn')).toBeEnabled();
    await expect(remoteMarket.locator('.transact-btn')).toBeDisabled();
    await expect(remoteMarket.locator('.dock-required-badge', { hasText: 'Dock required' })).toBeVisible();
    await expect(sharedPage.getByText('Rapid Transit Thruster').first()).toBeVisible();

    await sharedPage.selectOption('#radiusAu', '1');
    const applyRadiusButton = sharedPage.getByRole('button', { name: /apply radius/i });
    if ((await applyRadiusButton.count()) > 0) {
      await applyRadiusButton.click();
    }

    await expect
      .poll(() => requests.some((request) => request.distanceAu === 1), { timeout: 10_000 })
      .toBe(true);
  });
});
