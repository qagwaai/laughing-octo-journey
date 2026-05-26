export const CHARACTER_ADD_REQUEST_EVENT = 'character-add-request';
export const CHARACTER_ADD_RESPONSE_EVENT = 'character-add-response';

export interface CharacterAddRequestIdentity {
  operation: string;
  entityType: string;
  containerId: string;
}

/**
 * Socket payload for creating a new character under a player account.
 */
export interface CharacterAddRequest {
  playerName: string;
  characterName: string;
  sessionKey: string;
  correlationId?: string;
  correlationSource?: string;
  requestIdentity?: CharacterAddRequestIdentity;
}

/**
 * Socket response payload for character creation attempts.
 */
export interface CharacterAddResponse {
  success: boolean;
  message: string;
  correlationId: string;
  requestIdentity: CharacterAddRequestIdentity;
  playerName: string;
  characterName?: string;
  characterId?: string;
}
