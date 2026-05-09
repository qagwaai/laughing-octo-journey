export const REGISTER_EVENT = 'register';
export const REGISTER_RESPONSE_EVENT = 'register-response';

/**
 * Socket payload for registering a new player account.
 */
export interface RegisterRequest {
  playerName: string;
  email: string;
  password: string;
  locale?: string;
}

/**
 * Socket response payload for account registration attempts.
 */
export interface RegisterResponse {
  success: boolean;
  message: string;
  playerId?: string;
  sessionKey?: string;
}
