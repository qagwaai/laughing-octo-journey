export {};

function createSignal<T>(initial: T) {
	let value = initial;
	const sig = () => value;
	sig.set = (v: T) => {
		value = v;
	};
	return sig;
}

const DRONE_LIST_REQUEST_EVENT = 'drone-list-request';
const DRONE_LIST_RESPONSE_EVENT = 'drone-list-response';

interface GameJoinState {
	playerName?: string;
	joinCharacter?: {
		id: string;
		characterName: string;
		level?: number;
	};
}

interface MockRouter {
	navigate: jasmine.Spy;
}

class MockGameJoinPage {
	private socketService: MockSocketService;
	private sessionService: MockSessionService;
	private router: MockRouter;
	private unsubscribeDroneListResponse?: () => void;

	playerName = createSignal<string>('');
	joinCharacter = createSignal<GameJoinState['joinCharacter'] | null>(null);
	characterName = createSignal<string>('Unknown Character');
    drones = createSignal<Array<{ id: string; name: string; status?: string; model?: string }>>([]);
	isLoadingDrones = createSignal(false);
	droneListError = createSignal<string | null>(null);

	constructor(socketService: MockSocketService, sessionService: MockSessionService, router: MockRouter, state?: GameJoinState) {
		this.socketService = socketService;
		this.sessionService = sessionService;
		this.router = router;
		this.playerName.set(state?.playerName ?? '');
		this.joinCharacter.set(state?.joinCharacter ?? null);
		this.characterName.set(state?.joinCharacter?.characterName ?? 'Unknown Character');

		if (this.socketService.getIsConnected()) {
			this.loadDronesForCharacter();
		} else {
			this.socketService.once('connect', () => this.loadDronesForCharacter());
		}
	}

	loadDronesForCharacter(): void {
		const playerName = this.playerName().trim();
		const character = this.joinCharacter();

		if (!playerName) {
			this.droneListError.set('Player name is required to load drones.');
			this.drones.set([]);
			return;
		}

		if (!character?.id) {
			this.droneListError.set('Character id is required to load drones.');
			this.drones.set([]);
			return;
		}

		this.isLoadingDrones.set(true);
		this.droneListError.set(null);
		this.unsubscribeDroneListResponse?.();

		this.unsubscribeDroneListResponse = this.socketService.on(
			DRONE_LIST_RESPONSE_EVENT,
			(response: {
				success: boolean;
				message: string;
				playerName: string;
				characterId: string;
				drones: Array<{ id: string; name: string; status?: string; model?: string }>;
			}) => {
				this.isLoadingDrones.set(false);
				if (response.success) {
					this.drones.set(response.drones ?? []);
					this.droneListError.set(null);
				} else {
					this.drones.set([]);
					this.droneListError.set(response.message);
				}
				this.unsubscribeDroneListResponse?.();
			},
		);

		this.socketService.emit(DRONE_LIST_REQUEST_EVENT, {
			playerName,
			characterId: character.id,
			sessionKey: this.sessionService.getSessionKey()!,
		});
	}

	navigateToDroneSpecs(drone: { id: string; name: string; status?: string; model?: string }): void {
		this.router.navigate([{ outlets: { primary: ['drone-view-specs'], left: ['game-join'] } }], {
			preserveFragment: true,
			state: {
				playerName: this.playerName(),
				joinCharacter: this.joinCharacter(),
				joinDrone: drone,
			},
		});
	}

	getDroneDisplayName(drone: { id: string; name: string }): string {
		return drone.name.trim() || 'Unnamed Drone';
	}

	getDroneKinematicsSummary(drone: {
		kinematics?: {
			position: { x: number; y: number; z: number };
			velocity: { x: number; y: number; z: number };
			reference: {
				referenceKind: string;
				distanceUnit: 'km';
				velocityUnit: 'km/s';
			};
		};
	}): string {
		const kinematics = drone.kinematics;
		if (!kinematics) {
			return 'Kinematics unavailable';
		}

		const speedKmPerSec = Math.sqrt(
			kinematics.velocity.x ** 2 +
			kinematics.velocity.y ** 2 +
			kinematics.velocity.z ** 2,
		);
		const position = `(${kinematics.position.x}, ${kinematics.position.y}, ${kinematics.position.z}) ${kinematics.reference.distanceUnit}`;
		if (speedKmPerSec <= 1e-9) {
			return `${kinematics.reference.referenceKind}, position ${position}, stationary at ${speedKmPerSec.toFixed(3)} ${kinematics.reference.velocityUnit}`;
		}

		const heading = `(${(kinematics.velocity.x / speedKmPerSec).toFixed(3)}, ${(kinematics.velocity.y / speedKmPerSec).toFixed(3)}, ${(kinematics.velocity.z / speedKmPerSec).toFixed(3)})`;
		return `${kinematics.reference.referenceKind}, position ${position}, speed ${speedKmPerSec.toFixed(3)} ${kinematics.reference.velocityUnit}, heading ${heading}`;
	}

	ngOnDestroy(): void {
		this.unsubscribeDroneListResponse?.();
	}
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

describe('GameJoinPage', () => {
	let socketService: MockSocketService;
	let sessionService: MockSessionService;
	let router: MockRouter;

	beforeEach(() => {
		socketService = createMockSocketService();
		sessionService = createMockSessionService('test-session-key');
		router = { navigate: jasmine.createSpy() };
	});

	it('should initialize character name from navigation state', () => {
		socketService.connected = true;
		const component = new MockGameJoinPage(socketService, sessionService, router, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova-Prime', level: 7 },
		});

		expect(component.playerName()).toBe('Pioneer');
		expect(component.joinCharacter()).toEqual({ id: 'c-1', characterName: 'Nova-Prime', level: 7 });
		expect(component.characterName()).toBe('Nova-Prime');
		expect(socketService.emittedEvents[0]).toEqual({
			event: DRONE_LIST_REQUEST_EVENT,
			data: {
				playerName: 'Pioneer',
				characterId: 'c-1',
				sessionKey: 'test-session-key',
			},
		});

		component.ngOnDestroy();
	});

	it('should fall back to Unknown Character when no character is provided', () => {
		socketService.connected = true;
		const component = new MockGameJoinPage(socketService, sessionService, router, { playerName: 'Pioneer' });

		expect(component.playerName()).toBe('Pioneer');
		expect(component.joinCharacter()).toBeNull();
		expect(component.characterName()).toBe('Unknown Character');
		expect(component.droneListError()).toBe('Character id is required to load drones.');
		expect(socketService.emittedEvents).toBeDefined(); if (socketService.emittedEvents) { expect(socketService.emittedEvents.length).toBe(0) };

		component.ngOnDestroy();
	});

	it('should request drones when connect event fires for initially disconnected socket', () => {
		socketService.connected = false;
		const component = new MockGameJoinPage(socketService, sessionService, router, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
		});

		expect(socketService.emittedEvents).toBeDefined(); if (socketService.emittedEvents) { expect(socketService.emittedEvents.length).toBe(0) };
		socketService.triggerOnceEvent('connect');
		expect(socketService.emittedEvents[0].event).toBe(DRONE_LIST_REQUEST_EVENT);

		component.ngOnDestroy();
	});

	it('should populate drones on successful response', () => {
		socketService.connected = true;
		const component = new MockGameJoinPage(socketService, sessionService, router, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
		});

		socketService.triggerEvent(DRONE_LIST_RESPONSE_EVENT, {
			success: true,
			message: 'ok',
			playerName: 'Pioneer',
			characterId: 'c-1',
			drones: [
				{ id: 'd-1', name: 'Surveyor' },
				{ id: 'd-2', name: 'Guardian', status: 'ACTIVE' },
			],
		});

		expect(component.isLoadingDrones()).toBe(false);
		expect(component.droneListError()).toBeNull();
		expect(component.drones()).toEqual([
			{ id: 'd-1', name: 'Surveyor' },
			{ id: 'd-2', name: 'Guardian', status: 'ACTIVE' },
		]);

		component.ngOnDestroy();
	});

	it('should recover drone names from alternate payload fields', () => {
		socketService.connected = true;
		const component = new MockGameJoinPage(socketService, sessionService, router, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
		});

		const normalizeDroneSummary = (drone: { id: string; name?: string; droneName?: string; displayName?: string }) => ({
			...drone,
			name: drone.name?.trim() || drone.droneName?.trim() || drone.displayName?.trim() || drone.id,
		});

		socketService.triggerEvent(DRONE_LIST_RESPONSE_EVENT, {
			success: true,
			message: 'ok',
			playerName: 'Pioneer',
			characterId: 'c-1',
			drones: [
				normalizeDroneSummary({ id: 'd-1', droneName: 'Surveyor' }),
				normalizeDroneSummary({ id: 'd-2', name: '   ', displayName: 'Guardian' }),
			],
		});

		expect(component.drones()).toEqual([
			{ id: 'd-1', droneName: 'Surveyor', name: 'Surveyor' },
			{ id: 'd-2', name: 'Guardian', displayName: 'Guardian' },
		]);

		component.ngOnDestroy();
	});

	it('should preserve alternate top-level kinematics payload fields', () => {
		socketService.connected = true;
		const component = new MockGameJoinPage(socketService, sessionService, router, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
		});

		const normalizeDroneSummary = (drone: {
			id: string;
			name?: string;
			location?: { x: number; y: number; z: number };
			velocityVector?: { x: number; y: number; z: number };
			solarSystemId?: string;
			referenceKind?: 'barycentric' | 'body-centered';
			distanceUnit?: 'km';
			velocityUnit?: 'km/s';
		}) => ({
			...drone,
			name: drone.name?.trim() || drone.id,
			kinematics: drone.location && drone.velocityVector ? {
				position: drone.location,
				velocity: drone.velocityVector,
				reference: {
					solarSystemId: drone.solarSystemId ?? 'unknown-system',
					referenceKind: drone.referenceKind ?? 'barycentric',
					distanceUnit: drone.distanceUnit ?? 'km',
					velocityUnit: drone.velocityUnit ?? 'km/s',
					epochMs: jasmine.any(Number),
				},
			} : undefined,
		});

		socketService.triggerEvent(DRONE_LIST_RESPONSE_EVENT, {
			success: true,
			message: 'ok',
			playerName: 'Pioneer',
			characterId: 'c-1',
			drones: [
				normalizeDroneSummary({
					id: 'd-1',
					name: 'Surveyor',
					location: { x: 10, y: 20, z: 30 },
					velocityVector: { x: 3, y: 4, z: 0 },
					solarSystemId: 'sol',
					referenceKind: 'barycentric',
					distanceUnit: 'km',
					velocityUnit: 'km/s',
				}),
			],
		});

		expect(component.getDroneKinematicsSummary(component.drones()[0] as {
			kinematics?: {
				position: { x: number; y: number; z: number };
				velocity: { x: number; y: number; z: number };
				reference: { referenceKind: string; distanceUnit: 'km'; velocityUnit: 'km/s' };
			};
		})).toBe('barycentric, position (10, 20, 30) km, speed 5.000 km/s, heading (0.600, 0.800, 0.000)');

		component.ngOnDestroy();
	});

	it('should set error and clear drones on failed response', () => {
		socketService.connected = true;
		const component = new MockGameJoinPage(socketService, sessionService, router, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
		});

		socketService.triggerEvent(DRONE_LIST_RESPONSE_EVENT, {
			success: false,
			message: 'Character drones unavailable.',
			playerName: 'Pioneer',
			characterId: 'c-1',
			drones: [],
		});

		expect(component.isLoadingDrones()).toBe(false);
		expect(component.drones()).toEqual([]);
		expect(component.droneListError()).toBe('Character drones unavailable.');

		component.ngOnDestroy();
	});

	it('should navigate to drone-view-specs by changing primary outlet and preserving left game-join', () => {
		socketService.connected = true;
		const component = new MockGameJoinPage(socketService, sessionService, router, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
		});

		const drone = { id: 'd-1', name: 'Surveyor', status: 'ACTIVE' };
		component.navigateToDroneSpecs(drone);

		expect(router.navigate).toHaveBeenCalledWith(
			[{ outlets: { primary: ['drone-view-specs'], left: ['game-join'] } }],
			{
				preserveFragment: true,
				state: {
					playerName: 'Pioneer',
					joinCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
					joinDrone: drone,
				},
			},
		);

		component.ngOnDestroy();
	});

	it('should return a fallback display name for blank drone names', () => {
		socketService.connected = true;
		const component = new MockGameJoinPage(socketService, sessionService, router, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
		});

		expect(component.getDroneDisplayName({ id: 'd-1', name: '   ' })).toBe('Unnamed Drone');

		component.ngOnDestroy();
	});

	it('should summarize drone kinematics for the list', () => {
		socketService.connected = true;
		const component = new MockGameJoinPage(socketService, sessionService, router, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
		});

		expect(component.getDroneKinematicsSummary({
			kinematics: {
				position: { x: 10, y: 20, z: 30 },
				velocity: { x: 3, y: 4, z: 0 },
				reference: {
					referenceKind: 'barycentric',
					distanceUnit: 'km',
					velocityUnit: 'km/s',
				},
			},
		})).toBe('barycentric, position (10, 20, 30) km, speed 5.000 km/s, heading (0.600, 0.800, 0.000)');

		component.ngOnDestroy();
	});

	it('should return an explicit fallback when kinematics are missing', () => {
		socketService.connected = true;
		const component = new MockGameJoinPage(socketService, sessionService, router, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
		});

		expect(component.getDroneKinematicsSummary({})).toBe('Kinematics unavailable');

		component.ngOnDestroy();
	});
});
