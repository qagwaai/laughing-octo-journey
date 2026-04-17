export const GAME_JOIN_REQUEST_EVENT = 'game-join';
export const GAME_JOIN_RESPONSE_EVENT = 'game-join-response';

export interface GameJoinRequest {
	playerName: string;
	characterId: string;
	sessionKey: string;
}

export interface GameJoinResponse {
	success: boolean;
	message: string;
	playerName: string;
	characterId: string;
}
