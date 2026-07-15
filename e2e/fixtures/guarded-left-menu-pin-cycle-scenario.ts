import { TEST_PLAYER } from '../helpers/auth-helper';
import { SocketIOMock } from './socket-mock';

const FIRST_TARGET_MISSION_ID = 'first-target';

const characterWithStartedMission = {
  id: 'char-3',
  characterName: 'Scout Alpha',
  level: 2,
  missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' }],
};

function characterListResponse(characters: object[]) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    characters,
  };
}

export function registerGuardedLeftMenuPinCycleHandlers(mock: SocketIOMock): void {
  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: characterListResponse([characterWithStartedMission]),
  }));

  mock.on('game-join-request', () => null);

  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: 'char-3',
      ships: [
        {
          id: 'ship-1',
          name: 'Nomad',
          model: 'Scavenger Pod',
          tier: 1,
          status: 'ACTIVE',
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: { x: 350000000, y: 0, z: 10000000 },
            epochMs: 1715000000000,
          },
        },
      ],
    },
  }));

  mock.on('list-missions-request', () => ({
    event: 'list-missions-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: 'char-3',
      missions: [
        {
          missionId: FIRST_TARGET_MISSION_ID,
          status: 'active',
          startedAt: '2026-04-01T10:00:00.000Z',
          updatedAt: '2026-04-02T10:00:00.000Z',
        },
      ],
    },
  }));
}