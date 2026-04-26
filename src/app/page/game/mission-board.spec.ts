export {};

function createSignal<T>(initial: T) {
	let value = initial;
	const sig = () => value;
	sig.set = (v: T) => {
		value = v;
	};
	return sig;
}

const MISSION_LIST_REQUEST_EVENT = 'list-missions-request';
const MISSION_LIST_RESPONSE_EVENT = 'list-missions-response';

interface NavigationState {
	playerName?: string;
	joinCharacter?: { id: string; characterName: string };
}

interface CharacterMissionProgress {
	missionId: string;
	status: string;
	startedAt?: string;
	updatedAt?: string;
	statusDetail?: string;
	failureReason?: string;
}

interface MockRouter {
	navigate: jasmine.Spy;
}

interface MockSocketService {
	emittedEvents: Array<{ event: string; data: any }>;
	registeredListeners: Map<string, (data: any) => void>;
	onceListeners: Map<string, (data?: any) => void>;
	connected: boolean;
	emit(event: string, data?: any): void;
	on(event: string, cb: (data: any) => void): () => void;
	once(event: string, cb: (data?: any) => void): void;
	getIsConnected(): boolean;
	triggerEvent(event: string, data: any): void;
	triggerOnceEvent(event: string, data?: any): void;
}

interface MockSessionService {
	getSessionKey(): string | null;
}

function createMockSocketService(): MockSocketService {
	const emittedEvents: Array<{ event: string; data: any }> = [];
	const registeredListeners = new Map<string, (data: any) => void>();
	const onceListeners = new Map<string, (data?: any) => void>();

	return {
		emittedEvents,
		registeredListeners,
		onceListeners,
		connected: false,
		emit(event: string, data?: any) {
			emittedEvents.push({ event, data });
		},
		on(event: string, cb: (data: any) => void) {
			registeredListeners.set(event, cb);
			return () => registeredListeners.delete(event);
		},
		once(event: string, cb: (data?: any) => void) {
			onceListeners.set(event, cb);
		},
		getIsConnected() {
			return this.connected;
		},
		triggerEvent(event: string, data: any) {
			registeredListeners.get(event)?.(data);
		},
		triggerOnceEvent(event: string, data?: any) {
			const cb = onceListeners.get(event);
			if (cb) {
				onceListeners.delete(event);
				cb(data);
			}
		},
	};
}

function createMockSessionService(initialKey: string | null = null): MockSessionService {
	const state = { key: initialKey };
	return {
		getSessionKey() {
			return state.key;
		},
	};
}

class MockMissionBoardPage {
	private socketService: MockSocketService;
	private sessionService: MockSessionService;
	private mockRouter: MockRouter;
	private unsubscribeMissionListResponse?: () => void;

	playerName = createSignal<string>('');
	joinCharacter = createSignal<NavigationState['joinCharacter'] | null>(null);
	missions = createSignal<CharacterMissionProgress[]>([]);
	isLoadingMissions = createSignal(false);
	missionListError = createSignal<string | null>(null);

	constructor(
		socketService: MockSocketService,
		sessionService: MockSessionService,
		state?: NavigationState,
		mockRouter?: MockRouter,
	) {
		this.socketService = socketService;
		this.sessionService = sessionService;
		this.mockRouter = mockRouter ?? { navigate: jasmine.createSpy('navigate') };
		this.playerName.set(state?.playerName ?? '');
		this.joinCharacter.set(state?.joinCharacter ?? null);

		if (this.socketService.getIsConnected()) {
			this.loadMissionsForCharacter();
		} else {
			this.socketService.once('connect', () => this.loadMissionsForCharacter());
		}
	}

	loadMissionsForCharacter(): void {
		const playerName = this.playerName().trim();
		const characterId = this.joinCharacter()?.id?.trim() ?? '';
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

		if (!playerName) {
			this.missionListError.set('Player name is required to load missions.');
			this.missions.set([]);
			return;
		}

		if (!characterId) {
			this.missionListError.set('Character id is required to load missions.');
			this.missions.set([]);
			return;
		}

		if (!sessionKey) {
			this.missionListError.set('Session key is required to load missions.');
			this.missions.set([]);
			return;
		}

		this.isLoadingMissions.set(true);
		this.missionListError.set(null);
		this.unsubscribeMissionListResponse?.();

		this.unsubscribeMissionListResponse = this.socketService.on(
			MISSION_LIST_RESPONSE_EVENT,
			(response: {
				success: boolean;
				message: string;
				missions: CharacterMissionProgress[];
			}) => {
				this.isLoadingMissions.set(false);
				if (response.success) {
					this.missions.set(response.missions ?? []);
					this.missionListError.set(null);
				} else {
					this.missions.set([]);
					this.missionListError.set(response.message);
				}
				this.unsubscribeMissionListResponse?.();
			},
		);

		this.socketService.emit(MISSION_LIST_REQUEST_EVENT, {
			playerName,
			characterId,
			sessionKey,
		});
	}

	formatDate(isoString?: string): string {
		if (!isoString) {
			return '—';
		}
		return isoString.slice(0, 10);
	}

	navigateToCharacterProfile(): void {
		this.mockRouter.navigate([{ outlets: { left: ['character-profile'] } }], {
			preserveFragment: true,
			state: {
				playerName: this.playerName(),
				joinCharacter: this.joinCharacter(),
			},
		});
	}

	ngOnDestroy(): void {
		this.unsubscribeMissionListResponse?.();
	}
}

describe('MissionBoardPage', () => {
	let socketService: MockSocketService;
	let sessionService: MockSessionService;

	beforeEach(() => {
		socketService = createMockSocketService();
		sessionService = createMockSessionService('test-session-key');
	});

	it('should initialize from navigation state and request missions when connected', () => {
		socketService.connected = true;
		const component = new MockMissionBoardPage(socketService, sessionService, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		expect(component.playerName()).toBe('Pioneer');
		expect(component.joinCharacter()).toEqual({ id: 'c-1', characterName: 'Nova' });
		expect(socketService.emittedEvents[0]).toEqual({
			event: MISSION_LIST_REQUEST_EVENT,
			data: {
				playerName: 'Pioneer',
				characterId: 'c-1',
				sessionKey: 'test-session-key',
			},
		});

		component.ngOnDestroy();
	});

	it('should request missions when connect event fires for initially disconnected socket', () => {
		socketService.connected = false;
		const component = new MockMissionBoardPage(socketService, sessionService, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		expect(socketService.emittedEvents.length).toBe(0);
		socketService.triggerOnceEvent('connect');
		expect(socketService.emittedEvents[0].event).toBe(MISSION_LIST_REQUEST_EVENT);

		component.ngOnDestroy();
	});

	it('should set validation error when playerName is missing', () => {
		socketService.connected = true;
		const component = new MockMissionBoardPage(socketService, sessionService, {
			playerName: '   ',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		expect(component.missionListError()).toBe('Player name is required to load missions.');
		expect(component.missions()).toEqual([]);
		expect(socketService.emittedEvents.length).toBe(0);
	});

	it('should set validation error when character id is missing', () => {
		socketService.connected = true;
		const component = new MockMissionBoardPage(socketService, sessionService, {
			playerName: 'Pioneer',
			joinCharacter: { id: '', characterName: 'Nova' },
		});

		expect(component.missionListError()).toBe('Character id is required to load missions.');
		expect(component.missions()).toEqual([]);
		expect(socketService.emittedEvents.length).toBe(0);
	});

	it('should set validation error when session key is missing', () => {
		socketService.connected = true;
		sessionService = createMockSessionService(null);
		const component = new MockMissionBoardPage(socketService, sessionService, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		expect(component.missionListError()).toBe('Session key is required to load missions.');
		expect(component.missions()).toEqual([]);
		expect(socketService.emittedEvents.length).toBe(0);
	});

	it('should populate missions on successful response', () => {
		socketService.connected = true;
		const component = new MockMissionBoardPage(socketService, sessionService, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		socketService.triggerEvent(MISSION_LIST_RESPONSE_EVENT, {
			success: true,
			message: 'ok',
			missions: [
				{ missionId: 'first-target', status: 'in-progress', startedAt: '2026-04-01T10:00:00Z' },
				{ missionId: 'second-mission', status: 'completed', updatedAt: '2026-04-10T12:00:00Z' },
			],
		});

		expect(component.isLoadingMissions()).toBe(false);
		expect(component.missionListError()).toBeNull();
		expect(component.missions().length).toBe(2);

		component.ngOnDestroy();
	});

	it('should set error and clear missions on failed response', () => {
		socketService.connected = true;
		const component = new MockMissionBoardPage(socketService, sessionService, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		socketService.triggerEvent(MISSION_LIST_RESPONSE_EVENT, {
			success: false,
			message: 'Character not found',
			missions: [],
		});

		expect(component.isLoadingMissions()).toBe(false);
		expect(component.missionListError()).toBe('Character not found');
		expect(component.missions()).toEqual([]);

		component.ngOnDestroy();
	});

	it('should unsubscribe after receiving a response', () => {
		socketService.connected = true;
		const component = new MockMissionBoardPage(socketService, sessionService, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		socketService.triggerEvent(MISSION_LIST_RESPONSE_EVENT, {
			success: true,
			message: 'ok',
			missions: [],
		});

		expect(socketService.registeredListeners.has(MISSION_LIST_RESPONSE_EVENT)).toBe(false);

		component.ngOnDestroy();
	});

	it('should set isLoadingMissions true while waiting for response', () => {
		socketService.connected = true;
		const component = new MockMissionBoardPage(socketService, sessionService, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		expect(component.isLoadingMissions()).toBe(true);

		component.ngOnDestroy();
	});

	it('should format ISO date to YYYY-MM-DD', () => {
		socketService.connected = false;
		const component = new MockMissionBoardPage(socketService, sessionService);

		expect(component.formatDate('2026-04-21T08:30:00.000Z')).toBe('2026-04-21');
		expect(component.formatDate('2026-01-05T00:00:00Z')).toBe('2026-01-05');
	});

	it('should return dash for missing date', () => {
		socketService.connected = false;
		const component = new MockMissionBoardPage(socketService, sessionService);

		expect(component.formatDate(undefined)).toBe('—');
		expect(component.formatDate('')).toBe('—');
	});

	it('should navigate to character-profile with state', () => {
		socketService.connected = false;
		const mockRouter: MockRouter = { navigate: jasmine.createSpy('navigate') };
		const character = { id: 'c-1', characterName: 'Nova' };
		const component = new MockMissionBoardPage(
			socketService,
			sessionService,
			{ playerName: 'Pioneer', joinCharacter: character },
			mockRouter,
		);

		component.navigateToCharacterProfile();

		expect(mockRouter.navigate).toHaveBeenCalledWith(
			[{ outlets: { left: ['character-profile'] } }],
			{
				preserveFragment: true,
				state: {
					playerName: 'Pioneer',
					joinCharacter: character,
				},
			},
		);
	});

	it('should clean up listener on ngOnDestroy', () => {
		socketService.connected = true;
		const component = new MockMissionBoardPage(socketService, sessionService, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		expect(socketService.registeredListeners.has(MISSION_LIST_RESPONSE_EVENT)).toBe(true);

		component.ngOnDestroy();

		expect(socketService.registeredListeners.has(MISSION_LIST_RESPONSE_EVENT)).toBe(false);
	});
});
