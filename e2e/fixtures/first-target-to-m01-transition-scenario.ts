import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { loginViaUI } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { TEST_PLAYER } from '../helpers/auth-helper';
import { SocketIOMock } from './socket-mock';
import {
  registerMissionCharacterList,
  registerMissionGameJoin,
  registerMissionList,
  registerMissionShipListByOwner,
} from './mission-session-helpers';

const FIRST_TARGET_MISSION_ID = 'first-target';
const TRANSITION_TEST_CHARACTER = { id: 'char-mission-test', characterName: 'Pioneer One', level: 1 };
const TRANSITION_STARTER_SHIP = {
  id: 'ship-starter-1',
  name: 'Scavenger Pod',
  model: 'Scavenger Pod',
  tier: 1,
  status: 'ACTIVE',
  spatial: {
    solarSystemId: 'sol',
    frame: 'barycentric',
    positionKm: { x: 350000000, y: 0, z: 0 },
    epochMs: 1715000000000,
  },
};

function missionUpsertResponse(missionId: string, status: string) {
  return {
    success: true,
    message: 'Mission updated.',
    playerName: TEST_PLAYER,
    characterId: TRANSITION_TEST_CHARACTER.id,
    missionId,
    status,
  };
}

function missionAddResponse(missionId: string) {
  return {
    success: true,
    message: 'Mission added.',
    playerName: TEST_PLAYER,
    characterId: TRANSITION_TEST_CHARACTER.id,
    missionId,
  };
}

export function registerFirstTargetToM01TransitionMock(mock: SocketIOMock, missions: object[]): void {
  registerMissionCharacterList(mock, [
    {
      ...TRANSITION_TEST_CHARACTER,
      // Keep join path deterministic (game-main) regardless of mission-list test data.
      missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' }],
    },
  ]);

  registerMissionGameJoin(mock);

  // In-progress join path now resolves active ship before routing.
  registerMissionShipListByOwner(mock, {
    characterId: TRANSITION_TEST_CHARACTER.id,
    ships: [TRANSITION_STARTER_SHIP],
  });

  registerMissionList(mock, {
    characterId: TRANSITION_TEST_CHARACTER.id,
    missions,
    requestEvent: 'mission-list-request',
    responseEvent: 'mission-list-response',
  });

  mock.on('mission-upsert-request', (data) => {
    const req = data as { missionId?: string; status?: string };
    return {
      event: 'mission-upsert-response',
      data: missionUpsertResponse(req.missionId ?? '', req.status ?? ''),
    };
  });

  mock.on('mission-add-request', (data) => {
    const req = data as { missionId?: string };
    return {
      event: 'mission-add-response',
      data: missionAddResponse(req.missionId ?? ''),
    };
  });

  registerMissionList(mock, {
    characterId: TRANSITION_TEST_CHARACTER.id,
    missions,
  });
}

export async function setupFirstTargetToM01MissionBoardTest(
  page: Page,
  options: {
    missions?: object[];
  } = {},
): Promise<{ mock: SocketIOMock }> {
  const mock = new SocketIOMock(page);
  const gameShell = new GameShellPage(page);
  await mock.setup();

  const missions = options.missions ?? [];
  registerFirstTargetToM01TransitionMock(mock, missions);

  await loginViaUI(page, mock);
  await gameShell.joinGame('Join Game in Progress');
  await expect(page).toHaveURL(/left:game-main|left:opening-cold-boot/, { timeout: 15_000 });

  await gameShell.openMissionBoard();

  return { mock };
}