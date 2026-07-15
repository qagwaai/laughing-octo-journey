import { SocketIOMock } from './socket-mock';

export const TEST_PLAYER = 'localeplayer';

export const TEST_PASSWORD = 'testpassword123';

export function characterListResponse() {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    characters: [
      {
        id: 'char-1',
        characterName: 'Nova',
        level: 4,
      },
    ],
  };
}

export async function setupLoginSuccessMock(page: Parameters<SocketIOMock['constructor']>[0]) {
  const mock = new SocketIOMock(page);
  await mock.setup();

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

  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: characterListResponse(),
  }));

  return { mock, loginResponse, TEST_PLAYER };
}

export async function openLoginAndWaitForSocket(
  page: Parameters<SocketIOMock['constructor']>[0],
  mock: SocketIOMock,
) {
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