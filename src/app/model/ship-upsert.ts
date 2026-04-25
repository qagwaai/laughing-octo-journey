import { CelestialBodyLocation } from './celestial-body-location';
import { ShipKinematics } from './ship-list';

export const SHIP_UPSERT_REQUEST_EVENT = 'ship-upsert-request';
export const SHIP_UPSERT_RESPONSE_EVENT = 'ship-upsert-response';

export interface ShipUpsertPayload {
	id: string;
	model: string;
	tier: number;
	location?: CelestialBodyLocation;
	kinematics?: ShipKinematics;
}

export interface ShipUpsertResponsePayload {
	id: string;
	shipName: string;
	model: string;
	tier: number;
	location?: CelestialBodyLocation;
	kinematics?: ShipKinematics;
}

export interface ShipUpsertRequest {
	playerName: string;
	characterId: string;
	sessionKey: string;
	ship: ShipUpsertPayload;
}

export interface ShipUpsertResponse {
	success: boolean;
	message: string;
	playerName: string;
	characterId: string;
	ship?: ShipUpsertResponsePayload;
}
