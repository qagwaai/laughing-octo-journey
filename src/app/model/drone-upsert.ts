import { CelestialBodyLocation } from './celestial-body-location';
import { DroneKinematics } from './drone-list';

export const DRONE_UPSERT_REQUEST_EVENT = 'drone-upsert-request';
export const DRONE_UPSERT_RESPONSE_EVENT = 'drone-upsert-response';

export interface DroneUpsertPayload {
	id: string;
	location?: CelestialBodyLocation;
	kinematics?: DroneKinematics;
}

export interface DroneUpsertResponsePayload {
	id: string;
	droneName?: string;
	location?: CelestialBodyLocation;
	kinematics?: DroneKinematics;
}

export interface DroneUpsertRequest {
	playerName: string;
	characterId: string;
	sessionKey: string;
	drone: DroneUpsertPayload;
}

export interface DroneUpsertResponse {
	success: boolean;
	message: string;
	playerName: string;
	characterId: string;
	drone?: DroneUpsertResponsePayload;
}
