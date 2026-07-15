import { TEST_PLAYER } from '../helpers/auth-helper';
import { SocketIOMock } from './socket-mock';

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
  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characters: [MARKET_HUB_DOCKING_CHARACTER],
    },
  }));

  mock.on('game-join', () => null);

  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: MARKET_HUB_DOCKING_CHARACTER.id,
      ships: [MARKET_HUB_DOCKING_SHIP_WITH_POSITION],
    },
  }));
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