import {
	DEFAULT_CLUSTER_SPREAD_KM,
	generateRandomAsteroidBeltClusterCenterKm,
	generateRandomCelestialBodyLocationNear,
} from '../model/celestial-body-location';
import type { CelestialBodyListItem } from '../model/celestial-body-list';
import { generateRandomAsteroidKinematics } from '../model/asteroid-kinematics';
import {
	ASTEROID_MATERIALS,
	pickWeightedAsteroidMaterial,
	type AsteroidMaterialProfile,
} from '../model/asteroid-materials';
import { coerceShipInventory } from '../model/ship-list';
import type { LaunchItemResponse } from '../model/launch-item';
import type { AsteroidScanSample } from '../model/ship-exterior-asteroid-sample';
import { FIRST_TARGET_MISSION_ID } from '../model/mission.locale';
import type { MissionStatus } from '../model/mission';
import type { Triple } from '../model/triple';
import {
	createInitialMissionGateState,
	type ShipExteriorMissionDefinition,
	type ShipExteriorMissionGateState,
	type ShipExteriorMissionGateStepDefinition,
} from './ship-exterior-mission';

function normalizeInventoryToken(value: unknown): string {
	if (typeof value !== 'string') {
		return '';
	}

	return value
		.trim()
		.toLowerCase()
		.replace(/[_\s]+/g, '-')
		.replace(/[^a-z0-9-]/g, '');
}

function hasExpendableDartDroneInInventory(rawInventory: unknown): boolean {
	const normalizedTarget = 'expendable-dart-drone';
	const normalizedDisplayTarget = 'expendable-dart-drone';

	const coercedInventory = coerceShipInventory(rawInventory);
	if (coercedInventory.some((item) => normalizeInventoryToken(item.itemType) === normalizedTarget)) {
		return true;
	}

	if (!Array.isArray(rawInventory)) {
		return false;
	}

	return rawInventory.some((rawItem) => {
		if (!rawItem || typeof rawItem !== 'object') {
			return false;
		}

		const item = rawItem as Record<string, unknown>;
		const itemType = normalizeInventoryToken(item['itemType']);
		if (itemType === normalizedTarget) {
			return true;
		}

		const displayName = normalizeInventoryToken(item['displayName']);
		return displayName === normalizedDisplayTarget;
	});
}

const IRON_MATERIAL = ASTEROID_MATERIALS.find((m) => m.material === 'Iron')!;

const FIRST_TARGET_GATE_STEPS: readonly ShipExteriorMissionGateStepDefinition[] = [
	{
		key: 'identify_iron_asteroid',
		objectiveText: 'Objective: Identify an Iron asteroid via full scan.',
		completionToastMessage: 'Mission update: Iron asteroid identified.',
	},
	{
		key: 'neutralize_identified_asteroid',
		objectiveText: 'Objective unlocked: Neutralize the identified asteroid using a launchable payload.',
		completionToastMessage: 'Mission update: Target neutralized.',
		prerequisiteStepKeys: ['identify_iron_asteroid'],
	},
	{
		key: 'repair_scavenger_pod',
		objectiveText: 'Objective unlocked: Repair the Scavenger Pod at the Repair & Retrofit station.',
		completionToastMessage: 'Mission update: Scavenger Pod repaired.',
		prerequisiteStepKeys: ['neutralize_identified_asteroid'],
	},
];

function generateMaterialAssignments(count: number, random: () => number): AsteroidMaterialProfile[] {
	const materials = Array.from({ length: count }, () => pickWeightedAsteroidMaterial(random));
	if (count > 0 && !materials.some((m) => m.material === 'Iron')) {
		const replaceIndex = Math.floor(random() * count);
		materials[replaceIndex] = IRON_MATERIAL;
	}
	return materials;
}

function hashToSeed(input: string): number {
	let hash = 2166136261;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

function seededRandom(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (Math.imul(1664525, state) + 1013904223) >>> 0;
		return state / 0x100000000;
	};
}

function resolveAsteroidSeed(
	playerName: string,
	characterId: string,
	center: Triple,
	launchSeedHint: number | null | undefined,
): number {
	const baseSeed = hashToSeed(`${playerName}::${characterId}::${center.x}:${center.y}:${center.z}`);
	if (launchSeedHint === null || launchSeedHint === undefined || !Number.isFinite(launchSeedHint)) {
		return baseSeed;
	}

	return (baseSeed ^ (launchSeedHint >>> 0)) >>> 0;
}

function generateAsteroidSamples(
	clusterCenterKm?: Triple,
	random: () => number = Math.random,
	count?: number,
	preAssignedMaterials?: AsteroidMaterialProfile[],
): AsteroidScanSample[] {
	const resolvedCount = count ?? (Math.floor(random() * 16) + 5);
	const samples: AsteroidScanSample[] = [];
	const resolvedClusterCenterKm = clusterCenterKm ?? generateRandomAsteroidBeltClusterCenterKm(random);

	for (let i = 0; i < resolvedCount; i++) {
		const baseAngle = (i / resolvedCount) * Math.PI * 2;
		const angleJitter = (random() - 0.5) * (Math.PI / resolvedCount);
		const angle = baseAngle + angleJitter;

		const distance = 6 + random() * 14;
		const x = Math.cos(angle) * distance;
		const z = Math.sin(angle) * distance;
		const solarSystemLocation = generateRandomCelestialBodyLocationNear(resolvedClusterCenterKm, undefined, random);
		const y = (random() - 0.5) * 8;
		const basePosition: [number, number, number] = [+x.toFixed(2), +y.toFixed(2), +z.toFixed(2)];
		const capturedKinematics = generateRandomAsteroidKinematics(random);
		const velocity = capturedKinematics.velocityKmPerSec;
		const speedKmPerSec = Math.hypot(velocity.x, velocity.y, velocity.z);
		const speedFactor = Math.min(1, speedKmPerSec / 32);

		samples.push({
			id: `sample-a${i + 1}`,
			serverCelestialBodyId: null,
			position: basePosition,
			basePosition,
			scanProgress: 0,
			scanned: false,
			revealedMaterial: preAssignedMaterials?.[i] ?? null,
			revealedKinematics: null,
			solarSystemLocation,
			clusterCenterKm: resolvedClusterCenterKm,
			capturedKinematics,
			motionPhase: random() * Math.PI * 2,
			motionRate: 0.2 + speedFactor * 0.55,
			motionRadius: 0.2 + speedFactor * 0.95,
			bobAmplitude: 0.06 + random() * 0.4,
		});
	}

	return samples;
}

export const FIRST_TARGET_SHIP_EXTERIOR_MISSION: ShipExteriorMissionDefinition = {
	missionId: FIRST_TARGET_MISSION_ID,
	canTargetAsteroids(params) {
		return params.shipModel === 'Scavenger Pod' && params.hasExpendableDartDrone;
	},
	resolveTargetingCapabilityFromInventory(rawInventory) {
		return hasExpendableDartDroneInInventory(rawInventory);
	},
	resolveLaunchItemResponse({ response, asteroidSamples }) {
		if (!response.success) {
			return {
				removeAsteroidSampleIds: [],
				shouldRefreshAfterLaunch: false,
			};
		}

		if (response.resolution?.outcome !== 'target-destroyed') {
			return {
				removeAsteroidSampleIds: [],
				shouldRefreshAfterLaunch: true,
			};
		}

		const removeAsteroidSampleIds = asteroidSamples
			.filter(
				(sample) =>
					sample.serverCelestialBodyId === response.targetCelestialBodyId ||
					sample.id === response.targetCelestialBodyId,
			)
			.map((sample) => sample.id);

		return {
			removeAsteroidSampleIds,
			shouldRefreshAfterLaunch: true,
		};
	},
	createFallbackAsteroidSamples() {
		const count = Math.floor(Math.random() * 16) + 5;
		const materials = generateMaterialAssignments(count, Math.random);
		return generateAsteroidSamples(undefined, Math.random, count, materials);
	},
	createNewAsteroidSamplesAroundShip({ playerName, characterId, center, launchSeedHint }) {
		const rng = seededRandom(resolveAsteroidSeed(playerName, characterId, center, launchSeedHint));
		const count = Math.floor(rng() * 16) + 5;
		const materials = generateMaterialAssignments(count, rng);
		return generateAsteroidSamples(center, rng, count, materials);
	},
	createResumedAsteroidSamples({ playerName, characterId, center, existingBodies, launchSeedHint }) {
		const rng = seededRandom(resolveAsteroidSeed(playerName, characterId, center, launchSeedHint));
		const activeBodies = existingBodies.filter((body) => body.state !== 'destroyed');
		const existingBySourceScanId = new Map(
			activeBodies
				.filter((body) => typeof body.sourceScanId === 'string' && body.sourceScanId.trim().length > 0)
				.map((body) => [body.sourceScanId, body] as const),
		);
		const randomTarget = Math.floor(rng() * 16) + 5;
		const total = Math.max(activeBodies.length, randomTarget);
		const materials = generateMaterialAssignments(total, rng);
		const allSamples = generateAsteroidSamples(center, rng, total, materials);

		return allSamples.map((sample, index) => {
			const existingBody = existingBySourceScanId.get(sample.id) ?? activeBodies[index];
			if (!existingBody) {
				return sample;
			}

			const shouldTreatAsScanned = existingBody.state !== 'unscanned';
			const resolvedKinematics = existingBody.kinematics ?? sample.capturedKinematics;
			const resolvedLocation = existingBody.location ?? sample.solarSystemLocation;
			const resolvedMaterial = existingBody.composition ?? sample.revealedMaterial;

			return {
				...sample,
				serverCelestialBodyId: existingBody.id,
				scanProgress: shouldTreatAsScanned ? 100 : 0,
				scanned: shouldTreatAsScanned,
				revealedMaterial: resolvedMaterial,
				revealedKinematics: shouldTreatAsScanned ? resolvedKinematics : null,
				capturedKinematics: resolvedKinematics,
				solarSystemLocation: resolvedLocation,
			};
		});
	},
	getGateStepDefinitions() {
		return FIRST_TARGET_GATE_STEPS;
	},
	doesScanCompleteGateStep(stepKey, sample) {
		if (stepKey === 'identify_iron_asteroid') {
			return sample.revealedMaterial?.material === 'Iron';
		}

		return false;
	},
	doesLaunchCompleteGateStep(stepKey, response) {
		return (
			stepKey === 'neutralize_identified_asteroid' &&
			response.success === true &&
			response.resolution?.outcome === 'target-destroyed'
		);
	},
	resolveMissionStatusFromGateState(gateState: ShipExteriorMissionGateState): MissionStatus {
		const totalSteps = gateState.steps.length;
		if (totalSteps > 0 && gateState.steps.every((step) => step.status === 'completed')) {
			return 'completed';
		}

		if (gateState.steps.some((step) => step.status === 'completed' || step.status === 'pending-retry')) {
			return 'in-progress';
		}

		return 'started';
	},
};

export function createFirstTargetMissionInitialGateState(characterId: string): ShipExteriorMissionGateState {
	return createInitialMissionGateState({
		missionId: FIRST_TARGET_MISSION_ID,
		characterId,
		steps: FIRST_TARGET_GATE_STEPS,
	});
}

export { DEFAULT_CLUSTER_SPREAD_KM };