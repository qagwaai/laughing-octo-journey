export const LOGIN_EVENT = 'login';
export const LOGIN_RESPONSE_EVENT = 'login-response';

/**
 * Canonical login failure reasons used by UI-specific messaging.
 */
export type LoginFailureReason = 'invalid_request' | 'unavailable' | 'storage_failure' | 'data_unavailable' |
  'invalid_credentials' | 'conflict' | 'outcome_unknown';

/**
 * Socket payload for player login.
 */
export interface LoginRequest {
  playerName: string;
  password: string;
  locale?: string;
  correlationId?: string;
}

/**
 * Socket response payload for login attempts.
 */
export interface LoginResponse {
  success: boolean;
  message: string;
  reason?: LoginFailureReason;
  correlationId?: string;
  clientError?: 'timeout' | 'invalid_response';
  playerId?: string;
  sessionKey?: string;
}
