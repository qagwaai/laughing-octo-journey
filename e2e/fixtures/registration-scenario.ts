import { SocketIOMock } from './socket-mock';

export const REGISTER_RESPONSE = {
  success: true,
  message: 'Registration successful!',
};

export const LOGIN_RESPONSE = {
  success: true,
  message: 'Login successful!',
  sessionKey: 'session-001',
};

export function characterListResponse(playerName: string) {
  return {
    success: true,
    message: '',
    playerName,
    characters: [],
  };
}

export async function setupSuccessfulRegistrationMock(page: Parameters<SocketIOMock['constructor']>[0]) {
  const mock = new SocketIOMock(page);
  await mock.setup();

  mock.on('register', () => ({
    event: 'register-response',
    data: REGISTER_RESPONSE,
  }));

  mock.on('login', () => ({
    event: 'login-response',
    data: LOGIN_RESPONSE,
  }));

  return { mock };
}