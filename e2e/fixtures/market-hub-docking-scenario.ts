import { TEST_PLAYER } from '../helpers/auth-helper';
import { SocketIOMock } from './socket-mock';
import { registerMarketSharedSession } from './market-hub-session-helpers';

export const MARKET_HUB_DOCKING_CHARACTER = {
  id: 'char-market-2',
  characterName: 'Dockmaster',
  level: 4,
  missions: [{ missionId: 'first-target', status: 'active' }],
};

export const MARKET_HUB_DOCKING_SHIP_WITH_POSITION = {
  id: `starter-pod-${MARKET_HUB_DOCKING_CHARACTER.id}`,
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

export type MarketByLocationRequest = {
  distanceAu: number;
};

export function registerSharedSessionHandlers(mock: SocketIOMock): void {
  registerMarketSharedSession(mock, {
    character: MARKET_HUB_DOCKING_CHARACTER,
    ships: [MARKET_HUB_DOCKING_SHIP_WITH_POSITION],
    joinEvent: 'game-join',
  });
}

export async function setupAndOpenMarketHub(
  sharedGameShell: { openMarketHub: () => Promise<void> },
  sharedMock: { reset: () => void } & Pick<SocketIOMock, 'on'>,
  registerMarketHandler: (mock: SocketIOMock) => void,
): Promise<void> {
  sharedMock.reset();
  registerSharedSessionHandlers(sharedMock);
  registerMarketHandler(sharedMock as SocketIOMock);
  await sharedGameShell.openMarketHub();
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
        positionKm: MARKET_HUB_DOCKING_SHIP_WITH_POSITION.spatial.positionKm,
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

export function registerCrossSystemMarketHandler(mock: SocketIOMock): void {
  mock.on('market-list-by-location-request', (payload) => {
    const request = payload as MarketByLocationRequest;
    return {
      event: 'market-list-by-location-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        solarSystemId: 'sol',
        positionKm: MARKET_HUB_DOCKING_SHIP_WITH_POSITION.spatial.positionKm,
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