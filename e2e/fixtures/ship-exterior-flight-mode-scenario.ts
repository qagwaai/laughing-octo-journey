import { TEST_PLAYER } from '../helpers/auth-helper';
import { SocketIOMock } from './socket-mock';

const FIRST_TARGET_MISSION_ID = 'first-target';

export const SHIP_EXTERIOR_FLIGHT_MODE_CHARACTER_ID = 'char-flight-smoke';

export function configureFlightModeMock(mock: SocketIOMock): void {
  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characters: [
        {
          id: SHIP_EXTERIOR_FLIGHT_MODE_CHARACTER_ID,
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
      characterId: SHIP_EXTERIOR_FLIGHT_MODE_CHARACTER_ID,
      missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' }],
    },
  }));

  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: SHIP_EXTERIOR_FLIGHT_MODE_CHARACTER_ID,
      ships: [
        {
          id: 'ship-1',
          name: 'Starter Pod',
          model: 'Scavenger Pod',
          status: 'Damaged',
          inventory: [],
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: { x: 1_000_000, y: 0, z: 0 },
            epochMs: Date.now(),
          },
          motion: { velocityKmPerSec: { x: 0, y: 0, z: 0 } },
          observability: { visibility: 'visible', scanState: 'scanned' },
        },
      ],
    },
  }));

  mock.on('celestial-body-list-request', () => ({
    event: 'celestial-body-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      solarSystemId: 'sol',
      positionKm: { x: 1_000_000, y: 0, z: 0 },
      distanceKm: 900_000,
      celestialBodies: [],
    },
  }));

  mock.on('mission-upsert-request', () => ({
    event: 'mission-upsert-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: SHIP_EXTERIOR_FLIGHT_MODE_CHARACTER_ID,
    },
  }));
}