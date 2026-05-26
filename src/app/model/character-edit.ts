export const CHARACTER_EDIT_REQUEST_EVENT = 'character-edit-request';
export const CHARACTER_EDIT_RESPONSE_EVENT = 'character-edit-response';

export interface CharacterEditRequestIdentity {
  operation: string;
  entityType: string;
  containerId: string;
}

/**
 * Socket payload for renaming/updating character metadata.
 */
export interface CharacterEditRequest {
  characterId: string;
  playerName: string;
  characterName: string;
  sessionKey: string;
  correlationId?: string;
  correlationSource?: string;
  requestIdentity?: CharacterEditRequestIdentity;
}

/**
 * Socket response payload for character edit operations.
 */
export interface CharacterEditResponse {
  success: boolean;
  message: string;
  correlationId: string;
  requestIdentity: CharacterEditRequestIdentity;
  playerName: string;
  characterId: string;
  characterName?: string;
}
