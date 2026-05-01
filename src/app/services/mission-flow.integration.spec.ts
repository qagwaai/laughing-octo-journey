import {
	MISSION_UPSERT_REQUEST_EVENT,
	MISSION_UPSERT_RESPONSE_EVENT,
	type MissionUpsertRequest,
} from '../model/mission-upsert.model';
import { MissionProgressSyncService } from './mission-progress-sync.service';
import { MissionService, type UpsertMissionStatusResult } from './mission.service';

type Listener = (payload: any) => void;
type StepStatus = 'locked' | 'active' | 'completed' | 'pending-retry';
type MissionEvent = 'scan' | 'launch' | 'manufacture' | 'repair';

interface GateStepState {
	key: string;
	status: StepStatus;
	completedAt?: string;
}

interface GateState {
	missionId: string;
	characterId: string;
	activeObjectiveText: string;
	updatedAt: string;
	steps: GateStepState[];
}

const STEP_KEYS = [
	'identify_iron_asteroid',
	'neutralize_identified_asteroid',
	'manufacture_hull_patch_kit',
	'repair_scavenger_pod',
] as const;

function createGateState(
	missionId: string,
	characterId: string,
	statuses: readonly StepStatus[],
	updatedAt: string,
): GateState {
	const steps = STEP_KEYS.map((key, index) => {
		const status = statuses[index] ?? 'locked';
		return {
			key,
			status,
			...(status === 'completed' ? { completedAt: updatedAt } : {}),
		};
	});

	const activeStep = steps.find((step) => step.status === 'active');
	return {
		missionId,
		characterId,
		activeObjectiveText: activeStep
			? `Objective: ${activeStep.key}`
			: 'Mission objectives complete. Await further directives.',
		updatedAt,
		steps,
	};
}

function applyMissionEvent(gateState: GateState, event: MissionEvent, updatedAt: string): GateState {
	const eventTargetByStepKey: Record<string, MissionEvent> = {
		identify_iron_asteroid: 'scan',
		neutralize_identified_asteroid: 'launch',
		manufacture_hull_patch_kit: 'manufacture',
		repair_scavenger_pod: 'repair',
	};

	const activeIndex = gateState.steps.findIndex((step) => step.status === 'active');
	if (activeIndex < 0) {
		return gateState;
	}

	const activeStep = gateState.steps[activeIndex];
	if (eventTargetByStepKey[activeStep.key] !== event) {
		return gateState;
	}

	const nextSteps = gateState.steps.map((step, index) => {
		if (index === activeIndex) {
			return {
				...step,
				status: 'completed' as const,
				completedAt: updatedAt,
			};
		}

		if (index === activeIndex + 1 && step.status === 'locked') {
			return {
				...step,
				status: 'active' as const,
			};
		}

		return step;
	});

	const nextActiveStep = nextSteps.find((step) => step.status === 'active');
	return {
		...gateState,
		steps: nextSteps,
		activeObjectiveText: nextActiveStep
			? `Objective: ${nextActiveStep.key}`
			: 'Mission objectives complete. Await further directives.',
		updatedAt,
	};
}

class MockSocketService {
	serverUrl = 'http://localhost:3000';
	connected = true;
	connectCalls = 0;
	emittedEvents: Array<{ event: string; data: any }> = [];
	private listeners = new Map<string, Set<Listener>>();

	connect(): void {
		this.connectCalls += 1;
	}

	getIsConnected(): boolean {
		return this.connected;
	}

	emit(eventName: string, data?: any): void {
		this.emittedEvents.push({ event: eventName, data });
	}

	on(eventName: string, callback: Listener): () => void {
		const set = this.listeners.get(eventName) ?? new Set<Listener>();
		set.add(callback);
		this.listeners.set(eventName, set);

		return () => {
			set.delete(callback);
			if (set.size === 0) {
				this.listeners.delete(eventName);
			}
		};
	}

	once(eventName: string, callback: Listener): void {
		const unsubscribe = this.on(eventName, (payload) => {
			unsubscribe();
			callback(payload);
		});
	}

	trigger(eventName: string, payload: any): void {
		const set = this.listeners.get(eventName);
		if (!set) {
			return;
		}

		for (const listener of Array.from(set)) {
			listener(payload);
		}
	}
}

describe('Mission integration proof of concept', () => {
	const playerName = 'Pioneer';
	const characterId = 'char-1';
	const sessionKey = 'session-1';
	const missionId = 'first-target';

	let socketService: MockSocketService;
	let missionService: MissionService;
	let syncService: MissionProgressSyncService;

	beforeEach(() => {
		socketService = new MockSocketService();
		missionService = new MissionService(socketService as never);
		syncService = new MissionProgressSyncService(missionService);
	});

	async function syncGateStateAndAcknowledge(gateState: GateState): Promise<MissionUpsertRequest> {
		const pending = syncService.syncGateState({
			playerName,
			characterId,
			sessionKey,
			gateState: gateState as never,
		});

		await Promise.resolve();
		const emittedRequest = socketService.emittedEvents[socketService.emittedEvents.length - 1];
		expect(emittedRequest?.event).toBe(MISSION_UPSERT_REQUEST_EVENT);

		const requestPayload = emittedRequest.data as MissionUpsertRequest;
		socketService.trigger(MISSION_UPSERT_RESPONSE_EVENT, {
			success: true,
			message: 'ok',
			playerName,
			characterId,
			mission: {
				missionId: requestPayload.missionId,
				status: requestPayload.status,
				statusDetail: requestPayload.statusDetail,
			},
		});

		const result: UpsertMissionStatusResult | 'skipped' = await pending;
		expect(result).toBe('updated');
		return requestPayload;
	}

	it('should sync mission gate progression from started to completed across service boundaries', async () => {
		const timeline: GateState[] = [
			createGateState(missionId, characterId, ['active', 'locked', 'locked', 'locked'], '2026-05-01T00:00:00.000Z'),
			createGateState(missionId, characterId, ['completed', 'active', 'locked', 'locked'], '2026-05-01T00:00:01.000Z'),
			createGateState(missionId, characterId, ['completed', 'completed', 'active', 'locked'], '2026-05-01T00:00:02.000Z'),
			createGateState(missionId, characterId, ['completed', 'completed', 'completed', 'active'], '2026-05-01T00:00:03.000Z'),
			createGateState(missionId, characterId, ['completed', 'completed', 'completed', 'completed'], '2026-05-01T00:00:04.000Z'),
		];
		const expectedStatuses = ['started', 'in-progress', 'in-progress', 'in-progress', 'completed'] as const;

		for (let index = 0; index < timeline.length; index += 1) {
			const request = await syncGateStateAndAcknowledge(timeline[index]);
			expect(request.status).toBe(expectedStatuses[index]);
		}

		const finalRequest = socketService.emittedEvents[socketService.emittedEvents.length - 1].data as MissionUpsertRequest;
		const finalStatusDetail = JSON.parse(finalRequest.statusDetail ?? '{}') as GateState;
		expect(finalStatusDetail.steps.every((step) => step.status === 'completed')).toBe(true);
		expect(socketService.connectCalls).toBe(0);
	});

	it('should keep mission in-progress after manufacture until repair step completes', async () => {
		const postManufactureState = createGateState(
			missionId,
			characterId,
			['completed', 'completed', 'completed', 'active'],
			'2026-05-01T00:00:03.000Z',
		);

		const request = await syncGateStateAndAcknowledge(postManufactureState);
		expect(request.status).toBe('in-progress');

		const statusDetail = JSON.parse(request.statusDetail ?? '{}') as GateState;
		expect(statusDetail.steps.find((step) => step.key === 'repair_scavenger_pod')?.status).toBe('active');
		expect(statusDetail.steps.find((step) => step.key === 'repair_scavenger_pod')?.completedAt).toBeUndefined();
	});

	it('should drive mission events scan-launch-manufacture-repair to completed status', async () => {
		let gateState = createGateState(
			missionId,
			characterId,
			['active', 'locked', 'locked', 'locked'],
			'2026-05-01T00:00:00.000Z',
		);

		gateState = applyMissionEvent(gateState, 'scan', '2026-05-01T00:00:01.000Z');
		gateState = applyMissionEvent(gateState, 'launch', '2026-05-01T00:00:02.000Z');
		gateState = applyMissionEvent(gateState, 'manufacture', '2026-05-01T00:00:03.000Z');
		gateState = applyMissionEvent(gateState, 'repair', '2026-05-01T00:00:04.000Z');

		const request = await syncGateStateAndAcknowledge(gateState);
		expect(request.status).toBe('completed');

		const statusDetail = JSON.parse(request.statusDetail ?? '{}') as GateState;
		expect(statusDetail.steps.every((step) => step.status === 'completed')).toBe(true);
		expect(statusDetail.activeObjectiveText).toContain('Mission objectives complete');
	});

	it('should not progress mission when launch happens before scan', async () => {
		const initialState = createGateState(
			missionId,
			characterId,
			['active', 'locked', 'locked', 'locked'],
			'2026-05-01T00:00:00.000Z',
		);

		const gateAfterWrongOrderEvent = applyMissionEvent(initialState, 'launch', '2026-05-01T00:00:01.000Z');
		expect(gateAfterWrongOrderEvent).toEqual(initialState);

		const request = await syncGateStateAndAcknowledge(gateAfterWrongOrderEvent);
		expect(request.status).toBe('started');

		const statusDetail = JSON.parse(request.statusDetail ?? '{}') as GateState;
		expect(statusDetail.steps.filter((step) => step.status === 'completed').length).toBe(0);
		expect(statusDetail.steps.find((step) => step.key === 'identify_iron_asteroid')?.status).toBe('active');
	});
});
