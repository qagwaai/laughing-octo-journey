import { TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { LoginPage } from '../page-objects/login.page';
import type { Page } from '@playwright/test';
import { SocketIOMock } from './socket-mock';

const FIRST_TARGET_MISSION_ID = 'first-target';
export const TEST_PASSWORD = 'testpassword123';

export async function setupLocaleOpeningMissionFlowTest(
  page: Page,
  options: {
    characterId: string;
    characterName: string;
    missionStatus: 'not-started' | 'active';
    includeMissionAndShipHandlers?: boolean;
  },
): Promise<{
  mock: SocketIOMock;
  gameShell: GameShellPage;
}> {
  const mock = new SocketIOMock(page);
  const gameShell = new GameShellPage(page);
  await mock.setup();

  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: characterListResponse(options.characterId, options.characterName, [
      { missionId: FIRST_TARGET_MISSION_ID, status: options.missionStatus },
    ]),
  }));

  if (options.includeMissionAndShipHandlers) {
    mock.on('mission-list-request', () => ({
      event: 'mission-list-response',
      data: missionListResponse(options.characterId),
    }));

    mock.on('ship-list-by-owner-request', () => ({
      event: 'ship-list-by-owner-response',
      data: shipListResponse(options.characterId),
    }));
  }

  await loginWithItalianLocale(page, mock);
  return { mock, gameShell };
}

export function setupLoginHandlers(mock: SocketIOMock) {
  const loginResponse = {
    success: true,
    message: 'Login successful',
    playerId: 'player-id-001',
    sessionKey: 'session-key-001',
  };

  mock.on('login', () => ({
    event: 'login-response',
    data: loginResponse,
  }));

  return loginResponse;
}

export async function openLoginAndWaitForSocket(page: Parameters<SocketIOMock['constructor']>[0], mock: SocketIOMock) {
  const socketConnectedInApp = page
    .waitForEvent('console', {
      predicate: (msg) => msg.type() === 'log' && msg.text().includes('Socket connected:'),
      timeout: 10_000,
    })
    .catch(() => null);

  await page.goto('/(left:login)');
  await mock.connected;
  await socketConnectedInApp;
}

export async function loginWithItalianLocale(page: Parameters<SocketIOMock['constructor']>[0], mock: SocketIOMock) {
  const loginResponse = setupLoginHandlers(mock);
  const loginPage = new LoginPage(page);
  await openLoginAndWaitForSocket(page, mock);

  await loginPage.localeSelect.selectOption('it');
  await loginPage.playerNameInput.fill(TEST_PLAYER);
  await loginPage.passwordInput.fill(TEST_PASSWORD);
  await loginPage.submitButton.click();

  mock.push('login-response', loginResponse);
  await page.waitForURL(/left:character-list/, { timeout: 10_000 });

  await page.locator('.page-main h1').waitFor({ state: 'visible' });
}

export function characterListResponse(characterId: string, characterName: string, missions: Array<{ missionId: string; status: string }>) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    characters: [
      {
        id: characterId,
        characterName,
        level: characterName === 'Nova' ? 4 : 5,
        missions,
      },
    ],
  };
}

export function missionListResponse(characterId: string) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    characterId,
    missions: [
      {
        missionId: FIRST_TARGET_MISSION_ID,
        status: 'active',
        startedAt: '2026-05-01T10:00:00.000Z',
        updatedAt: '2026-05-01T10:05:00.000Z',
      },
    ],
  };
}

export function shipListResponse(characterId: string) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    characterId,
    ships: [
      {
        id: 'ship-it-2',
        name: 'Astra Pod',
        model: 'Scavenger Pod',
        tier: 1,
        status: 'ACTIVE',
        spatial: {
          solarSystemId: 'sol',
          frame: 'barycentric',
          positionKm: { x: 350000000, y: 0, z: 0 },
          epochMs: 1715000000000,
        },
      },
    ],
  };
}