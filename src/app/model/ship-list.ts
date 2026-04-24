import { Triple } from './triple';
import { CelestialBodyLocation } from './celestial-body-location';

export const SHIP_LIST_REQUEST_EVENT = 'ship-list-request';
export const SHIP_LIST_RESPONSE_EVENT = 'ship-list-response';

export interface ShipListRequest {
	playerName: string;
	characterId: string;
	sessionKey: string;
}

export interface ShipSummary {
	id: string;
	name: string;
	status?: string;
	model?: string;
	location?: CelestialBodyLocation;
	kinematics?: ShipKinematics;
}

export type SpatialReferenceKind = 'barycentric' | 'body-centered';

export interface SpatialReference {
	solarSystemId: string;
	referenceKind: SpatialReferenceKind;
	referenceBodyId?: string;
	distanceUnit: 'km';
	velocityUnit: 'km/s';
	epochMs: number;
}

export interface ShipKinematics {
	position: Triple;
	velocity: Triple;
	reference: SpatialReference;
}

export interface ShipListResponse {
	success: boolean;
	message: string;
	playerName: string;
	characterId: string;
	ships: ShipSummary[];
}
