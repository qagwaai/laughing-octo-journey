export const CHARACTER_EDIT_REQUEST_EVENT = 'character-edit';
export const CHARACTER_EDIT_RESPONSE_EVENT = 'character-edit-response';

/**
 * Socket payload for renaming/updating character metadata.
 */
export interface CharacterEditRequest {
  characterId: string;
  playerName: string;
  characterName: string;
  sessionKey: string;
}

/**
 * Socket response payload for character edit operations.
 */
export interface CharacterEditResponse {
  success: boolean;
  message: string;
  playerName: string;
  characterId: string;
  characterName?: string;
}
