export const GAME_JOIN_REQUEST_EVENT = 'game-join-request';
export const GAME_JOIN_RESPONSE_EVENT = 'game-join-response';

/**
 * Socket payload used to join a game session with selected character.
 */
export interface GameJoinRequest {
  playerName: string;
  characterId: string;
  sessionKey: string;
}

/**
 * Socket response payload returned after game-join request processing.
 */
export interface GameJoinResponse {
  success: boolean;
  message: string;
  playerName: string;
  characterId: string;
}
