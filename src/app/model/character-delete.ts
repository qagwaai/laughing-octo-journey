export const CHARACTER_DELETE_REQUEST_EVENT = 'character-delete-request';
export const CHARACTER_DELETE_RESPONSE_EVENT = 'character-delete-response';

/**
 * Socket payload for deleting a character record.
 */
export interface CharacterDeleteRequest {
  playerName: string;
  characterId: string;
  characterName?: string;
  sessionKey: string;
}

/**
 * Socket response payload for character deletion attempts.
 */
export interface CharacterDeleteResponse {
  success: boolean;
  message: string;
  playerName: string;
  characterId?: string;
}
