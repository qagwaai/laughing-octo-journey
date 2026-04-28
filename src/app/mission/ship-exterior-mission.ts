import { FIRST_TARGET_MISSION_ID } from '../model/mission.locale';
import type { LaunchItemResponse } from '../model/launch-item';
import type { AsteroidScanSample } from '../model/ship-exterior-asteroid-sample';
import { FIRST_TARGET_SHIP_EXTERIOR_MISSION } from './first-target-ship-exterior-mission';

export interface ShipExteriorMissionTargetingParams {
	shipModel: string;
	hasExpendableDartDrone: boolean;
}

export type ShipExteriorRawInventory = unknown;

export interface ShipExteriorMissionLaunchResponseResolution {
	removeAsteroidSampleIds: string[];
	shouldRefreshAfterLaunch: boolean;
}

export const SHIP_EXTERIOR_MISSION_IDS = {
	firstTarget: FIRST_TARGET_MISSION_ID,
} as const;

export interface ShipExteriorMissionDefinition {
	readonly missionId: string;
	canTargetAsteroids(params: ShipExteriorMissionTargetingParams): boolean;
	resolveTargetingCapabilityFromInventory(rawInventory: ShipExteriorRawInventory): boolean;
	resolveLaunchItemResponse(params: {
		response: LaunchItemResponse;
		asteroidSamples: readonly AsteroidScanSample[];
	}): ShipExteriorMissionLaunchResponseResolution;
	createFallbackAsteroidSamples(): import('../model/ship-exterior-asteroid-sample').AsteroidScanSample[];
	createNewAsteroidSamplesAroundShip(params: {
		playerName: string;
		characterId: string;
		center: import('../model/triple').Triple;
		launchSeedHint?: number | null;
	}): import('../model/ship-exterior-asteroid-sample').AsteroidScanSample[];
	createResumedAsteroidSamples(params: {
		playerName: string;
		characterId: string;
		center: import('../model/triple').Triple;
		launchSeedHint?: number | null;
		existingBodies: import('../model/celestial-body-list').CelestialBodyListItem[];
	}): import('../model/ship-exterior-asteroid-sample').AsteroidScanSample[];
}

const SHIP_EXTERIOR_MISSION_REGISTRY = new Map<string, ShipExteriorMissionDefinition>([
	[FIRST_TARGET_SHIP_EXTERIOR_MISSION.missionId, FIRST_TARGET_SHIP_EXTERIOR_MISSION],
]);

export function resolveShipExteriorMission(missionId?: string | null): ShipExteriorMissionDefinition {
	const normalizedMissionId = missionId?.trim() || FIRST_TARGET_MISSION_ID;
	return SHIP_EXTERIOR_MISSION_REGISTRY.get(normalizedMissionId) ?? FIRST_TARGET_SHIP_EXTERIOR_MISSION;
}