import { FIRST_TARGET_MISSION_ID } from '../model/mission.locale';
import {
	evaluateMissionGateOnLaunch,
	SHIP_EXTERIOR_MISSION_IDS,
	resolveShipExteriorMission,
	parseMissionGateState,
	serializeMissionGateState,
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
	it('should complete neutralize step and unlock repair step on target-destroyed launch', () => {
		const mission = resolveShipExteriorMission(FIRST_TARGET_MISSION_ID);
		const gateState = {
			missionId: FIRST_TARGET_MISSION_ID,
			characterId: 'c-1',
			activeObjectiveText: 'Objective unlocked: Neutralize the identified asteroid using a launchable payload.',
			updatedAt: '2026-04-28T00:00:00.000Z',
			steps: [
				{ key: 'identify_iron_asteroid', status: 'completed' as const },
				{ key: 'neutralize_identified_asteroid', status: 'active' as const },
				{ key: 'repair_scavenger_pod', status: 'locked' as const },
			],
		};

		const evaluation = evaluateMissionGateOnLaunch({
			mission,
			gateState,
			response: {
				success: true,
				message: 'Target neutralized',
				targetCelestialBodyId: 'sample-a1',
				resolution: {
					outcome: 'target-destroyed',
					launchSeed: 42,
				},
			},
		});

		expect(evaluation.changed).toBe(true);
		expect(evaluation.completedStepKey).toBe('neutralize_identified_asteroid');
		expect(evaluation.gateState.activeObjectiveText).toBe(
			'Objective unlocked: Repair the Scavenger Pod at the Repair & Retrofit station.',
		);
		expect(evaluation.gateState.steps.find((step) => step.key === 'neutralize_identified_asteroid')?.status).toBe(
			'completed',
		);
		expect(evaluation.gateState.steps.find((step) => step.key === 'repair_scavenger_pod')?.status).toBe('active');
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
				{ key: 'repair_scavenger_pod', status: 'locked' as const },
			],
		};

		const evaluation = evaluateMissionGateOnLaunch({
			mission,
			gateState,
			response: {
				success: true,
				message: 'No effect',
				targetCelestialBodyId: 'sample-a1',
				resolution: {
					outcome: 'no-effect',
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