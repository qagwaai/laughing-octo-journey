export const LAUNCH_ITEM_REQUEST_EVENT = 'launch-item-request';
export const LAUNCH_ITEM_RESPONSE_EVENT = 'launch-item-response';

export interface LaunchItemRequest {
	playerName: string;
	characterId: string;
	shipId: string;
	sessionKey: string;
	targetCelestialBodyId: string;
	hotkey: 1 | 2 | 3 | 4 | 5;
	itemId: string;
	itemType: string;
}

export interface LaunchItemResponse {
	success: boolean;
	message: string;
	playerName: string;
	characterId: string;
	shipId: string;
	targetCelestialBodyId: string;
	hotkey: 1 | 2 | 3 | 4 | 5;
	itemId: string;
	itemType: string;
}
