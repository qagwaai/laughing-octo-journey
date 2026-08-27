import { TEST_PLAYER } from '../helpers/auth-helper';
import { SocketIOMock } from './socket-mock';

const FIRST_TARGET_MISSION_ID = 'first-target';

export const SHIP_EXTERIOR_FLIGHT_PERSISTENCE_CHARACTER_ID = 'char-flight-position-persistence';
export const SHIP_EXTERIOR_FLIGHT_PERSISTENCE_SHIP_ID = 'ship-flight-position-persistence';

function shipSummary(positionKm: { x: number; y: number; z: number }) {
  return {
    id: SHIP_EXTERIOR_FLIGHT_PERSISTENCE_SHIP_ID,
    name: 'Starter Pod',
    model: 'Scavenger Pod',
    status: 'Damaged',
    inventory: [],
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm,
      epochMs: Date.now(),
    },
    motion: { velocityKmPerSec: { x: 0, y: 0, z: 0 } },
    observability: { visibility: 'visible', scanState: 'scanned' },
  };
}

export function configureNavigateAwayPersistenceMock(
  mock: SocketIOMock,
  persistedPosition: { x: number; y: number; z: number },
): void {
  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characters: [
        {
          id: SHIP_EXTERIOR_FLIGHT_PERSISTENCE_CHARACTER_ID,
          characterName: 'Flight Pilot',
          level: 2,
          missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' }],
        },
      ],
    },
  }));

  mock.on('game-join-request', () => null);

  mock.on('list-missions-request', () => ({
    event: 'list-missions-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: SHIP_EXTERIOR_FLIGHT_PERSISTENCE_CHARACTER_ID,
      missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' }],
    },
  }));

  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: SHIP_EXTERIOR_FLIGHT_PERSISTENCE_CHARACTER_ID,
      ships: [shipSummary(persistedPosition)],
    },
  }));

  mock.on('ship-upsert-request', (request) => {
    const payload = request as {
      ship?: {
        spatial?: {
          positionKm?: { x?: number; y?: number; z?: number };
        };
      };
    };
    const next = payload.ship?.spatial?.positionKm;
    if (
      typeof next?.x === 'number' &&
      Number.isFinite(next.x) &&
      typeof next?.y === 'number' &&
      Number.isFinite(next.y) &&
      typeof next?.z === 'number' &&
      Number.isFinite(next.z)
    ) {
      persistedPosition.x = next.x;
      persistedPosition.y = next.y;
      persistedPosition.z = next.z;
    }

    return {
      event: 'ship-upsert-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        characterId: SHIP_EXTERIOR_FLIGHT_PERSISTENCE_CHARACTER_ID,
        ship: shipSummary(persistedPosition),
      },
    };
  });

  mock.on('celestial-body-list-request', () => ({
    event: 'celestial-body-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      solarSystemId: 'sol',
      positionKm: persistedPosition,
      distanceKm: 900_000,
      celestialBodies: [],
    },
  }));

  mock.on('market-list-by-location-request', (request) => {
    const payload = request as {
      distanceAu?: number;
      locationTypes?: string[];
      positionKm?: { x: number; y: number; z: number };
    };
    return {
      event: 'market-list-by-location-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        solarSystemId: 'sol',
        positionKm: payload.positionKm ?? persistedPosition,
        distanceAu: payload.distanceAu ?? 0.5,
        locationTypes: payload.locationTypes ?? ['station', 'free-floating'],
        isDocked: false,
        dockedMarketId: null,
        markets: [],
      },
    };
  });

  mock.on('mission-upsert-request', () => ({
    event: 'mission-upsert-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: SHIP_EXTERIOR_FLIGHT_PERSISTENCE_CHARACTER_ID,
    },
  }));
}