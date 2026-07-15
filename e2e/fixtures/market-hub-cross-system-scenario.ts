import { TEST_PLAYER } from '../helpers/auth-helper';
import { SocketIOMock } from './socket-mock';

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

export type MarketByLocationRequest = {
  playerName: string;
  sessionKey: string;
  solarSystemId: string;
  distanceAu: number;
};

export function registerSharedSessionHandlers(mock: SocketIOMock): void {
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
}

export function registerDefaultMarketHandler(mock: SocketIOMock, onRequest: (req: MarketByLocationRequest) => void): void {
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
}

export function registerServerNoRouteOverrideHandler(mock: SocketIOMock): void {
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