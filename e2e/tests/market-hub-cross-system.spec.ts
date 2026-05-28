import { expect, test, type Page } from '@playwright/test';
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

async function setupAndOpenMarketHub(page: Page, onRequest: (req: MarketByLocationRequest) => void) {
  const mock = new SocketIOMock(page);
  const gameShell = new GameShellPage(page);
  const marketHubPage = new MarketHubPage(page);
  await mock.setup();

  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characters: [CHARACTER],
    },
  }));

  mock.on('game-join', () => null);

  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: CHARACTER.id,
      ships: [SHIP_IN_SOL],
    },
  }));

  mock.on('market-list-by-location-request', (payload) => {
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

  await loginViaUI(page, mock);

  await gameShell.joinGame('Join Game in Progress');
  await expect(page).toHaveURL(/left:game-main/, { timeout: 10_000 });

  await gameShell.openMarketHub();

  // Wait for the reachable section to fully render before the test body proceeds.
  await expect(marketHubPage.reachableHeading).toBeVisible({ timeout: 15_000 });
}

test.describe('Market Hub cross-system route badges', () => {
  test.setTimeout(60_000);

  test('renders in-system, gate-route, and no-route badges correctly', async ({ page }) => {
    const requests: MarketByLocationRequest[] = [];
    const marketHubPage = new MarketHubPage(page);
    await setupAndOpenMarketHub(page, (req) => requests.push(req));

    const marketRows = marketHubPage.marketItems;
    // Gate-route markets (alpha, barnards) are reachable; no-route (wolf) is behind the toggle.
    await expect(marketRows).toHaveCount(3);

    // In-system market
    const nearStation = marketRows.nth(0);
    await expect(nearStation).toContainText('Near Station');
    await expect(nearStation).toContainText('In-system');

    // 1-hop gate-route market
    const alphaMarket = marketRows.nth(1);
    await expect(alphaMarket).toContainText('Alpha Station');
    await expect(alphaMarket).toContainText('1 gate hop');
    await expect(alphaMarket).toContainText('Alpha Station, 1 gate hop away');

    // 2-hop gate-route market
    const barnardsMarket = marketRows.nth(2);
    await expect(barnardsMarket).toContainText("Barnard's Depot");
    await expect(barnardsMarket).toContainText('2 gate hops');
    await expect(barnardsMarket).toContainText("Barnard's Depot, 2 gate hops away");

    // No-route market is hidden by default; reveal it via the toggle.
    await marketHubPage.enableOutOfRangeMarkets();
    await expect(marketRows).toHaveCount(4, { timeout: 5_000 });
    const wolfMarket = marketRows.nth(3);
    await expect(wolfMarket).toContainText('Wolf-359 Outpost');
    await expect(wolfMarket).toContainText('No route');
    await expect(wolfMarket).toContainText('Wolf-359 Outpost, no known gate route');
  });

  test('gate-route markets have transact button disabled and no-route market is not transactable', async ({ page }) => {
    const requests: MarketByLocationRequest[] = [];
    const marketHubPage = new MarketHubPage(page);
    await setupAndOpenMarketHub(page, (req) => requests.push(req));

    const marketRows = marketHubPage.marketItems;

    // Enable toggle so no-route market (wolf) is visible alongside gate-route markets.
    await marketHubPage.enableOutOfRangeMarkets();
    await expect(marketRows).toHaveCount(4, { timeout: 5_000 });

    const alphaMarket = marketRows.nth(1);
    const barnardsMarket = marketRows.nth(2);
    const wolfMarket = marketRows.nth(3);

    // Gate-route markets are reachable via jump gates but not docked — transact disabled
    await expect(alphaMarket.locator('.transact-btn')).toBeDisabled();
    await expect(barnardsMarket.locator('.transact-btn')).toBeDisabled();

    // No-route market is not transactable
    await expect(wolfMarket.locator('.transact-btn')).toBeDisabled();
  });

  test('server no-route overrides client BFS — alpha-centauri shows No route when server says so', async ({ page }) => {
    const mock = new SocketIOMock(page);
    const gameShell = new GameShellPage(page);
    const marketHubPage = new MarketHubPage(page);
    await mock.setup();

    mock.on('character-list-request', () => ({
      event: 'character-list-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        characters: [CHARACTER],
      },
    }));

    mock.on('game-join', () => null);

    mock.on('ship-list-by-owner-request', () => ({
      event: 'ship-list-by-owner-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        characterId: CHARACTER.id,
        ships: [SHIP_IN_SOL],
      },
    }));

    mock.on('market-list-by-location-request', (payload) => {
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
              // Alpha Centauri is 1 BFS hop from Sol — but server explicitly says no-route
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

    await loginViaUI(page, mock);

    await gameShell.joinGame('Join Game in Progress');
    await expect(page).toHaveURL(/left:game-main/, { timeout: 10_000 });

    await gameShell.openMarketHub();

    // Wait for the reachable section to appear before checking the toggle.
    await expect(marketHubPage.reachableHeading).toBeVisible({ timeout: 15_000 });

    // Alpha Centauri has server-declared no-route, so it is hidden behind the toggle.
    await marketHubPage.enableOutOfRangeMarkets();
    await expect(marketHubPage.marketItems).toHaveCount(2, { timeout: 5_000 });

    const alphaMarket = marketHubPage.marketItems.nth(1);
    await expect(alphaMarket).toContainText('Alpha Station');
    // Server says no-route — must NOT show '1 gate hop' even though BFS would reach it
    await expect(alphaMarket).toContainText('No route');
    await expect(alphaMarket).not.toContainText('gate hop');
    await expect(alphaMarket.locator('.transact-btn')).toBeDisabled();
  });
});
