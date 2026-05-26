export const GAME_JOIN_REQUEST_EVENT = 'game-join-request';
export const GAME_JOIN_RESPONSE_EVENT = 'game-join-response';

export interface GameJoinRequestIdentity {
  operation: string;
  entityType: string;
  containerId: string;
}

/**
 * Socket payload used to join a game session with selected character.
 */
export interface GameJoinRequest {
  playerName: string;
  characterId: string;
  sessionKey: string;
  correlationId?: string;
  correlationSource?: string;
  requestIdentity?: GameJoinRequestIdentity;
}

/**
 * Socket response payload returned after game-join request processing.
 */
export interface GameJoinResponse {
  success: boolean;
  message: string;
  correlationId: string;
  requestIdentity: GameJoinRequestIdentity;
  playerName: string;
  characterId: string;
}
