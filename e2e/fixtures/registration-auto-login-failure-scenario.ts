import { SocketIOMock } from './socket-mock';

export const REGISTER_RESPONSE = {
  success: true,
  message: 'Registration successful!',
};

export const LOGIN_FAILURE_RESPONSE = {
  success: false,
  message: 'Auto-login failed. Please try again.',
};

export function registerAutoLoginFailureHandlers(mock: SocketIOMock): void {
  mock.on('register', () => ({
    event: 'register-response',
    data: REGISTER_RESPONSE,
  }));

  mock.on('login', () => ({
    event: 'login-response',
    data: LOGIN_FAILURE_RESPONSE,
  }));
}