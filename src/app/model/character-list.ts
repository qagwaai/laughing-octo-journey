export const CHARACTER_LIST_REQUEST_EVENT = 'character-list-request';
export const CHARACTER_LIST_RESPONSE_EVENT = 'character-list-response';

export interface CharacterListRequest {
	playerName: string;
	sessionKey: string;
}

export interface PlayerCharacterSummary {
	id: string;
	characterName: string;
	level?: number;
	createdAt?: string;
}

export interface CharacterListResponse {
	success: boolean;
	message: string;
	playerName: string;
	characters: PlayerCharacterSummary[];
}
