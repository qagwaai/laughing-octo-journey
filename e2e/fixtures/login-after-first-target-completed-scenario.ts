import { TEST_PLAYER } from '../helpers/auth-helper';
import { SocketIOMock } from './socket-mock';

const FIRST_TARGET_MISSION_ID = 'first-target';

export const CHARACTER_WITH_COMPLETED_FIRST_TARGET = {
  id: 'char-complete-1',
  characterName: 'Survey Veteran',
  level: 8,
  missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'completed' }],
};

export function characterListResponse(characters: object[]) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    characters,
  };
}

export function missionListResponse() {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    characterId: CHARACTER_WITH_COMPLETED_FIRST_TARGET.id,
    missions: [
      {
        missionId: FIRST_TARGET_MISSION_ID,
        status: 'completed',
        completedAt: '2026-05-10T00:00:00.000Z',
        updatedAt: '2026-05-10T00:00:00.000Z',
      },
    ],
  };
}

export function registerSharedSessionHandlers(mock: SocketIOMock): void {
  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: characterListResponse([CHARACTER_WITH_COMPLETED_FIRST_TARGET]),
  }));

  mock.on('game-join-request', () => null);

  mock.on('list-missions-request', () => ({
    event: 'list-missions-response',
    data: missionListResponse(),
  }));
}