export const DRONE_LIST_REQUEST_EVENT = 'drone-list-request';
export const DRONE_LIST_RESPONSE_EVENT = 'drone-list-response';

export interface DroneListRequest {
	playerName: string;
	characterId: string;
	sessionKey: string;
}

export interface DroneSummary {
	id: string;
	name: string;
	status?: string;
	model?: string;
}

export interface DroneListResponse {
	success: boolean;
	message: string;
	playerName: string;
	characterId: string;
	drones: DroneSummary[];
}
