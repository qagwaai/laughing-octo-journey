export const CHARACTER_DELETE_REQUEST_EVENT = 'character-delete-request';
export const CHARACTER_DELETE_RESPONSE_EVENT = 'character-delete-response';

export interface CharacterDeleteRequestIdentity {
  operation: string;
  entityType: string;
  containerId: string;
}

/**
 * Socket payload for deleting a character record.
 */
export interface CharacterDeleteRequest {
  playerName: string;
  characterId: string;
  characterName?: string;
  sessionKey: string;
  correlationId?: string;
  correlationSource?: string;
  requestIdentity?: CharacterDeleteRequestIdentity;
}

/**
 * Socket response payload for character deletion attempts.
 */
export interface CharacterDeleteResponse {
  success: boolean;
  message: string;
  correlationId: string;
  requestIdentity: CharacterDeleteRequestIdentity;
  playerName: string;
  characterId?: string;
}
