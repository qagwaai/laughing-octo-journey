import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { MarketHubPage } from '../page-objects/market-hub.page';

const CHARACTER = {
  id: 'char-market-grouped',
  characterName: 'Pathfinder',
  level: 2,
  missions: [{ missionId: 'first-target', status: 'active' }],
};

/** Standard-cruise drive: 0.5 AU range. Near Exchange (0.2 AU) is reachable;
 *  Distant Exchange (2.5 AU) exceeds that range and should appear only when
 *  the "show out-of-range" toggle is enabled. */
const SHIP = {
  id: `starter-pod-${CHARACTER.id}`,
  name: 'Scavenger Pod',
  model: 'Scavenger Pod',
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
    epochMs: 1_777_000_000_000,
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
      observedAt: new Date(1_777_000_000_000).toISOString(),
    },
  },
};

const NEAR_MARKET = {
  marketId: 'sol-near-exchange',
  solarSystemId: 'sol',
  marketName: 'Near Exchange',
  siteType: 'station',
  siteName: 'Inner Belt Ring',
  spatial: {
    solarSystemId: 'sol',
    frame: 'barycentric',
    positionKm: { x: 413_729_950, y: 0, z: 0 },
    epochMs: Date.now(),
  },
  distanceAu: 0.2,
  isDocked: false,
  priceMultiplier: 1,
  driftPercentPerHour: 6,
  restockIntervalMinutes: 60,
};

const DISTANT_MARKET = {
  marketId: 'sol-distant-exchange',
  solarSystemId: 'sol',
  marketName: 'Distant Exchange',
  siteType: 'station',
  siteName: 'Outer Rim Hub',
  spatial: {
    solarSystemId: 'sol',
    frame: 'barycentric',
    positionKm: { x: 414_073_947, y: 0, z: 0 },
    epochMs: Date.now(),
  },
  distanceAu: 2.5,
  isDocked: false,
  priceMultiplier: 1.2,
  driftPercentPerHour: 8,
  restockIntervalMinutes: 120,
};

type MarketByLocationRequest = { distanceAu: number };

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
      ships: [SHIP],
    },
  }));
}

function registerDefaultMarketHandler(): void {
  sharedMock.on('market-list-by-location-request', () => ({
    event: 'market-list-by-location-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      solarSystemId: 'sol',
      positionKm: SHIP.spatial.positionKm,
      locationTypes: ['station'],
      isDocked: false,
      dockedMarketId: null,
      markets: [NEAR_MARKET, DISTANT_MARKET],
    },
  }));
}

async function setupSharedMarketHubGroupedSectionsSession(browser: Browser): Promise<void> {
  sharedContext = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
  sharedPage = await sharedContext.newPage();
  sharedMock = new SocketIOMock(sharedPage);
  sharedGameShell = new GameShellPage(sharedPage);
  sharedMarketHubPage = new MarketHubPage(sharedPage);

  await sharedMock.setup();
  registerSharedSessionHandlers();
  registerDefaultMarketHandler();

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

async function resetSharedMarketHubGroupedSectionsSession(): Promise<void> {
  if (!sharedPage || sharedPage.isClosed()) {
    return;
  }

  sharedMock.reset();
  registerSharedSessionHandlers();
  registerDefaultMarketHandler();

  let attempts = 0;
  while (!sharedPage.url().includes('left:game-main') && attempts < 4) {
    attempts += 1;
    await sharedPage.goBack();
  }

  await expect(sharedPage).toHaveURL(/left:game-main/, { timeout: 10_000 });
}

async function openMarketHubWithDefaultData() {
  sharedMock.reset();
  registerSharedSessionHandlers();
  registerDefaultMarketHandler();

  await sharedGameShell.openMarketHub();
  await expect.poll(() => sharedMarketHubPage.marketItems.count(), { timeout: 15_000 }).toBeGreaterThan(0);
}

test.describe.configure({ mode: 'serial', timeout: 60_000 });

test.beforeAll(async ({ browser }) => {
  await setupSharedMarketHubGroupedSectionsSession(browser);
});

test.afterEach(async () => {
  await resetSharedMarketHubGroupedSectionsSession();
});

test.afterAll(async () => {
  await sharedContext.close();
});

test.describe('Market Hub grouped sections', () => {
  test('shows reachable markets section by default with in-range markets only', async () => {
    await openMarketHubWithDefaultData();

    const reachableHeading = sharedMarketHubPage.reachableHeading;
    await reachableHeading.scrollIntoViewIfNeeded();
    await expect(reachableHeading).toBeVisible();

    const reachableItems = sharedMarketHubPage.marketItems;
    await expect(reachableItems).toHaveCount(1);
    await expect(reachableItems.nth(0)).toContainText('Near Exchange');
    await expect(reachableItems.nth(0)).toContainText('In-system');

    await expect(sharedMarketHubPage.beyondCurrentDriveHeading).not.toBeVisible();
    await expect(sharedPage.getByRole('heading', { name: 'Distant Exchange' })).not.toBeVisible();
  });

  test('enabling the toggle reveals the Beyond Current Drive section', async () => {
    await openMarketHubWithDefaultData();

    await expect(sharedMarketHubPage.showOutOfRangeToggle).not.toBeChecked();
    await sharedMarketHubPage.enableOutOfRangeMarkets();

    await expect(sharedMarketHubPage.beyondCurrentDriveHeading).toBeVisible({ timeout: 5_000 });

    await expect(sharedPage.getByRole('heading', { name: 'Distant Exchange' })).toBeVisible();
    const outOfRangeItems = sharedMarketHubPage.marketList(1).locator('.market-item');
    await expect(outOfRangeItems).toHaveCount(1);
    await expect(outOfRangeItems.nth(0)).toContainText('Out of range');

    const reachableItems = sharedMarketHubPage.marketList(0).locator('.market-item');
    await expect(reachableItems).toHaveCount(1);
    await expect(reachableItems.nth(0)).toContainText('Near Exchange');
  });

  test('out-of-range market shows required drive upgrade info', async () => {
    await openMarketHubWithDefaultData();

    await sharedMarketHubPage.enableOutOfRangeMarkets();
    await expect(sharedMarketHubPage.beyondCurrentDriveHeading).toBeVisible({ timeout: 5_000 });

    const distantMarket = sharedMarketHubPage.marketItemInList(1, 0);
    await expect(distantMarket).toContainText('Requires drive range upgrade.');
    await expect(distantMarket).toContainText('Rapid Transit Thruster');
    await expect(distantMarket.locator('.transact-btn')).toBeDisabled();
  });

  test('sends selected radius to server without clamping to drive range', async () => {
    const requests: MarketByLocationRequest[] = [];

    sharedMock.reset();
    registerSharedSessionHandlers();
    sharedMock.on('market-list-by-location-request', (payload) => {
      requests.push(payload as MarketByLocationRequest);
      return {
        event: 'market-list-by-location-response',
        data: {
          success: true,
          message: '',
          isDocked: false,
          dockedMarketId: null,
          markets: [NEAR_MARKET, DISTANT_MARKET],
        },
      };
    });

    await sharedGameShell.openMarketHub();

    await expect
      .poll(() => requests.some((request) => request.distanceAu === 0.5), { timeout: 15_000 })
      .toBe(true);

    const requestsBeforeRadiusChange = requests.length;
    await sharedPage.selectOption('#radiusAu', '5');
    await expect
      .poll(
        () => requests.slice(requestsBeforeRadiusChange).some((request) => request.distanceAu === 5),
        { timeout: 10_000 },
      )
      .toBe(true);

    const requestsBeforeToggle = requests.length;
    await sharedMarketHubPage.showOutOfRangeToggle.check();
    await expect
      .poll(
        () => requests.slice(requestsBeforeToggle).some((request) => request.distanceAu === 1_000_000),
        { timeout: 10_000 },
      )
      .toBe(true);
  });
});
