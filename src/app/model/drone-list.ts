import { Triple } from './triple';
import { CelestialBodyLocation } from './celestial-body-location';

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
	location?: CelestialBodyLocation;
	kinematics?: DroneKinematics;
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

export interface DroneKinematics {
	position: Triple;
	velocity: Triple;
	reference: SpatialReference;
}

export interface DroneListResponse {
	success: boolean;
	message: string;
	playerName: string;
	characterId: string;
	drones: DroneSummary[];
}
