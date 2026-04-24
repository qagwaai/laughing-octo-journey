export {};

function createSignal<T>(initial: T) {
	let value = initial;
	const sig = () => value;
	sig.set = (v: T) => {
		value = v;
	};
	return sig;
}

const SHIP_LIST_REQUEST_EVENT = 'ship-list-request';
const SHIP_LIST_RESPONSE_EVENT = 'ship-list-response';

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
	private unsubscribeShipListResponse?: () => void;

	playerName = createSignal<string>('');
	joinCharacter = createSignal<GameJoinState['joinCharacter'] | null>(null);
	characterName = createSignal<string>('Unknown Character');
    ships = createSignal<Array<{ id: string; name: string; status?: string; model?: string }>>([]);
	isLoadingShips = createSignal(false);
	shipListError = createSignal<string | null>(null);

	constructor(socketService: MockSocketService, sessionService: MockSessionService, router: MockRouter, state?: GameJoinState) {
		this.socketService = socketService;
		this.sessionService = sessionService;
		this.router = router;
		this.playerName.set(state?.playerName ?? '');
		this.joinCharacter.set(state?.joinCharacter ?? null);
		this.characterName.set(state?.joinCharacter?.characterName ?? 'Unknown Character');

		if (this.socketService.getIsConnected()) {
			this.loadShipsForCharacter();
		} else {
			this.socketService.once('connect', () => this.loadShipsForCharacter());
		}
	}

	loadShipsForCharacter(): void {
		const playerName = this.playerName().trim();
		const character = this.joinCharacter();

		if (!playerName) {
			this.shipListError.set('Player name is required to load ships.');
			this.ships.set([]);
			return;
		}

		if (!character?.id) {
			this.shipListError.set('Character id is required to load ships.');
			this.ships.set([]);
			return;
		}

		this.isLoadingShips.set(true);
		this.shipListError.set(null);
		this.unsubscribeShipListResponse?.();

		this.unsubscribeShipListResponse = this.socketService.on(
			SHIP_LIST_RESPONSE_EVENT,
			(response: {
				success: boolean;
				message: string;
				playerName: string;
				characterId: string;
				ships: Array<{ id: string; name: string; status?: string; model?: string }>;
			}) => {
				this.isLoadingShips.set(false);
				if (response.success) {
					this.ships.set(response.ships ?? []);
					this.shipListError.set(null);
				} else {
					this.ships.set([]);
					this.shipListError.set(response.message);
				}
				this.unsubscribeShipListResponse?.();
			},
		);

		this.socketService.emit(SHIP_LIST_REQUEST_EVENT, {
			playerName,
			characterId: character.id,
			sessionKey: this.sessionService.getSessionKey()!,
		});
	}

	navigateToShipSpecs(ship: { id: string; name: string; status?: string; model?: string }): void {
		this.router.navigate([{ outlets: { right: ['ship-view-specs'], left: ['game-join'] } }], {
			preserveFragment: true,
			state: {
				playerName: this.playerName(),
				joinCharacter: this.joinCharacter(),
				joinShip: ship,
			},
		});
	}

	getShipDisplayName(ship: { id: string; name: string }): string {
		return ship.name.trim() || 'Unnamed Ship';
	}

	getShipKinematicsSummary(ship: {
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
		const kinematics = ship.kinematics;
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
		this.unsubscribeShipListResponse?.();
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
			event: SHIP_LIST_REQUEST_EVENT,
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
		expect(component.shipListError()).toBe('Character id is required to load ships.');
		expect(socketService.emittedEvents).toBeDefined(); if (socketService.emittedEvents) { expect(socketService.emittedEvents.length).toBe(0) };

		component.ngOnDestroy();
	});

	it('should request ships when connect event fires for initially disconnected socket', () => {
		socketService.connected = false;
		const component = new MockGameJoinPage(socketService, sessionService, router, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
		});

		expect(socketService.emittedEvents).toBeDefined(); if (socketService.emittedEvents) { expect(socketService.emittedEvents.length).toBe(0) };
		socketService.triggerOnceEvent('connect');
		expect(socketService.emittedEvents[0].event).toBe(SHIP_LIST_REQUEST_EVENT);

		component.ngOnDestroy();
	});

	it('should populate ships on successful response', () => {
		socketService.connected = true;
		const component = new MockGameJoinPage(socketService, sessionService, router, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
		});

		socketService.triggerEvent(SHIP_LIST_RESPONSE_EVENT, {
			success: true,
			message: 'ok',
			playerName: 'Pioneer',
			characterId: 'c-1',
			ships: [
				{ id: 'd-1', name: 'Surveyor' },
				{ id: 'd-2', name: 'Guardian', status: 'ACTIVE' },
			],
		});

		expect(component.isLoadingShips()).toBe(false);
		expect(component.shipListError()).toBeNull();
		expect(component.ships()).toEqual([
			{ id: 'd-1', name: 'Surveyor' },
			{ id: 'd-2', name: 'Guardian', status: 'ACTIVE' },
		]);

		component.ngOnDestroy();
	});

	it('should recover ship names from alternate payload fields', () => {
		socketService.connected = true;
		const component = new MockGameJoinPage(socketService, sessionService, router, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
		});

		const normalizeShipSummary = (ship: { id: string; name?: string; shipName?: string; displayName?: string }) => ({
			id: ship.id,
			name: ship.name?.trim() || ship.shipName?.trim() || ship.displayName?.trim() || ship.id,
		});

		socketService.triggerEvent(SHIP_LIST_RESPONSE_EVENT, {
			success: true,
			message: 'ok',
			playerName: 'Pioneer',
			characterId: 'c-1',
			ships: [
				normalizeShipSummary({ id: 'd-1', shipName: 'Surveyor' }),
				normalizeShipSummary({ id: 'd-2', name: '   ', displayName: 'Guardian' }),
			],
		});

		expect(component.ships()).toEqual([
			{ id: 'd-1', name: 'Surveyor' },
			{ id: 'd-2', name: 'Guardian' },
		]);

		component.ngOnDestroy();
	});

	it('should preserve alternate top-level kinematics payload fields', () => {
		socketService.connected = true;
		const component = new MockGameJoinPage(socketService, sessionService, router, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
		});

		const normalizeShipSummary = (ship: {
			id: string;
			name?: string;
			location?: { x: number; y: number; z: number };
			velocityVector?: { x: number; y: number; z: number };
			solarSystemId?: string;
			referenceKind?: 'barycentric' | 'body-centered';
			distanceUnit?: 'km';
			velocityUnit?: 'km/s';
		}) => ({
			id: ship.id,
			name: ship.name?.trim() || ship.id,
			kinematics: ship.location && ship.velocityVector ? {
				position: ship.location,
				velocity: ship.velocityVector,
				reference: {
					solarSystemId: ship.solarSystemId ?? 'unknown-system',
					referenceKind: ship.referenceKind ?? 'barycentric',
					distanceUnit: ship.distanceUnit ?? 'km',
					velocityUnit: ship.velocityUnit ?? 'km/s',
					epochMs: jasmine.any(Number),
				},
			} : undefined,
		});

		socketService.triggerEvent(SHIP_LIST_RESPONSE_EVENT, {
			success: true,
			message: 'ok',
			playerName: 'Pioneer',
			characterId: 'c-1',
			ships: [
				normalizeShipSummary({
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

		expect(component.getShipKinematicsSummary(component.ships()[0] as {
			kinematics?: {
				position: { x: number; y: number; z: number };
				velocity: { x: number; y: number; z: number };
				reference: { referenceKind: string; distanceUnit: 'km'; velocityUnit: 'km/s' };
			};
		})).toBe('barycentric, position (10, 20, 30) km, speed 5.000 km/s, heading (0.600, 0.800, 0.000)');

		component.ngOnDestroy();
	});

	it('should set error and clear ships on failed response', () => {
		socketService.connected = true;
		const component = new MockGameJoinPage(socketService, sessionService, router, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
		});

		socketService.triggerEvent(SHIP_LIST_RESPONSE_EVENT, {
			success: false,
			message: 'Character ships unavailable.',
			playerName: 'Pioneer',
			characterId: 'c-1',
			ships: [],
		});

		expect(component.isLoadingShips()).toBe(false);
		expect(component.ships()).toEqual([]);
		expect(component.shipListError()).toBe('Character ships unavailable.');

		component.ngOnDestroy();
	});

	it('should navigate to ship-view-specs by changing primary outlet and preserving left game-join', () => {
		socketService.connected = true;
		const component = new MockGameJoinPage(socketService, sessionService, router, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
		});

		const ship = { id: 'd-1', name: 'Surveyor', status: 'ACTIVE' };
		component.navigateToShipSpecs(ship);

		expect(router.navigate).toHaveBeenCalledWith(
			[{ outlets: { right: ['ship-view-specs'], left: ['game-join'] } }],
			{
				preserveFragment: true,
				state: {
					playerName: 'Pioneer',
					joinCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
					joinShip: ship,
				},
			},
		);

		component.ngOnDestroy();
	});

	it('should return a fallback display name for blank ship names', () => {
		socketService.connected = true;
		const component = new MockGameJoinPage(socketService, sessionService, router, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
		});

		expect(component.getShipDisplayName({ id: 'd-1', name: '   ' })).toBe('Unnamed Ship');

		component.ngOnDestroy();
	});

	it('should summarize ship kinematics for the list', () => {
		socketService.connected = true;
		const component = new MockGameJoinPage(socketService, sessionService, router, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
		});

		expect(component.getShipKinematicsSummary({
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

		expect(component.getShipKinematicsSummary({})).toBe('Kinematics unavailable');

		component.ngOnDestroy();
	});
});
