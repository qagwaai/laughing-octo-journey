import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { MarketHubPage } from '../page-objects/market-hub.page';

const CHARACTER = {
  id: 'char-market-1',
  characterName: 'Orbit Trader',
  level: 3,
  missions: [{ missionId: 'first-target', status: 'active' }],
};

const SHIP_WITH_POSITION = {
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
    positionKm: { x: 413_700_000, y: 10, z: -5 },
    epochMs: 1_777_777_777_000,
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
      observedAt: new Date(1_777_777_777_000).toISOString(),
    },
  },
};

type MarketByLocationRequest = {
  playerName: string;
  sessionKey: string;
  solarSystemId: string;
  positionKm: { x: number; y: number; z: number };
  distanceAu: number;
  limit: number;
  locationTypes: string[];
  characterId?: string;
  shipId?: string;
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
        positionKm: request.positionKm,
        distanceAu: request.distanceAu,
        locationTypes: ['station'],
        isDocked: false,
        dockedMarketId: null,
        markets: [
          {
            marketId: 'sol-far-exchange',
            solarSystemId: 'sol',
            marketName: 'Far Exchange',
            siteType: 'station',
            siteName: 'Far Ring',
            spatial: {
              solarSystemId: 'sol',
              frame: 'barycentric',
              positionKm: { x: 413_709_800, y: 10, z: -5 },
              epochMs: Date.now(),
            },
            distanceAu: 0.35,
            isDocked: false,
            priceMultiplier: 1,
            driftPercentPerHour: 6,
            restockIntervalMinutes: 60,
          },
          {
            marketId: 'sol-ceres-exchange',
            solarSystemId: 'sol',
            marketName: 'Ceres Exchange',
            siteType: 'station',
            siteName: 'Ceres Belt Trade Ring',
            spatial: {
              solarSystemId: 'sol',
              frame: 'barycentric',
              positionKm: { x: 413_704_821.8, y: 10, z: -5 },
              epochMs: Date.now(),
            },
            distanceAu: 0.15,
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

async function setupSharedMarketHubByLocationSession(browser: Browser): Promise<void> {
  sharedContext = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
  sharedPage = await sharedContext.newPage();
  sharedMock = new SocketIOMock(sharedPage);
  sharedGameShell = new GameShellPage(sharedPage);
  sharedMarketHubPage = new MarketHubPage(sharedPage);

  await sharedMock.setup();
  registerSharedSessionHandlers();
  registerDefaultMarketHandler(() => undefined);

  await sharedPage.goto('http://localhost:4200/(left:character-list)');
  const loginFormVisible = (await sharedPage.locator('#playerName').count()) > 0;
  if (loginFormVisible) {
    await loginViaUI(sharedPage, sharedMock);
  }
  try {
    await expect(sharedPage).toHaveURL(/left:character-list/, { timeout: 10_000 });
  } catch {
    // Full-suite runs can briefly bounce back to login even after storageState hydrate.
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
    await sharedPage.locator('.load-btn').click();
  }
  await sharedGameShell.joinGame('Join Game in Progress');
  await expect(sharedPage).toHaveURL(/left:game-main/, { timeout: 10_000 });
}

async function resetSharedMarketHubByLocationSession(): Promise<void> {
  if (!sharedPage || sharedPage.isClosed()) {
    return;
  }

  sharedMock.reset();
  registerSharedSessionHandlers();
  registerDefaultMarketHandler(() => undefined);

  let attempts = 0;
  while (!sharedPage.url().includes('left:game-main') && attempts < 4) {
    attempts += 1;
    await sharedPage.goBack();
  }

  await expect(sharedPage).toHaveURL(/left:game-main/, { timeout: 10_000 });
}

async function openMarketHubWithDefaultData(onRequest: (request: MarketByLocationRequest) => void) {
  sharedMock.reset();
  registerSharedSessionHandlers();
  registerDefaultMarketHandler(onRequest);

  await sharedGameShell.openMarketHub();
}

test.describe.configure({ mode: 'serial' });

test.beforeAll(async ({ browser }) => {
  await setupSharedMarketHubByLocationSession(browser);
});

test.afterEach(async () => {
  await resetSharedMarketHubByLocationSession();
});

test.afterAll(async () => {
  await sharedContext.close();
});

test.describe('Market Hub by-location contract', () => {
  test('emits by-location request and renders markets ordered by authoritative distance', async () => {
    const requests: MarketByLocationRequest[] = [];
    await openMarketHubWithDefaultData((request) => requests.push(request));

    await expect
      .poll(
        async () => {
          const marketHubRequest = requests.find((request) => request.limit === 50);
          if (!marketHubRequest) {
            await sharedMarketHubPage.reloadButton.click();
          }
          return marketHubRequest ?? null;
        },
        { timeout: 15_000 },
      )
      .not.toBeNull();

    const marketHubRequest = requests.find((request) => request.limit === 50);
    expect(marketHubRequest).toBeDefined();
    expect(marketHubRequest!.playerName).toBe(TEST_PLAYER);
    expect(marketHubRequest!.solarSystemId).toBe('sol');
    expect(marketHubRequest!.distanceAu).toBe(0.5);
    expect(marketHubRequest!.limit).toBe(50);
    expect(marketHubRequest!.locationTypes).toEqual(['station', 'free-floating']);
    expect(marketHubRequest!.characterId).toBe(CHARACTER.id);
    expect(marketHubRequest!.shipId).toBe(SHIP_WITH_POSITION.id);
    expect(marketHubRequest!.positionKm).toEqual({ x: 413_700_000, y: 10, z: -5 });

    const marketRows = sharedMarketHubPage.marketItems;
    await expect(marketRows).toHaveCount(2);
    await expect(marketRows.nth(0)).toContainText('Ceres Exchange');
    await expect(marketRows.nth(0)).toContainText('In-system');
    await expect(marketRows.nth(0)).toContainText('0.150 AU');
    await expect(marketRows.nth(0)).toContainText('about less than 1 hour at standard cruise');
    await expect(marketRows.nth(1)).toContainText('Far Exchange');
    await expect(marketRows.nth(1)).toContainText('In-system');
    await expect(marketRows.nth(1)).toContainText('0.350 AU');
  });
});
