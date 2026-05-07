import { test, expect, type Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';

const CHARACTER = {
  id: 'char-market-1',
  characterName: 'Orbit Trader',
  level: 3,
  missions: [{ missionId: 'first-target', status: 'started' }],
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

async function setupAndOpenMarketHub(page: Page, onRequest: (request: MarketByLocationRequest) => void) {
  const mock = new SocketIOMock(page);
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

  mock.on('ship-list-request', () => ({
    event: 'ship-list-response',
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

  await loginViaUI(page, mock);

  await page.locator('.character-item button', { hasText: 'Join Game in Progress' }).click();
  await expect(page).toHaveURL(/left:game-main/, { timeout: 10_000 });

  await page.locator('button[aria-label="Market Hub"]').click();
  await expect(page).toHaveURL(/left:market-hub/, { timeout: 10_000 });
}

test.describe('Market Hub by-location contract', () => {
  test('emits by-location request and renders markets ordered by authoritative distance', async ({ page }) => {
    const requests: MarketByLocationRequest[] = [];
    await setupAndOpenMarketHub(page, (request) => requests.push(request));

    await expect
      .poll(
        async () => {
          if (requests.length === 0) {
            await page.locator('.reload-btn').click();
          }
          return requests.length;
        },
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);

    const firstRequest = requests[0];
    expect(firstRequest.playerName).toBe(TEST_PLAYER);
    expect(firstRequest.solarSystemId).toBe('sol');
    expect(firstRequest.distanceAu).toBe(0.5);
    expect(firstRequest.limit).toBe(50);
    expect(firstRequest.locationTypes).toEqual(['station', 'free-floating']);
    expect(firstRequest.characterId).toBe(CHARACTER.id);
    expect(firstRequest.shipId).toBe(SHIP_WITH_POSITION.id);
    expect(firstRequest.positionKm).toEqual({ x: 413_700_000, y: 10, z: -5 });

    const marketRows = page.locator('.market-item');
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
