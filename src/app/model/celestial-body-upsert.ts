import { AsteroidKinematics } from './asteroid-kinematics';
import { AsteroidMaterialProfile } from './asteroid-materials';
import { CelestialBodyLocation } from './celestial-body-location';

export const CELESTIAL_BODY_UPSERT_REQUEST_EVENT = 'celestial-body-upsert-request';
export const CELESTIAL_BODY_UPSERT_RESPONSE_EVENT = 'celestial-body-upsert-response';

export const DEFAULT_SOLAR_SYSTEM_ID = 'sol';

export interface CelestialBodyUpsertEntity {
	/** Stable unique identifier for this celestial body record. */
	id: string;
	/** Secondary catalog identifier for indexing/search. */
	catalogId: string;
	/** Parent solar system reference, used for filtering. */
	solarSystemId: string;
	/** Scan/source identifier used for idempotent upsert behavior. */
	sourceScanId: string;
	/** Character ID that created/discovered this body. */
	createdByCharacterId: string;
	/** ISO-8601 UTC timestamp. */
	createdAt: string;
	/** ISO-8601 UTC timestamp. */
	updatedAt: string;
	location: CelestialBodyLocation;
	kinematics: AsteroidKinematics;
	composition: AsteroidMaterialProfile;
}

export interface CelestialBodyUpsertRequest {
	sessionKey: string;
	celestialBody: CelestialBodyUpsertEntity;
}

export interface CelestialBodyUpsertResponse {
	success: boolean;
	message: string;
	celestialBody?: CelestialBodyUpsertEntity;
}
