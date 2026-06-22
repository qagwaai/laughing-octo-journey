import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { MarketHubPage } from '../page-objects/market-hub.page';

const CHARACTER = {
  id: 'char-market-cross-1',
  characterName: 'Gate Runner',
  level: 5,
  missions: [{ missionId: 'first-target', status: 'active' }],
};

const SHIP_IN_SOL = {
  id: `scout-pod-${CHARACTER.id}`,
  name: 'Scout Pod',
  model: 'Scout Pod',
  tier: 1,
  driveProfile: {
    id: 'standard-cruise',
    name: 'Standard Cruise Drive',
    rangeAu: 0.5,
    cruiseSpeedAuPerHour: 0.3,
    fuelCostPerAu: 1,
  },
  status: 'ACTIVE',
  spatial: {
    solarSystemId: 'sol',
    frame: 'barycentric',
    positionKm: { x: 413_700_000, y: 0, z: 0 },
    epochMs: 1_777_777_777_000,
  },
  motion: {
    velocityKmPerSec: { x: 0, y: 0, z: 0 },
    angularVelocityRadPerSec: { x: 0, y: 0, z: 0 },
  },
  observability: {
    sensorConfidence: 1,
    source: {
      solarSystemId: 'sol',
      sourceType: 'server-feed',
      observedAt: new Date(1_777_777_777_000).toISOString(),
    },
  },
};

type MarketByLocationRequest = {
  playerName: string;
  sessionKey: string;
  solarSystemId: string;
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
      ships: [SHIP_IN_SOL],
    },
  }));
}

function registerDefaultMarketHandler(onRequest: (req: MarketByLocationRequest) => void): void {
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
        positionKm: SHIP_IN_SOL.spatial.positionKm,
        distanceAu: request.distanceAu,
        locationTypes: ['station'],
        isDocked: false,
        dockedMarketId: null,
        markets: [
          {
            marketId: 'sol-near-station',
            solarSystemId: 'sol',
            marketName: 'Near Station',
            siteType: 'station',
            siteName: 'Sol Core Ring',
            spatial: {
              solarSystemId: 'sol',
              frame: 'barycentric',
              positionKm: { x: 413_700_400, y: 0, z: 0 },
              epochMs: Date.now(),
            },
            distanceAu: 0.003,
            isDocked: false,
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
          {
            marketId: 'barnards-star-depot',
            solarSystemId: 'barnards-star',
            marketName: "Barnard's Depot",
            siteType: 'station',
            siteName: "Barnard's Star Freight Depot",
            spatial: {
              solarSystemId: 'barnards-star',
              frame: 'barycentric',
              positionKm: { x: 0, y: 0, z: 0 },
              epochMs: Date.now(),
            },
            distanceAu: null,
            isDocked: false,
            priceMultiplier: 1.3,
            driftPercentPerHour: 10,
            restockIntervalMinutes: 180,
            route: { kind: 'gate-route', hops: 2 },
          },
          {
            marketId: 'wolf-359-outpost',
            solarSystemId: 'wolf-359',
            marketName: 'Wolf-359 Outpost',
            siteType: 'station',
            siteName: 'Wolf-359 Fringe Station',
            spatial: {
              solarSystemId: 'wolf-359',
              frame: 'barycentric',
              positionKm: { x: 0, y: 0, z: 0 },
              epochMs: Date.now(),
            },
            distanceAu: null,
            isDocked: false,
            priceMultiplier: 1.5,
            driftPercentPerHour: 12,
            restockIntervalMinutes: 240,
            route: { kind: 'no-route' },
          },
        ],
      },
    };
  });
}

function registerServerNoRouteOverrideHandler(): void {
  sharedMock.on('market-list-by-location-request', (payload) => {
    const request = payload as MarketByLocationRequest;
    return {
      event: 'market-list-by-location-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        solarSystemId: 'sol',
        positionKm: SHIP_IN_SOL.spatial.positionKm,
        distanceAu: request.distanceAu,
        locationTypes: ['station'],
        isDocked: false,
        dockedMarketId: null,
        markets: [
          {
            marketId: 'sol-near-station',
            solarSystemId: 'sol',
            marketName: 'Near Station',
            siteType: 'station',
            siteName: 'Sol Core Ring',
            spatial: {
              solarSystemId: 'sol',
              frame: 'barycentric',
              positionKm: { x: 413_700_400, y: 0, z: 0 },
              epochMs: Date.now(),
            },
            distanceAu: 0.003,
            isDocked: false,
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
            route: { kind: 'no-route' },
          },
        ],
      },
    };
  });
}

async function setupSharedMarketHubCrossSystemSession(browser: Browser): Promise<void> {
  sharedContext = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
  sharedPage = await sharedContext.newPage();
  sharedMock = new SocketIOMock(sharedPage);
  sharedGameShell = new GameShellPage(sharedPage);
  sharedMarketHubPage = new MarketHubPage(sharedPage);

  await sharedMock.setup();
  registerSharedSessionHandlers();
  registerDefaultMarketHandler(() => {});

  await sharedPage.goto('http://localhost:4200/(left:character-list)');
  await sharedPage
    .waitForURL(/left:(character-list|login)/, { timeout: 15_000 })
    .catch(() => null);

  const loginFormInitiallyVisible = await sharedPage
    .locator('#playerName')
    .isVisible({ timeout: 1_000 })
    .catch(() => false);

  if (!sharedPage.url().includes('left:character-list') || loginFormInitiallyVisible) {
    await loginViaUI(sharedPage, sharedMock);
  }

  try {
    await expect(sharedPage).toHaveURL(/left:character-list/, { timeout: 10_000 });
  } catch {
    // Full-suite runs can briefly bounce back to login even after storageState hydrate.
    await loginViaUI(sharedPage, sharedMock);
    await expect(sharedPage).toHaveURL(/left:character-list/, { timeout: 10_000 });
  }

  const loginFormStillVisible = await sharedPage
    .locator('#playerName')
    .isVisible({ timeout: 1_000 })
    .catch(() => false);
  if (loginFormStillVisible) {
    await loginViaUI(sharedPage, sharedMock);
    await expect(sharedPage).toHaveURL(/left:character-list/, { timeout: 10_000 });
  }

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

async function resetSharedMarketHubCrossSystemSession(): Promise<void> {
  if (!sharedPage || sharedPage.isClosed()) {
    return;
  }

  sharedMock.reset();
  registerSharedSessionHandlers();
  registerDefaultMarketHandler(() => {});

  let attempts = 0;
  while (!sharedPage.url().includes('left:game-main') && attempts < 4) {
    attempts += 1;
    await sharedPage.goBack();
  }

  await expect(sharedPage).toHaveURL(/left:game-main/, { timeout: 10_000 });
}

async function openMarketHubWithDefaultData(onRequest: (req: MarketByLocationRequest) => void) {
  sharedMock.reset();
  registerSharedSessionHandlers();
  registerDefaultMarketHandler(onRequest);

  await sharedGameShell.openMarketHub();
  await expect(sharedMarketHubPage.reachableHeading).toBeVisible({ timeout: 15_000 });
}

test.describe.configure({ mode: 'serial', timeout: 60_000 });

test.beforeAll(async ({ browser }) => {
  await setupSharedMarketHubCrossSystemSession(browser);
});

test.afterEach(async () => {
  await resetSharedMarketHubCrossSystemSession();
});

test.afterAll(async () => {
  await sharedContext.close();
});

test.describe('Market Hub cross-system route badges', () => {
  test.setTimeout(60_000);

  test('renders in-system, gate-route, and no-route badges correctly', async () => {
    const requests: MarketByLocationRequest[] = [];
    await openMarketHubWithDefaultData((req) => requests.push(req));

    const marketRows = sharedMarketHubPage.marketItems;
    await expect(marketRows).toHaveCount(3);

    const nearStation = marketRows.nth(0);
    await expect(nearStation).toContainText('Near Station');
    await expect(nearStation).toContainText('In-system');

    const alphaMarket = marketRows.nth(1);
    await expect(alphaMarket).toContainText('Alpha Station');
    await expect(alphaMarket).toContainText('1 gate hop');
    await expect(alphaMarket).toContainText('Alpha Station, 1 gate hop away');

    const barnardsMarket = marketRows.nth(2);
    await expect(barnardsMarket).toContainText("Barnard's Depot");
    await expect(barnardsMarket).toContainText('2 gate hops');
    await expect(barnardsMarket).toContainText("Barnard's Depot, 2 gate hops away");

    await sharedMarketHubPage.enableOutOfRangeMarkets();
    await expect(marketRows).toHaveCount(4, { timeout: 5_000 });
    const wolfMarket = marketRows.nth(3);
    await expect(wolfMarket).toContainText('Wolf-359 Outpost');
    await expect(wolfMarket).toContainText('No route');
    await expect(wolfMarket).toContainText('Wolf-359 Outpost, no known gate route');
  });

  test('gate-route markets have transact button disabled and no-route market is not transactable', async () => {
    const requests: MarketByLocationRequest[] = [];
    await openMarketHubWithDefaultData((req) => requests.push(req));

    const marketRows = sharedMarketHubPage.marketItems;

    await sharedMarketHubPage.enableOutOfRangeMarkets();
    await expect(marketRows).toHaveCount(4, { timeout: 5_000 });

    const alphaMarket = marketRows.nth(1);
    const barnardsMarket = marketRows.nth(2);
    const wolfMarket = marketRows.nth(3);

    await expect(alphaMarket.locator('.transact-btn')).toBeDisabled();
    await expect(barnardsMarket.locator('.transact-btn')).toBeDisabled();
    await expect(wolfMarket.locator('.transact-btn')).toBeDisabled();
  });

  test('server no-route overrides client BFS — alpha-centauri shows No route when server says so', async () => {
    sharedMock.reset();
    registerSharedSessionHandlers();
    registerServerNoRouteOverrideHandler();

    await sharedGameShell.openMarketHub();
    await expect(sharedMarketHubPage.reachableHeading).toBeVisible({ timeout: 15_000 });

    await sharedMarketHubPage.enableOutOfRangeMarkets();
    await expect(sharedMarketHubPage.marketItems).toHaveCount(2, { timeout: 5_000 });

    const alphaMarket = sharedMarketHubPage.marketItems.nth(1);
    await expect(alphaMarket).toContainText('Alpha Station');
    await expect(alphaMarket).toContainText('No route');
    await expect(alphaMarket).not.toContainText('gate hop');
    await expect(alphaMarket.locator('.transact-btn')).toBeDisabled();
  });
});
