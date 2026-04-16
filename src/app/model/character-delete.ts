export const CHARACTER_DELETE_REQUEST_EVENT = 'character-delete-request';
export const CHARACTER_DELETE_RESPONSE_EVENT = 'character-delete-response';

export interface CharacterDeleteRequest {
	playerName: string;
	characterId: string;
	characterName?: string;
}

export interface CharacterDeleteResponse {
	success: boolean;
	message: string;
	playerName: string;
	characterId?: string;
}
