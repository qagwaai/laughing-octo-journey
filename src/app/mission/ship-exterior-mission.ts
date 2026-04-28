import { FIRST_TARGET_MISSION_ID } from '../model/mission.locale';
import type { MissionStatus } from '../model/mission';
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

export type ShipExteriorMissionGateStepStatus = 'locked' | 'active' | 'completed' | 'pending-retry';

export interface ShipExteriorMissionStepCompletionEvidence {
	sourceScanId: string;
	celestialBodyId: string | null;
	material: string | null;
	completedAt: string;
	characterId: string;
	missionId: string;
}

export interface ShipExteriorMissionGateStepDefinition {
	key: string;
	objectiveText: string;
	completionToastMessage: string;
	prerequisiteStepKeys?: readonly string[];
}

export interface ShipExteriorMissionGateStepState {
	key: string;
	status: ShipExteriorMissionGateStepStatus;
	completedAt?: string;
	evidence?: ShipExteriorMissionStepCompletionEvidence;
}

export interface ShipExteriorMissionGateState {
	missionId: string;
	characterId: string;
	activeObjectiveText: string;
	updatedAt: string;
	steps: ShipExteriorMissionGateStepState[];
}

export interface ShipExteriorMissionGateScanEvaluation {
	gateState: ShipExteriorMissionGateState;
	changed: boolean;
	completedStepKey: string | null;
	completionToastMessage: string | null;
	unlockedStepKeys: string[];
}

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
	getGateStepDefinitions(): readonly ShipExteriorMissionGateStepDefinition[];
	doesScanCompleteGateStep(stepKey: string, sample: AsteroidScanSample): boolean;
	resolveMissionStatusFromGateState(gateState: ShipExteriorMissionGateState): MissionStatus;
}

const SHIP_EXTERIOR_MISSION_REGISTRY = new Map<string, ShipExteriorMissionDefinition>([
	[FIRST_TARGET_SHIP_EXTERIOR_MISSION.missionId, FIRST_TARGET_SHIP_EXTERIOR_MISSION],
]);

export function resolveShipExteriorMission(missionId?: string | null): ShipExteriorMissionDefinition {
	const normalizedMissionId = missionId?.trim() || FIRST_TARGET_MISSION_ID;
	return SHIP_EXTERIOR_MISSION_REGISTRY.get(normalizedMissionId) ?? FIRST_TARGET_SHIP_EXTERIOR_MISSION;
}

export function createInitialMissionGateState(params: {
	missionId: string;
	characterId: string;
	steps: readonly ShipExteriorMissionGateStepDefinition[];
	nowIso?: string;
}): ShipExteriorMissionGateState {
	const nowIso = params.nowIso ?? new Date().toISOString();
	const stepStates = params.steps.map((step) => ({
		key: step.key,
		status: shouldUnlockStep(step, []) ? 'active' as const : 'locked' as const,
	}));

	return {
		missionId: params.missionId,
		characterId: params.characterId,
		activeObjectiveText: resolveActiveObjectiveText(stepStates, params.steps),
		updatedAt: nowIso,
		steps: stepStates,
	};
}

export function evaluateMissionGateOnScan(params: {
	mission: ShipExteriorMissionDefinition;
	gateState: ShipExteriorMissionGateState;
	sample: AsteroidScanSample;
	completedAt?: string;
}): ShipExteriorMissionGateScanEvaluation {
	const steps = params.mission.getGateStepDefinitions();
	const completedAt = params.completedAt ?? new Date().toISOString();
	const stepByKey = new Map(steps.map((step) => [step.key, step] as const));
	const nextStates = params.gateState.steps.map((step) => ({ ...step }));
	const stepStateByKey = new Map(nextStates.map((step) => [step.key, step] as const));

	let completedStepKey: string | null = null;
	let completionToastMessage: string | null = null;
	let changed = false;

	for (const step of steps) {
		const stepState = stepStateByKey.get(step.key);
		if (!stepState || stepState.status !== 'active') {
			continue;
		}

		if (!params.mission.doesScanCompleteGateStep(step.key, params.sample)) {
			continue;
		}

		stepState.status = 'completed';
		stepState.completedAt = completedAt;
		stepState.evidence = {
			sourceScanId: params.sample.id,
			celestialBodyId: params.sample.serverCelestialBodyId,
			material: params.sample.revealedMaterial?.material ?? null,
			completedAt,
			characterId: params.gateState.characterId,
			missionId: params.gateState.missionId,
		};
		completedStepKey = step.key;
		completionToastMessage = step.completionToastMessage;
		changed = true;
		break;
	}

	const unlockedStepKeys: string[] = [];
	if (changed) {
		const completedStepKeys = new Set(
			nextStates
				.filter((step) => step.status === 'completed' || step.status === 'pending-retry')
				.map((step) => step.key),
		);

		for (const step of steps) {
			const stepState = stepStateByKey.get(step.key);
			if (!stepState || stepState.status !== 'locked') {
				continue;
			}

			if (!shouldUnlockStep(step, completedStepKeys)) {
				continue;
			}

			stepState.status = 'active';
			unlockedStepKeys.push(step.key);
		}
	}

	const nextGateState: ShipExteriorMissionGateState = {
		...params.gateState,
		steps: nextStates,
		activeObjectiveText: resolveActiveObjectiveText(nextStates, steps),
		updatedAt: changed ? completedAt : params.gateState.updatedAt,
	};

	if (changed && completedStepKey) {
		const completedStep = stepByKey.get(completedStepKey);
		const unlockedSummary = unlockedStepKeys
			.map((key) => stepByKey.get(key)?.objectiveText)
			.filter((value): value is string => typeof value === 'string' && value.length > 0)
			.join(' ');
		completionToastMessage = unlockedSummary
			? `${completedStep?.completionToastMessage ?? 'Mission objective updated.'} ${unlockedSummary}`
			: (completedStep?.completionToastMessage ?? 'Mission objective updated.');
	}

	return {
		gateState: nextGateState,
		changed,
		completedStepKey,
		completionToastMessage,
		unlockedStepKeys,
	};
}

export function markMissionGateStepPendingRetry(
	gateState: ShipExteriorMissionGateState,
	stepKey: string,
	nowIso: string = new Date().toISOString(),
): ShipExteriorMissionGateState {
	let changed = false;
	const nextSteps = gateState.steps.map((step) => {
		if (step.key !== stepKey || step.status !== 'completed') {
			return step;
		}

		changed = true;
		return {
			...step,
			status: 'pending-retry' as const,
		};
	});

	if (!changed) {
		return gateState;
	}

	return {
		...gateState,
		steps: nextSteps,
		updatedAt: nowIso,
	};
}

export function clearMissionGatePendingRetry(
	gateState: ShipExteriorMissionGateState,
	nowIso: string = new Date().toISOString(),
): ShipExteriorMissionGateState {
	let changed = false;
	const nextSteps = gateState.steps.map((step) => {
		if (step.status !== 'pending-retry') {
			return step;
		}

		changed = true;
		return {
			...step,
			status: 'completed' as const,
		};
	});

	if (!changed) {
		return gateState;
	}

	return {
		...gateState,
		steps: nextSteps,
		updatedAt: nowIso,
	};
}

export function hasMissionGatePendingRetry(gateState: ShipExteriorMissionGateState): boolean {
	return gateState.steps.some((step) => step.status === 'pending-retry');
}

export function serializeMissionGateState(gateState: ShipExteriorMissionGateState): string {
	return JSON.stringify(gateState);
}

export function parseMissionGateState(params: {
	rawStatusDetail: string;
	missionId: string;
	characterId: string;
	steps: readonly ShipExteriorMissionGateStepDefinition[];
}): ShipExteriorMissionGateState | null {
	try {
		const parsed = JSON.parse(params.rawStatusDetail) as ShipExteriorMissionGateState;
		if (!parsed || typeof parsed !== 'object') {
			return null;
		}

		if (parsed.missionId !== params.missionId || parsed.characterId !== params.characterId) {
			return null;
		}

		if (!Array.isArray(parsed.steps)) {
			return null;
		}

		const allowedKeys = new Set(params.steps.map((step) => step.key));
		for (const step of parsed.steps) {
			if (!step || typeof step !== 'object' || typeof step.key !== 'string' || !allowedKeys.has(step.key)) {
				return null;
			}
		}

		return {
			...parsed,
			activeObjectiveText: resolveActiveObjectiveText(parsed.steps, params.steps),
		};
	} catch {
		return null;
	}
}

function shouldUnlockStep(
	step: ShipExteriorMissionGateStepDefinition,
	completedStepKeys: Set<string> | string[],
): boolean {
	const prerequisites = step.prerequisiteStepKeys ?? [];
	if (prerequisites.length === 0) {
		return true;
	}

	const completed = completedStepKeys instanceof Set ? completedStepKeys : new Set(completedStepKeys);
	return prerequisites.every((key) => completed.has(key));
}

function resolveActiveObjectiveText(
	stepStates: readonly ShipExteriorMissionGateStepState[],
	stepDefinitions: readonly ShipExteriorMissionGateStepDefinition[],
): string {
	const activeStep = stepDefinitions.find((step) => {
		const state = stepStates.find((candidate) => candidate.key === step.key);
		return state?.status === 'active';
	});

	if (activeStep) {
		return activeStep.objectiveText;
	}

	const pendingStep = stepDefinitions.find((step) => {
		const state = stepStates.find((candidate) => candidate.key === step.key);
		return state?.status === 'pending-retry';
	});
	if (pendingStep) {
		return `${pendingStep.objectiveText} (sync pending)`;
	}

	return 'Mission objectives complete. Await further directives.';
}
