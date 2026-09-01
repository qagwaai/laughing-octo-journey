export { openLoginAndWaitForSocket } from '../helpers/auth-helper';
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
