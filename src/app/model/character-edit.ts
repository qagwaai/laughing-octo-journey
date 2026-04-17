export const CHARACTER_EDIT_REQUEST_EVENT = 'character-edit';
export const CHARACTER_EDIT_RESPONSE_EVENT = 'character-edit-response';

export interface CharacterEditRequest {
	characterId: string;
	playerName: string;
	characterName: string;
	sessionKey: string;
}

export interface CharacterEditResponse {
	success: boolean;
	message: string;
	playerName: string;
	characterId: string;
	characterName?: string;
}
