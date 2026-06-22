import { expect } from '@playwright/test';
import { createJoinedGameTest } from '../fixtures/joined-game-fixture';
import { SocketIOMock } from '../fixtures/socket-mock';
import { TEST_PLAYER } from '../helpers/auth-helper';
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

function registerSharedSessionHandlers(mock: SocketIOMock): void {
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
}

function registerDefaultMarketHandler(mock: SocketIOMock, onRequest: (request: MarketByLocationRequest) => void): void {
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
}

const test = createJoinedGameTest({
  registerSessionHandlers: registerSharedSessionHandlers,
  joinButtonText: 'Join Game in Progress',
});

let sharedMarketHubPage: MarketHubPage;

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ sharedPage, prepareJoinedPage }) => {
  await prepareJoinedPage();
  sharedMarketHubPage = new MarketHubPage(sharedPage);
});

async function openMarketHubWithDefaultData(
  sharedGameShell: GameShellPage,
  sharedMock: SocketIOMock,
  onRequest: (request: MarketByLocationRequest) => void,
) {
  sharedMock.reset();
  registerSharedSessionHandlers(sharedMock);
  registerDefaultMarketHandler(sharedMock, onRequest);

  await sharedGameShell.openMarketHub();
}

test.describe('Market Hub by-location contract', () => {
  test('emits by-location request and renders markets ordered by authoritative distance', async ({ sharedGameShell, sharedMock }) => {
    const requests: MarketByLocationRequest[] = [];
    await openMarketHubWithDefaultData(sharedGameShell, sharedMock, (request) => requests.push(request));

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
