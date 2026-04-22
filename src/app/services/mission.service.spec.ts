import { MISSION_ADD_REQUEST_EVENT, MISSION_ADD_RESPONSE_EVENT } from '../model/mission-add';
import { MISSION_LIST_REQUEST_EVENT, MISSION_LIST_RESPONSE_EVENT } from '../model/mission-list';
import { MISSION_UPSERT_REQUEST_EVENT, MISSION_UPSERT_RESPONSE_EVENT } from '../model/mission-upsert.model';
import { MissionService } from './mission.service';

type Listener = (payload: any) => void;

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

describe('MissionService', () => {
	let socketService: MockSocketService;
	let service: MissionService;

	beforeEach(() => {
		socketService = new MockSocketService();
		service = new MissionService(socketService as never);
	});

	it('should return invalid-request when required fields are missing', async () => {
		const result = await service.ensureMissionExists({
			playerName: ' ',
			characterId: 'char-1',
			sessionKey: 'session-1',
			missionId: 'first-target',
		});

		expect(result).toBe('invalid-request');
		expect(socketService.emittedEvents.length).toBe(0);
	});

	it('should return already-exists when mission is already present', async () => {
		const ensurePromise = service.ensureMissionExists({
			playerName: 'Pioneer',
			characterId: 'char-1',
			sessionKey: 'session-1',
			missionId: 'first-target',
			initialStatus: 'started',
		});
		await Promise.resolve();

		expect(socketService.emittedEvents[0].event).toBe(MISSION_LIST_REQUEST_EVENT);

		socketService.trigger(MISSION_LIST_RESPONSE_EVENT, {
			success: true,
			message: 'ok',
			playerName: 'Pioneer',
			characterId: 'char-1',
			missions: [{ missionId: 'first-target', status: 'started' }],
		});

		const result = await ensurePromise;
		expect(result).toBe('already-exists');
		expect(socketService.emittedEvents.length).toBe(1);
	});

	it('should add mission when missing and return added', async () => {
		const ensurePromise = service.ensureMissionExists({
			playerName: 'Pioneer',
			characterId: 'char-1',
			sessionKey: 'session-1',
			missionId: 'first-target',
			initialStatus: 'started',
		});
		await Promise.resolve();

		socketService.trigger(MISSION_LIST_RESPONSE_EVENT, {
			success: true,
			message: 'ok',
			playerName: 'Pioneer',
			characterId: 'char-1',
			missions: [],
		});

		expect(socketService.emittedEvents.length).toBe(2);
		expect(socketService.emittedEvents[1].event).toBe(MISSION_ADD_REQUEST_EVENT);
		expect(socketService.emittedEvents[1].data.status).toBe('started');

		socketService.trigger(MISSION_ADD_RESPONSE_EVENT, {
			success: true,
			message: 'added',
			playerName: 'Pioneer',
			characterId: 'char-1',
			mission: { missionId: 'first-target', status: 'started' },
		});

		const result = await ensurePromise;
		expect(result).toBe('added');
	});

	it('should use available as default status when initialStatus is omitted', async () => {
		const ensurePromise = service.ensureMissionExists({
			playerName: 'Pioneer',
			characterId: 'char-1',
			sessionKey: 'session-1',
			missionId: 'first-target',
		});
		await Promise.resolve();

		socketService.trigger(MISSION_LIST_RESPONSE_EVENT, {
			success: true,
			message: 'ok',
			playerName: 'Pioneer',
			characterId: 'char-1',
			missions: [],
		});

		expect(socketService.emittedEvents[1].data.status).toBe('available');

		socketService.trigger(MISSION_ADD_RESPONSE_EVENT, {
			success: true,
			message: 'added',
			playerName: 'Pioneer',
			characterId: 'char-1',
			mission: { missionId: 'first-target', status: 'available' },
		});

		const result = await ensurePromise;
		expect(result).toBe('added');
	});

	it('should return list-failed when mission list request fails', async () => {
		const ensurePromise = service.ensureMissionExists({
			playerName: 'Pioneer',
			characterId: 'char-1',
			sessionKey: 'session-1',
			missionId: 'first-target',
		});
		await Promise.resolve();

		socketService.trigger(MISSION_LIST_RESPONSE_EVENT, {
			success: false,
			message: 'boom',
			playerName: 'Pioneer',
			characterId: 'char-1',
			missions: [],
		});

		const result = await ensurePromise;
		expect(result).toBe('list-failed');
	});

	it('should return add-failed when add mission request fails', async () => {
		const ensurePromise = service.ensureMissionExists({
			playerName: 'Pioneer',
			characterId: 'char-1',
			sessionKey: 'session-1',
			missionId: 'first-target',
			initialStatus: 'started',
		});
		await Promise.resolve();

		socketService.trigger(MISSION_LIST_RESPONSE_EVENT, {
			success: true,
			message: 'ok',
			playerName: 'Pioneer',
			characterId: 'char-1',
			missions: [],
		});

		socketService.trigger(MISSION_ADD_RESPONSE_EVENT, {
			success: false,
			message: 'nope',
			playerName: 'Pioneer',
			characterId: 'char-1',
		});

		const result = await ensurePromise;
		expect(result).toBe('add-failed');
	});

	it('should ignore list responses for other player or character', async () => {
		const ensurePromise = service.ensureMissionExists({
			playerName: 'Pioneer',
			characterId: 'char-1',
			sessionKey: 'session-1',
			missionId: 'first-target',
		});
		await Promise.resolve();

		socketService.trigger(MISSION_LIST_RESPONSE_EVENT, {
			success: true,
			message: 'ok',
			playerName: 'OtherPlayer',
			characterId: 'char-1',
			missions: [{ missionId: 'first-target', status: 'completed' }],
		});

		socketService.trigger(MISSION_LIST_RESPONSE_EVENT, {
			success: true,
			message: 'ok',
			playerName: 'Pioneer',
			characterId: 'other-char',
			missions: [{ missionId: 'first-target', status: 'completed' }],
		});

		expect(socketService.emittedEvents.length).toBe(1);

		socketService.trigger(MISSION_LIST_RESPONSE_EVENT, {
			success: false,
			message: 'boom',
			playerName: 'Pioneer',
			characterId: 'char-1',
			missions: [],
		});

		const result = await ensurePromise;
		expect(result).toBe('list-failed');
	});

	it('should return not-connected when socket never connects', async () => {
		const previousTimeout = (MissionService as unknown as { RESPONSE_TIMEOUT_MS: number }).RESPONSE_TIMEOUT_MS;
		(MissionService as unknown as { RESPONSE_TIMEOUT_MS: number }).RESPONSE_TIMEOUT_MS = 10;
		socketService.connected = false;

		jasmine.clock().install();
		try {
			const ensurePromise = service.ensureMissionExists({
				playerName: 'Pioneer',
				characterId: 'char-1',
				sessionKey: 'session-1',
				missionId: 'first-target',
			});

			jasmine.clock().tick(11);
			const result = await ensurePromise;

			expect(result).toBe('not-connected');
			expect(socketService.connectCalls).toBe(1);
			expect(socketService.emittedEvents.length).toBe(0);
		} finally {
			jasmine.clock().uninstall();
			(MissionService as unknown as { RESPONSE_TIMEOUT_MS: number }).RESPONSE_TIMEOUT_MS = previousTimeout;
		}
	});

	it('should upsert mission status directly through add mission event', async () => {
		const updatePromise = service.upsertMissionStatus({
			playerName: 'Pioneer',
			characterId: 'char-1',
			sessionKey: 'session-1',
			missionId: 'first-target',
			status: 'started',
		});
		await Promise.resolve();

		expect(socketService.emittedEvents.length).toBe(1);
		expect(socketService.emittedEvents[0]).toEqual({
			event: MISSION_UPSERT_REQUEST_EVENT,
			data: {
				playerName: 'Pioneer',
				characterId: 'char-1',
				missionId: 'first-target',
				sessionKey: 'session-1',
				status: 'started',
			},
		});

		socketService.trigger(MISSION_UPSERT_RESPONSE_EVENT, {
			success: true,
			message: 'updated',
			playerName: 'Pioneer',
			characterId: 'char-1',
			mission: { missionId: 'first-target', status: 'started' },
		});

		const result = await updatePromise;
		expect(result).toBe('updated');
	});

	it('should reject mission status upsert when required fields are missing', async () => {
		const result = await service.upsertMissionStatus({
			playerName: 'Pioneer',
			characterId: 'char-1',
			sessionKey: 'session-1',
			missionId: 'first-target',
			status: ' ',
		});

		expect(result).toBe('invalid-request');
		expect(socketService.emittedEvents.length).toBe(0);
	});

	it('should return update-failed when mission status upsert fails', async () => {
		const updatePromise = service.upsertMissionStatus({
			playerName: 'Pioneer',
			characterId: 'char-1',
			sessionKey: 'session-1',
			missionId: 'first-target',
			status: 'started',
		});
		await Promise.resolve();

		socketService.trigger(MISSION_UPSERT_RESPONSE_EVENT, {
			success: false,
			message: 'nope',
			playerName: 'Pioneer',
			characterId: 'char-1',
		});

		const result = await updatePromise;
		expect(result).toBe('update-failed');
	});
});
