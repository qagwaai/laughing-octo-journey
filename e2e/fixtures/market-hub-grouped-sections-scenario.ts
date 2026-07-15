import { expect } from '@playwright/test';
import { TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { MarketHubPage } from '../page-objects/market-hub.page';
import { SocketIOMock } from './socket-mock';

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

export type MarketByLocationRequest = { distanceAu: number };

export function registerSessionHandlers(mock: SocketIOMock): void {
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
      ships: [SHIP],
    },
  }));
}

export function registerDefaultMarketHandler(mock: SocketIOMock): void {
  mock.on('market-list-by-location-request', () => ({
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

export async function openMarketHubWithDefaultData(
  sharedGameShell: GameShellPage,
  sharedMock: SocketIOMock,
  sharedMarketHubPage: MarketHubPage,
): Promise<void> {
  sharedMock.reset();
  registerSessionHandlers(sharedMock);
  registerDefaultMarketHandler(sharedMock);

  await sharedGameShell.openMarketHub();
  await expect.poll(() => sharedMarketHubPage.marketItems.count(), { timeout: 15_000 }).toBeGreaterThan(0);
}

export function getDefaultGroupedMarkets() {
  return {
    nearMarket: NEAR_MARKET,
    distantMarket: DISTANT_MARKET,
    ship: SHIP,
  };
}