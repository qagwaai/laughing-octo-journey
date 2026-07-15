import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { loginViaUI } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { TEST_PLAYER } from '../helpers/auth-helper';
import { SocketIOMock } from './socket-mock';

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

function missionListResponseWith(missions: object[]) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    characterId: TRANSITION_TEST_CHARACTER.id,
    missions,
  };
}

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

function characterListResponse(characters: object[]) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    characters,
  };
}

export function registerFirstTargetToM01TransitionMock(mock: SocketIOMock, missions: object[]): void {
  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: characterListResponse([
      {
        ...TRANSITION_TEST_CHARACTER,
        // Keep join path deterministic (game-main) regardless of mission-list test data.
        missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' }],
      },
    ]),
  }));

  mock.on('game-join-request', () => null);

  // In-progress join path now resolves active ship before routing.
  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: TRANSITION_TEST_CHARACTER.id,
      ships: [TRANSITION_STARTER_SHIP],
    },
  }));

  mock.on('mission-list-request', () => ({
    event: 'mission-list-response',
    data: missionListResponseWith(missions),
  }));

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

  mock.on('list-missions-request', () => ({
    event: 'list-missions-response',
    data: missionListResponseWith(missions),
  }));
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