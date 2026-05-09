export const INVALID_SESSION_EVENT = 'invalid-session';

/**
 * Socket payload indicating current session credentials are no longer valid.
 */
export interface InvalidSessionResponse {
  message: string;
}
