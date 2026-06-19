import { expect, test, type Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { MarketHubPage } from '../page-objects/market-hub.page';

const CHARACTER = {
  id: 'char-market-reconnect-1',
  characterName: 'Reconnect Trader',
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
  correlationId?: string;
  requestIdentity?: Record<string, unknown>;
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

function marketResponse(marketName: string, siteName: string) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    solarSystemId: 'sol',
    positionKm: SHIP_WITH_POSITION.spatial.positionKm,
    distanceAu: 0.35,
    locationTypes: ['station'],
    isDocked: false,
    dockedMarketId: null,
    markets: [
      {
        marketId: `${marketName.toLowerCase().replace(/\s+/g, '-')}-id`,
        solarSystemId: 'sol',
        marketName,
        siteType: 'station',
        siteName,
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
    ],
  };
}

async function setupAndOpenMarketHub(page: Page) {
  const mock = new SocketIOMock(page);
  const gameShell = new GameShellPage(page);
  const marketHubPage = new MarketHubPage(page);
  const requests: MarketByLocationRequest[] = [];
  let firstRequest: MarketByLocationRequest | null = null;
  let secondRequest: MarketByLocationRequest | null = null;

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
      ships: [SHIP_WITH_POSITION],
    },
  }));

  mock.on('market-list-by-location-request', (payload) => {
    const request = payload as MarketByLocationRequest;
    requests.push(request);

    if (!firstRequest) {
      firstRequest = request;
      return null;
    }

    secondRequest = request;
    mock.push('market-list-by-location-response', {
      ...marketResponse('Fresh Exchange', 'Fresh Ring'),
      correlationId: request.correlationId,
      requestIdentity: request.requestIdentity,
    });
    return null;
  });

  await loginViaUI(page, mock);

  await gameShell.joinGame('Join Game in Progress');
  await expect(page).toHaveURL(/left:game-main/, { timeout: 10_000 });

  await gameShell.openMarketHub();

  await expect.poll(() => requests.length, { timeout: 15_000 }).toBe(1);

  await page.reload();
  await expect(page).toHaveURL(/left:market-hub/, { timeout: 15_000 });

  await expect.poll(() => requests.length, { timeout: 15_000 }).toBe(2);

  if (!firstRequest || !secondRequest) {
    throw new Error('Expected both market-list requests to be captured.');
  }

  expect(firstRequest.correlationId).toBeDefined();
  expect(secondRequest.correlationId).toBeDefined();
  expect(secondRequest.correlationId).not.toBe(firstRequest.correlationId);

  await expect(marketHubPage.marketItems).toHaveCount(1, { timeout: 15_000 });
  await expect(marketHubPage.marketItems.first()).toContainText('Fresh Exchange');
  await expect(marketHubPage.marketItems.first()).not.toContainText('Stale Exchange');

  mock.push('market-list-by-location-response', {
    ...marketResponse('Stale Exchange', 'Stale Ring'),
    correlationId: firstRequest.correlationId,
    requestIdentity: firstRequest.requestIdentity,
  });

  await expect(marketHubPage.marketItems.first()).toContainText('Fresh Exchange');
  await expect(marketHubPage.marketItems.first()).not.toContainText('Stale Exchange');
}

test.describe('Market Hub socket reconnect correlation', () => {
  test('ignores the stale pre-reconnect market-list response and keeps the fresh result', async ({ page }) => {
    await setupAndOpenMarketHub(page);
  });
});