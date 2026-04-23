import { DroneSummary } from './drone-list';

export const DRONE_UPSERT_REQUEST_EVENT = 'drone-upsert-request';
export const DRONE_UPSERT_RESPONSE_EVENT = 'drone-upsert-response';

export interface DroneUpsertRequest {
	playerName: string;
	characterId: string;
	sessionKey: string;
	drone: DroneSummary;
}

export interface DroneUpsertResponse {
	success: boolean;
	message: string;
	playerName: string;
	characterId: string;
	drone?: DroneSummary;
}
