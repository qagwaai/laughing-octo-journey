export const LOGIN_EVENT = 'login';
export const LOGIN_RESPONSE_EVENT = 'login-response';

/**
 * Canonical login failure reasons used by UI-specific messaging.
 */
export type LoginFailureReason = 'PLAYER_NOT_REGISTERED' | 'PASSWORD_MISMATCH' | 'UNKNOWN';

/**
 * Socket payload for player login.
 */
export interface LoginRequest {
  playerName: string;
  password: string;
  locale?: string;
}

/**
 * Socket response payload for login attempts.
 */
export interface LoginResponse {
  success: boolean;
  message: string;
  reason?: LoginFailureReason;
  playerId?: string;
  sessionKey?: string;
}
