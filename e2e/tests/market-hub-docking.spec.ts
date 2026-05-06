import { test, expect, type Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';

const CHARACTER = {
  id: 'char-market-2',
  characterName: 'Dockmaster',
  level: 4,
  missions: [{ missionId: 'first-target', status: 'started' }],
};

const SHIP_WITH_POSITION = {
  id: `starter-pod-${CHARACTER.id}`,
  name: 'Scavenger Pod',
  model: 'Scavenger Pod',
  tier: 1,
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
  distanceKm: number;
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
        positionKm: SHIP_WITH_POSITION.spatial.positionKm,
        distanceKm: request.distanceKm,
        locationTypes: ['station'],
        isDocked: true,
        dockedMarketId: 'sol-ceres-exchange',
        markets: [
          {
            marketId: 'sol-ceres-exchange',
            solarSystemId: 'sol',
            marketName: 'Ceres Exchange',
            locationType: 'station',
            locationName: 'Ceres Belt Trade Ring',
            distanceKm: 2.5,
            isDocked: true,
            priceMultiplier: 1,
            driftPercentPerHour: 6,
            restockIntervalMinutes: 60,
          },
          {
            marketId: 'sol-remote-market',
            solarSystemId: 'sol',
            marketName: 'Remote Market',
            locationType: 'station',
            locationName: 'Outer Arc',
            distanceKm: 340.2,
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

test.describe('Market Hub docking and radius behavior', () => {
  test('enables transact only for docked market and refreshes with selected radius', async ({ page }) => {
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

    const marketRows = page.locator('.market-item');
    await expect(marketRows).toHaveCount(2);

    const dockedMarket = marketRows.nth(0);
    const remoteMarket = marketRows.nth(1);

    await expect(dockedMarket).toContainText('Ceres Exchange');
    await expect(remoteMarket).toContainText('Remote Market');

    await expect(dockedMarket.locator('.transact-btn')).toBeEnabled();
    await expect(remoteMarket.locator('.transact-btn')).toBeDisabled();
    await expect(remoteMarket.locator('.dock-required-badge')).toBeVisible();

    await page.selectOption('#radiusKm', '250');

    await expect.poll(() => requests.length, { timeout: 10_000 }).toBeGreaterThan(1);
    const latestRequest = requests[requests.length - 1];
    expect(latestRequest.distanceKm).toBe(250);
  });
});
