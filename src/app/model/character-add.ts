export const CHARACTER_ADD_REQUEST_EVENT = 'character-add-request';
export const CHARACTER_ADD_RESPONSE_EVENT = 'character-add-response';

export interface CharacterAddRequest {
	playerName: string;
	characterName: string;
}

export interface CharacterAddResponse {
	success: boolean;
	message: string;
	playerName: string;
	characterName?: string;
	characterId?: string;
}
