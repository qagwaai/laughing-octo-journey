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
	states?: Array<'unscanned' | 'active' | 'destroyed'>;
	createdByCharacterId?: string;
	missionId?: string;
}

export interface CelestialBodyListItem {
	id: string;
	catalogId: string;
	solarSystemId: string;
	sourceScanId: string;
	createdByCharacterId: string;
	missionId?: string;
	missionInstanceId?: string | null;
	createdAt: string;
	updatedAt: string;
	location: CelestialBodyLocation;
	kinematics: AsteroidKinematics;
	composition?: AsteroidMaterialProfile;
	state?: 'unscanned' | 'active' | 'destroyed';
	destroyedAt?: string | null;
	destroyedReason?: string | null;
	debrisSeed?: number | null;
	debris?: Array<{
		material: string;
		rarity: 'Common' | 'Uncommon' | 'Rare' | 'Exotic';
		quantity: number;
		itemType: string;
	}>;
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
