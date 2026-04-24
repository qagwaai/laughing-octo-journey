import { AsteroidKinematics } from './asteroid-kinematics';
import { AsteroidMaterialProfile } from './asteroid-materials';
import { CelestialBodyLocation } from './celestial-body-location';
import { Triple } from './triple';

export const CELESTIAL_BODY_LIST_REQUEST_EVENT = 'celestial-body-list-request';
export const CELESTIAL_BODY_LIST_RESPONSE_EVENT = 'celestial-body-list-response';

export interface CelestialBodyListRequest {
	playerName: string;
	sessionKey: string;
	solarSystemId: string;
	positionKm: Triple;
	distanceKm: number;
	limit?: number;
}

export interface CelestialBodyListItem {
	id: string;
	catalogId: string;
	solarSystemId: string;
	sourceScanId: string;
	createdByCharacterId: string;
	createdAt: string;
	updatedAt: string;
	location: CelestialBodyLocation;
	kinematics: AsteroidKinematics;
	composition: AsteroidMaterialProfile;
	/** Computed distance from the search origin, in kilometres. */
	distanceKm: number;
}

export interface CelestialBodyListResponse {
	success: boolean;
	message: string;
	playerName?: string;
	solarSystemId?: string;
	positionKm?: Triple;
	distanceKm?: number;
	celestialBodies: CelestialBodyListItem[];
}
