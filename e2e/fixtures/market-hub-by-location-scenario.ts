import { GameShellPage } from '../page-objects/game-shell.page';
import { TEST_PLAYER } from '../helpers/auth-helper';
import { SocketIOMock } from './socket-mock';

export const MARKET_HUB_CHARACTER = {
  id: 'char-market-1',
  characterName: 'Orbit Trader',
  level: 3,
  missions: [{ missionId: 'first-target', status: 'active' }],
};

export const MARKET_HUB_SHIP_WITH_POSITION = {
  id: `starter-pod-${MARKET_HUB_CHARACTER.id}`,
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

export type MarketByLocationRequest = {
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

export function registerSharedSessionHandlers(mock: SocketIOMock): void {
  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characters: [MARKET_HUB_CHARACTER],
    },
  }));

  mock.on('game-join', () => null);

  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: MARKET_HUB_CHARACTER.id,
      ships: [MARKET_HUB_SHIP_WITH_POSITION],
    },
  }));
}

export function registerDefaultMarketHandler(
  mock: SocketIOMock,
  onRequest: (request: MarketByLocationRequest) => void,
): void {
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

export async function openMarketHubWithDefaultData(
  sharedGameShell: GameShellPage,
  sharedMock: {
    reset: () => void;
  } & Pick<SocketIOMock, 'on'>,
  onRequest: (request: MarketByLocationRequest) => void,
): Promise<void> {
  sharedMock.reset();
  registerSharedSessionHandlers(sharedMock);
  registerDefaultMarketHandler(sharedMock, onRequest);

  await sharedGameShell.openMarketHub();
}