import { FIRST_TARGET_MISSION_ID } from '../model/mission.locale';
import {
	evaluateMissionGateOnLaunch,
	evaluateMissionGateOnScan,
	evaluateMissionGateOnManufacture,
	evaluateMissionGateOnRepair,
	createInitialMissionGateState,
	markMissionGateStepPendingRetry,
	clearMissionGatePendingRetry,
	hasMissionGatePendingRetry,
	SHIP_EXTERIOR_MISSION_IDS,
	resolveShipExteriorMission,
	parseMissionGateState,
	serializeMissionGateState,
	type ShipExteriorMissionGateState,
	type ShipExteriorMissionGateStepDefinition,
} from './ship-exterior-mission';

describe('resolveShipExteriorMission', () => {
	it('should resolve the first-target mission by id', () => {
		expect(resolveShipExteriorMission(FIRST_TARGET_MISSION_ID).missionId).toBe(FIRST_TARGET_MISSION_ID);
		expect(resolveShipExteriorMission(SHIP_EXTERIOR_MISSION_IDS.firstTarget).missionId).toBe(FIRST_TARGET_MISSION_ID);
	});

	it('should fall back to first-target when the mission id is empty or unknown', () => {
		expect(resolveShipExteriorMission('').missionId).toBe(FIRST_TARGET_MISSION_ID);
		expect(resolveShipExteriorMission('unknown-mission').missionId).toBe(FIRST_TARGET_MISSION_ID);
	});
});

describe('parseMissionGateState', () => {
	const THREE_STEPS: readonly ShipExteriorMissionGateStepDefinition[] = [
		{ key: 'step_a', objectiveText: 'Do A.', completionToastMessage: 'A done.' },
		{ key: 'step_b', objectiveText: 'Do B.', completionToastMessage: 'B done.', prerequisiteStepKeys: ['step_a'] },
		{ key: 'step_c', objectiveText: 'Do C.', completionToastMessage: 'C done.', prerequisiteStepKeys: ['step_b'] },
	];

	it('should return null for malformed JSON', () => {
		expect(
			parseMissionGateState({ rawStatusDetail: 'not-json', missionId: 'first-target', characterId: 'c-1', steps: THREE_STEPS }),
		).toBeNull();
	});

	it('should return null when missionId does not match', () => {
		const raw = serializeMissionGateState({
			missionId: 'other-mission',
			characterId: 'c-1',
			activeObjectiveText: '',
			updatedAt: '2026-01-01T00:00:00Z',
			steps: [{ key: 'step_a', status: 'active' }],
		});
		expect(parseMissionGateState({ rawStatusDetail: raw, missionId: 'first-target', characterId: 'c-1', steps: THREE_STEPS })).toBeNull();
	});

	it('should synthesize missing steps when stored state has fewer steps than definitions', () => {
		// Simulate old 2-step state where step_a and step_b are both completed
		const oldState = serializeMissionGateState({
			missionId: 'first-target',
			characterId: 'c-1',
			activeObjectiveText: 'Do B.',
			updatedAt: '2026-04-01T00:00:00Z',
			steps: [
				{ key: 'step_a', status: 'completed' },
				{ key: 'step_b', status: 'completed' },
			],
		});

		const result = parseMissionGateState({
			rawStatusDetail: oldState,
			missionId: 'first-target',
			characterId: 'c-1',
			steps: THREE_STEPS,
		});

		expect(result).not.toBeNull();
		expect(result!.steps.length).toBe(3);
		const stepC = result!.steps.find((s) => s.key === 'step_c');
		expect(stepC?.status).toBe('active');
		expect(result!.activeObjectiveText).toBe('Do C.');
	});

	it('should keep synthesized step locked when its prerequisites are not yet completed', () => {
		const oldState = serializeMissionGateState({
			missionId: 'first-target',
			characterId: 'c-1',
			activeObjectiveText: 'Do A.',
			updatedAt: '2026-04-01T00:00:00Z',
			steps: [
				{ key: 'step_a', status: 'active' },
				{ key: 'step_b', status: 'locked' },
			],
		});

		const result = parseMissionGateState({
			rawStatusDetail: oldState,
			missionId: 'first-target',
			characterId: 'c-1',
			steps: THREE_STEPS,
		});

		expect(result).not.toBeNull();
		expect(result!.steps.length).toBe(3);
		const stepC = result!.steps.find((s) => s.key === 'step_c');
		expect(stepC?.status).toBe('locked');
		expect(result!.activeObjectiveText).toBe('Do A.');
	});
});

describe('evaluateMissionGateOnLaunch', () => {
	it('should complete neutralize step and unlock manufacture step on target-destroyed launch', () => {
		const mission = resolveShipExteriorMission(FIRST_TARGET_MISSION_ID);
		const gateState = {
			missionId: FIRST_TARGET_MISSION_ID,
			characterId: 'c-1',
			activeObjectiveText: 'Objective unlocked: Neutralize the identified asteroid using a launchable payload.',
			updatedAt: '2026-04-28T00:00:00.000Z',
			steps: [
				{ key: 'identify_iron_asteroid', status: 'completed' as const },
				{ key: 'neutralize_identified_asteroid', status: 'active' as const },
				{ key: 'manufacture_hull_patch_kit', status: 'locked' as const },
				{ key: 'repair_scavenger_pod', status: 'locked' as const },
			],
		};

		const evaluation = evaluateMissionGateOnLaunch({
			mission,
			gateState,
			response: {
				success: true,
				message: 'Target neutralized',
				playerName: 'Pioneer',
				characterId: 'c-1',
				shipId: 'ship-1',
				targetCelestialBodyId: 'sample-a1',
				hotkey: 1 as const,
				itemId: 'item-1',
				itemType: 'expendable-dart-drone',
				resolution: {
					outcome: 'target-destroyed',
					targetDestroyed: true,
					yieldedMaterials: [],
					yieldedItems: [],
					launchSeed: 42,
				},
			},
		});

		expect(evaluation.changed).toBe(true);
		expect(evaluation.completedStepKey).toBe('neutralize_identified_asteroid');
		expect(evaluation.gateState.activeObjectiveText).toBe(
			'Objective unlocked: Manufacture a Hull Patch Kit at the Fabrication Lab (requires 1 iron).',
		);
		expect(evaluation.gateState.steps.find((step) => step.key === 'neutralize_identified_asteroid')?.status).toBe(
			'completed',
		);
		expect(evaluation.gateState.steps.find((step) => step.key === 'manufacture_hull_patch_kit')?.status).toBe('active');
		expect(evaluation.gateState.steps.find((step) => step.key === 'repair_scavenger_pod')?.status).toBe('locked');
	});

	it('should not change gate state when launch outcome is not target-destroyed', () => {
		const mission = resolveShipExteriorMission(FIRST_TARGET_MISSION_ID);
		const gateState = {
			missionId: FIRST_TARGET_MISSION_ID,
			characterId: 'c-1',
			activeObjectiveText: 'Objective unlocked: Neutralize the identified asteroid using a launchable payload.',
			updatedAt: '2026-04-28T00:00:00.000Z',
			steps: [
				{ key: 'identify_iron_asteroid', status: 'completed' as const },
				{ key: 'neutralize_identified_asteroid', status: 'active' as const },
				{ key: 'manufacture_hull_patch_kit', status: 'locked' as const },
				{ key: 'repair_scavenger_pod', status: 'locked' as const },
			],
		};

		const evaluation = evaluateMissionGateOnLaunch({
			mission,
			gateState,
			response: {
				success: true,
				message: 'No effect',
				playerName: 'Pioneer',
				characterId: 'c-1',
				shipId: 'ship-1',
				targetCelestialBodyId: 'sample-a1',
				hotkey: 1 as const,
				itemId: 'item-1',
				itemType: 'expendable-dart-drone',
				resolution: {
					outcome: 'no-effect',
					targetDestroyed: false,
					yieldedMaterials: [],
					yieldedItems: [],
					launchSeed: 24,
				},
			},
		});

		expect(evaluation.changed).toBe(false);
		expect(evaluation.gateState.activeObjectiveText).toBe(
			'Objective unlocked: Neutralize the identified asteroid using a launchable payload.',
		);
	});
});

// ── Shared gate state fixture ──────────────────────────────────────────────────

function makeInitialState(): ShipExteriorMissionGateState {
	return {
		missionId: FIRST_TARGET_MISSION_ID,
		characterId: 'c-1',
		activeObjectiveText: 'Objective: Identify an Iron asteroid via full scan.',
		updatedAt: '2026-01-01T00:00:00.000Z',
		steps: [
			{ key: 'identify_iron_asteroid', status: 'active' },
			{ key: 'neutralize_identified_asteroid', status: 'locked' },
			{ key: 'manufacture_hull_patch_kit', status: 'locked' },
			{ key: 'repair_scavenger_pod', status: 'locked' },
		],
	};
}

function makeIronScanSample() {
	return {
		id: 'scan-1',
		serverCelestialBodyId: 'ast-1',
		position: [0, 0, 0] as [number, number, number],
		basePosition: [0, 0, 0] as [number, number, number],
		scanProgress: 1.0,
		scanned: true,
		revealedMaterial: { rarity: 'Common' as const, material: 'Iron', textureColor: '#8f99a7' },
		revealedKinematics: null,
		capturedKinematics: { position: [0, 0, 0], velocity: [0, 0, 0] } as never,
		solarSystemLocation: null as never,
		clusterCenterKm: [0, 0, 0] as never,
		motionPhase: 0,
		motionRate: 0,
		motionRadius: 0,
		bobAmplitude: 0,
	};
}

// ── createInitialMissionGateState ─────────────────────────────────────────────

describe('createInitialMissionGateState', () => {
	const steps: readonly ShipExteriorMissionGateStepDefinition[] = [
		{ key: 'step_a', objectiveText: 'Do A.', completionToastMessage: 'A done.' },
		{ key: 'step_b', objectiveText: 'Do B.', completionToastMessage: 'B done.', prerequisiteStepKeys: ['step_a'] },
	];

	it('activates the first step (no prerequisites) and locks the second', () => {
		const state = createInitialMissionGateState({ missionId: 'test', characterId: 'c-1', steps });
		expect(state.steps[0].status).toBe('active');
		expect(state.steps[1].status).toBe('locked');
	});

	it('sets activeObjectiveText to the first active step', () => {
		const state = createInitialMissionGateState({ missionId: 'test', characterId: 'c-1', steps });
		expect(state.activeObjectiveText).toBe('Do A.');
	});

	it('uses provided nowIso for updatedAt', () => {
		const ts = '2026-04-30T00:00:00.000Z';
		const state = createInitialMissionGateState({ missionId: 'test', characterId: 'c-1', steps, nowIso: ts });
		expect(state.updatedAt).toBe(ts);
	});
});

// ── evaluateMissionGateOnScan ──────────────────────────────────────────────────

describe('evaluateMissionGateOnScan', () => {
	it('completes identify_iron_asteroid when iron sample is scanned', () => {
		const mission = resolveShipExteriorMission(FIRST_TARGET_MISSION_ID);
		const evaluation = evaluateMissionGateOnScan({
			mission,
			gateState: makeInitialState(),
			sample: makeIronScanSample(),
			completedAt: '2026-04-01T00:00:00.000Z',
		});

		expect(evaluation.changed).toBe(true);
		expect(evaluation.completedStepKey).toBe('identify_iron_asteroid');
		expect(evaluation.gateState.steps.find((s) => s.key === 'neutralize_identified_asteroid')?.status).toBe('active');
	});

	it('does not change gate state for a non-iron scan sample', () => {
		const mission = resolveShipExteriorMission(FIRST_TARGET_MISSION_ID);
		const copperSample = { ...makeIronScanSample(), revealedMaterial: { rarity: 'Common' as const, material: 'Copper', textureColor: '#b86c45' } };
		const evaluation = evaluateMissionGateOnScan({ mission, gateState: makeInitialState(), sample: copperSample });

		expect(evaluation.changed).toBe(false);
		expect(evaluation.completedStepKey).toBeNull();
	});

	it('sets completionToastMessage on success', () => {
		const mission = resolveShipExteriorMission(FIRST_TARGET_MISSION_ID);
		const evaluation = evaluateMissionGateOnScan({ mission, gateState: makeInitialState(), sample: makeIronScanSample() });
		expect(evaluation.completionToastMessage).toBeTruthy();
	});

	it('does not change gate state when no step is active', () => {
		const mission = resolveShipExteriorMission(FIRST_TARGET_MISSION_ID);
		const allLocked: ShipExteriorMissionGateState = {
			...makeInitialState(),
			steps: makeInitialState().steps.map((s) => ({ ...s, status: 'locked' as const })),
		};
		const evaluation = evaluateMissionGateOnScan({ mission, gateState: allLocked, sample: makeIronScanSample() });
		expect(evaluation.changed).toBe(false);
	});
});

// ── evaluateMissionGateOnManufacture ──────────────────────────────────────────

describe('evaluateMissionGateOnManufacture', () => {
	it('completes manufacture_hull_patch_kit when hull-patch-kit is manufactured', () => {
		const mission = resolveShipExteriorMission(FIRST_TARGET_MISSION_ID);
		const gateState: ShipExteriorMissionGateState = {
			...makeInitialState(),
			steps: [
				{ key: 'identify_iron_asteroid', status: 'completed' },
				{ key: 'neutralize_identified_asteroid', status: 'completed' },
				{ key: 'manufacture_hull_patch_kit', status: 'active' },
				{ key: 'repair_scavenger_pod', status: 'locked' },
			],
		};

		const evaluation = evaluateMissionGateOnManufacture({
			mission,
			gateState,
			manufacturedItemType: 'hull-patch-kit',
			completedAt: '2026-04-01T00:00:00.000Z',
		});

		expect(evaluation.changed).toBe(true);
		expect(evaluation.completedStepKey).toBe('manufacture_hull_patch_kit');
		expect(evaluation.gateState.steps.find((s) => s.key === 'repair_scavenger_pod')?.status).toBe('active');
	});

	it('does not change gate state for the wrong item type', () => {
		const mission = resolveShipExteriorMission(FIRST_TARGET_MISSION_ID);
		const gateState: ShipExteriorMissionGateState = {
			...makeInitialState(),
			steps: [
				{ key: 'identify_iron_asteroid', status: 'completed' },
				{ key: 'neutralize_identified_asteroid', status: 'completed' },
				{ key: 'manufacture_hull_patch_kit', status: 'active' },
				{ key: 'repair_scavenger_pod', status: 'locked' },
			],
		};

		const evaluation = evaluateMissionGateOnManufacture({ mission, gateState, manufacturedItemType: 'conduit-seals' });
		expect(evaluation.changed).toBe(false);
	});
});

// ── evaluateMissionGateOnRepair ────────────────────────────────────────────────

describe('evaluateMissionGateOnRepair', () => {
	it('completes repair_scavenger_pod when repairKind is "ship"', () => {
		const mission = resolveShipExteriorMission(FIRST_TARGET_MISSION_ID);
		const gateState: ShipExteriorMissionGateState = {
			...makeInitialState(),
			steps: [
				{ key: 'identify_iron_asteroid', status: 'completed' },
				{ key: 'neutralize_identified_asteroid', status: 'completed' },
				{ key: 'manufacture_hull_patch_kit', status: 'completed' },
				{ key: 'repair_scavenger_pod', status: 'active' },
			],
		};

		const evaluation = evaluateMissionGateOnRepair({
			mission,
			gateState,
			repairKind: 'ship',
			completedAt: '2026-04-30T00:00:00.000Z',
		});

		expect(evaluation.changed).toBe(true);
		expect(evaluation.completedStepKey).toBe('repair_scavenger_pod');
		expect(evaluation.gateState.activeObjectiveText).toBe('Mission objectives complete. Await further directives.');
	});

	it('does not change gate state for wrong repair kind', () => {
		const mission = resolveShipExteriorMission(FIRST_TARGET_MISSION_ID);
		const gateState: ShipExteriorMissionGateState = {
			...makeInitialState(),
			steps: [
				{ key: 'identify_iron_asteroid', status: 'completed' },
				{ key: 'neutralize_identified_asteroid', status: 'completed' },
				{ key: 'manufacture_hull_patch_kit', status: 'completed' },
				{ key: 'repair_scavenger_pod', status: 'active' },
			],
		};

		const evaluation = evaluateMissionGateOnRepair({ mission, gateState, repairKind: 'item' });
		expect(evaluation.changed).toBe(false);
	});
});

// ── markMissionGateStepPendingRetry / clearMissionGatePendingRetry ────────────

describe('markMissionGateStepPendingRetry', () => {
	it('marks a completed step as pending-retry', () => {
		const state: ShipExteriorMissionGateState = {
			...makeInitialState(),
			steps: [
				{ key: 'identify_iron_asteroid', status: 'completed' },
				{ key: 'neutralize_identified_asteroid', status: 'active' },
				{ key: 'manufacture_hull_patch_kit', status: 'locked' },
				{ key: 'repair_scavenger_pod', status: 'locked' },
			],
		};

		const next = markMissionGateStepPendingRetry(state, 'identify_iron_asteroid', '2026-04-30T00:00:00.000Z');
		expect(next.steps.find((s) => s.key === 'identify_iron_asteroid')?.status).toBe('pending-retry');
		expect(next.updatedAt).toBe('2026-04-30T00:00:00.000Z');
	});

	it('returns the same object when step is not completed', () => {
		const state = makeInitialState();
		const next = markMissionGateStepPendingRetry(state, 'identify_iron_asteroid');
		expect(next).toBe(state);
	});

	it('returns the same object when stepKey does not exist', () => {
		const state = makeInitialState();
		const next = markMissionGateStepPendingRetry(state, 'nonexistent_key');
		expect(next).toBe(state);
	});
});

describe('clearMissionGatePendingRetry', () => {
	it('restores pending-retry steps to completed', () => {
		const state: ShipExteriorMissionGateState = {
			...makeInitialState(),
			steps: [
				{ key: 'identify_iron_asteroid', status: 'pending-retry' },
				{ key: 'neutralize_identified_asteroid', status: 'active' },
				{ key: 'manufacture_hull_patch_kit', status: 'locked' },
				{ key: 'repair_scavenger_pod', status: 'locked' },
			],
		};

		const next = clearMissionGatePendingRetry(state, '2026-04-30T00:00:00.000Z');
		expect(next.steps.find((s) => s.key === 'identify_iron_asteroid')?.status).toBe('completed');
		expect(next.updatedAt).toBe('2026-04-30T00:00:00.000Z');
	});

	it('returns the same object when no step is pending-retry', () => {
		const state = makeInitialState();
		const next = clearMissionGatePendingRetry(state);
		expect(next).toBe(state);
	});
});

// ── hasMissionGatePendingRetry ────────────────────────────────────────────────

describe('hasMissionGatePendingRetry', () => {
	it('returns true when a step is pending-retry', () => {
		const state: ShipExteriorMissionGateState = {
			...makeInitialState(),
			steps: [{ key: 'identify_iron_asteroid', status: 'pending-retry' }],
		};
		expect(hasMissionGatePendingRetry(state)).toBeTrue();
	});

	it('returns false when no step is pending-retry', () => {
		expect(hasMissionGatePendingRetry(makeInitialState())).toBeFalse();
	});
});

// ── parseMissionGateState — additional edge cases ─────────────────────────────

describe('parseMissionGateState — additional edge cases', () => {
	const steps: readonly ShipExteriorMissionGateStepDefinition[] = [
		{ key: 'step_a', objectiveText: 'Do A.', completionToastMessage: 'A done.' },
	];

	it('returns null when characterId does not match', () => {
		const raw = serializeMissionGateState({
			missionId: 'first-target',
			characterId: 'other-char',
			activeObjectiveText: '',
			updatedAt: '',
			steps: [{ key: 'step_a', status: 'active' }],
		});
		expect(parseMissionGateState({ rawStatusDetail: raw, missionId: 'first-target', characterId: 'c-1', steps })).toBeNull();
	});

	it('returns null when steps is not an array', () => {
		const raw = JSON.stringify({
			missionId: 'first-target',
			characterId: 'c-1',
			activeObjectiveText: '',
			updatedAt: '',
			steps: null,
		});
		expect(parseMissionGateState({ rawStatusDetail: raw, missionId: 'first-target', characterId: 'c-1', steps })).toBeNull();
	});

	it('returns null when a step key is not in allowedKeys', () => {
		const raw = JSON.stringify({
			missionId: 'first-target',
			characterId: 'c-1',
			activeObjectiveText: '',
			updatedAt: '',
			steps: [{ key: 'unknown_step', status: 'active' }],
		});
		expect(parseMissionGateState({ rawStatusDetail: raw, missionId: 'first-target', characterId: 'c-1', steps })).toBeNull();
	});

	it('returns null for a non-object parsed value', () => {
		expect(parseMissionGateState({ rawStatusDetail: '"just-a-string"', missionId: 'first-target', characterId: 'c-1', steps })).toBeNull();
	});

	it('synthesizes missing steps when stored state has fewer steps than definition', () => {
		// Simulate a stored gate where step_a completed and step_b is missing
		const steps2: readonly ShipExteriorMissionGateStepDefinition[] = [
			{ key: 'step_a', objectiveText: 'Do A.', completionToastMessage: 'A done.' },
			{ key: 'step_b', objectiveText: 'Do B.', completionToastMessage: 'B done.', prerequisiteStepKeys: ['step_a'] },
			{ key: 'step_c', objectiveText: 'Do C.', completionToastMessage: 'C done.', prerequisiteStepKeys: ['step_a'] },
		];

		const stored: ShipExteriorMissionGateState = {
			missionId: 'first-target',
			characterId: 'c-1',
			activeObjectiveText: '',
			updatedAt: '',
			steps: [{ key: 'step_a', status: 'completed' }],
		};

		const result = parseMissionGateState({
			rawStatusDetail: serializeMissionGateState(stored),
			missionId: 'first-target',
			characterId: 'c-1',
			steps: steps2,
		});

		expect(result).not.toBeNull();
		const stepB = result?.steps.find((s) => s.key === 'step_b');
		const stepC = result?.steps.find((s) => s.key === 'step_c');
		// step_a is completed, step_b and step_c should be synthesized as active (prereq met)
		expect(stepB?.status).toBe('active');
		expect(stepC?.status).toBe('active');
	});

	it('synthesizes missing step as locked when prerequisites are not completed', () => {
		const steps3: readonly ShipExteriorMissionGateStepDefinition[] = [
			{ key: 'step_a', objectiveText: 'Do A.', completionToastMessage: 'A done.' },
			{ key: 'step_b', objectiveText: 'Do B.', completionToastMessage: 'B done.', prerequisiteStepKeys: ['step_a'] },
		];

		const stored: ShipExteriorMissionGateState = {
			missionId: 'first-target',
			characterId: 'c-1',
			activeObjectiveText: '',
			updatedAt: '',
			steps: [{ key: 'step_a', status: 'active' }],
		};

		const result = parseMissionGateState({
			rawStatusDetail: serializeMissionGateState(stored),
			missionId: 'first-target',
			characterId: 'c-1',
			steps: steps3,
		});

		expect(result).not.toBeNull();
		const stepB = result?.steps.find((s) => s.key === 'step_b');
		expect(stepB?.status).toBe('locked');
	});

	it('returns null when a step object is null', () => {
		const raw = JSON.stringify({
			missionId: 'first-target',
			characterId: 'c-1',
			activeObjectiveText: '',
			updatedAt: '',
			steps: [null],
		});
		expect(parseMissionGateState({ rawStatusDetail: raw, missionId: 'first-target', characterId: 'c-1', steps })).toBeNull();
	});
});