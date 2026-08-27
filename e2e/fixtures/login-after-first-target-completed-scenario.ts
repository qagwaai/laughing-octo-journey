import { TEST_PLAYER } from '../helpers/auth-helper';
import { SocketIOMock } from './socket-mock';
import {
  registerMissionCharacterList,
  registerMissionGameJoin,
  registerMissionList,
} from './mission-session-helpers';

const FIRST_TARGET_MISSION_ID = 'first-target';

export const CHARACTER_WITH_COMPLETED_FIRST_TARGET = {
  id: 'char-complete-1',
  characterName: 'Survey Veteran',
  level: 8,
  missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'completed' }],
};

const COMPLETED_FIRST_TARGET_MISSIONS = [
  {
    missionId: FIRST_TARGET_MISSION_ID,
    status: 'completed',
    completedAt: '2026-05-10T00:00:00.000Z',
    updatedAt: '2026-05-10T00:00:00.000Z',
  },
];

export function registerSharedSessionHandlers(mock: SocketIOMock): void {
  registerMissionCharacterList(mock, [CHARACTER_WITH_COMPLETED_FIRST_TARGET]);
  registerMissionGameJoin(mock);
  registerMissionList(mock, {
    characterId: CHARACTER_WITH_COMPLETED_FIRST_TARGET.id,
    missions: COMPLETED_FIRST_TARGET_MISSIONS,
  });
}