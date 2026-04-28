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
const FIRST_TARGET_MISSION_ID = 'first-target';

interface NavigationState {
	playerName?: string;
	joinCharacter?: {
		id: string;
		characterName: string;
		missions?: Array<{ missionId: string; status: string }>;
	};
}

interface ShipSummary {
	id: string;
	name: string;
	model?: string;
	tier?: number;
	status?: string;
	inventory?: { id: string; itemType: string; displayName: string; state: string; damageStatus: string }[];
	location?: { positionKm: { x: number; y: number; z: number } };
	kinematics?: { position: { x: number; y: number; z: number } };
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

class MockShipHangarPage {
	private socketService: MockSocketService;
	private sessionService: MockSessionService;
	private mockRouter: MockRouter;
	private unsubscribeShipListResponse?: () => void;

	t = {
		game: {
			shipHangar: {
				locationUnavailable: 'Location unavailable',
			},
		},
	};

	playerName = createSignal<string>('');
	joinCharacter = createSignal<NavigationState['joinCharacter'] | null>(null);
	ships = createSignal<ShipSummary[]>([]);
	isLoadingShips = createSignal(false);
	shipListError = createSignal<string | null>(null);

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
			this.loadShipsForCharacter();
		} else {
			this.socketService.once('connect', () => this.loadShipsForCharacter());
		}
	}

	loadShipsForCharacter(): void {
		const playerName = this.playerName().trim();
		const characterId = this.joinCharacter()?.id?.trim() ?? '';
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

		if (!playerName) {
			this.shipListError.set('Player name is required to load ships.');
			this.ships.set([]);
			return;
		}

		if (!characterId) {
			this.shipListError.set('Character id is required to load ships.');
			this.ships.set([]);
			return;
		}

		if (!sessionKey) {
			this.shipListError.set('Session key is required to load ships.');
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
				ships: ShipSummary[];
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
			characterId,
			sessionKey,
		});
	}

	getShipDisplayName(ship: ShipSummary): string {
		return ship.name?.trim() || ship.id;
	}

	getShipLocationSummary(ship: ShipSummary): string {
		const position = ship.location?.positionKm ?? ship.kinematics?.position;
		if (!position) {
			return this.t.game.shipHangar.locationUnavailable;
		}
		return `(${position.x}, ${position.y}, ${position.z}) km`;
	}

	private getFirstTargetMissionStatus(): string | undefined {
		const missions = this.joinCharacter()?.missions;
		if (!Array.isArray(missions)) {
			return undefined;
		}

		return missions.find((mission) => mission.missionId === FIRST_TARGET_MISSION_ID)?.status;
	}

	navigateToShipInventory(ship: ShipSummary): void {
		this.mockRouter.navigate([{ outlets: { left: ['ship-view-inventory'] } }], {
			preserveFragment: true,
			state: {
				playerName: this.playerName(),
				joinCharacter: this.joinCharacter(),
				joinShip: ship,
			},
		});
	}

	navigateToExteriorView(ship: ShipSummary): void {
		const firstTargetMissionStatus = this.getFirstTargetMissionStatus();
		const missionContext = {
			missionId: FIRST_TARGET_MISSION_ID,
			seedPolicy: 'auto',
			...(firstTargetMissionStatus ? { missionStatusHint: firstTargetMissionStatus } : {}),
		};

		this.mockRouter.navigate([{ outlets: { right: ['ship-exterior-view'], left: ['ship-hangar'] } }], {
			preserveFragment: true,
			state: {
				playerName: this.playerName(),
				joinCharacter: this.joinCharacter(),
				joinShip: ship,
				missionContext,
				...(firstTargetMissionStatus ? { firstTargetMissionStatus } : {}),
			},
		});
	}

	navigateToShipSpecs(ship: ShipSummary): void {
		this.mockRouter.navigate([{ outlets: { right: ['item-view-specs'], left: ['ship-hangar'] } }], {
			preserveFragment: true,
			queryParams: { specsNav: Date.now() },
			state: {
				playerName: this.playerName(),
				joinCharacter: this.joinCharacter(),
				itemType: ship.model?.trim() || 'Scavenger Pod',
				item: ship,
			},
		});
	}

	ngOnDestroy(): void {
		this.unsubscribeShipListResponse?.();
	}
}

describe('ShipHangarPage', () => {
	let socketService: MockSocketService;
	let sessionService: MockSessionService;

	beforeEach(() => {
		socketService = createMockSocketService();
		sessionService = createMockSessionService('test-session-key');
	});

	it('should initialize from navigation state and request ships when connected', () => {
		socketService.connected = true;
		const component = new MockShipHangarPage(socketService, sessionService, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		expect(component.playerName()).toBe('Pioneer');
		expect(component.joinCharacter()).toEqual({ id: 'c-1', characterName: 'Nova' });
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

	it('should request ships when connect event fires for initially disconnected socket', () => {
		socketService.connected = false;
		const component = new MockShipHangarPage(socketService, sessionService, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		expect(socketService.emittedEvents.length).toBe(0);
		socketService.triggerOnceEvent('connect');
		expect(socketService.emittedEvents[0].event).toBe(SHIP_LIST_REQUEST_EVENT);

		component.ngOnDestroy();
	});

	it('should set validation error when playerName is missing', () => {
		socketService.connected = true;
		const component = new MockShipHangarPage(socketService, sessionService, {
			playerName: '   ',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		expect(component.shipListError()).toBe('Player name is required to load ships.');
		expect(component.ships()).toEqual([]);
		expect(socketService.emittedEvents.length).toBe(0);
	});

	it('should set validation error when character id is missing', () => {
		socketService.connected = true;
		const component = new MockShipHangarPage(socketService, sessionService, {
			playerName: 'Pioneer',
			joinCharacter: { id: '', characterName: 'Nova' },
		});

		expect(component.shipListError()).toBe('Character id is required to load ships.');
		expect(component.ships()).toEqual([]);
		expect(socketService.emittedEvents.length).toBe(0);
	});

	it('should set validation error when session key is missing', () => {
		socketService.connected = true;
		sessionService = createMockSessionService(null);
		const component = new MockShipHangarPage(socketService, sessionService, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		expect(component.shipListError()).toBe('Session key is required to load ships.');
		expect(component.ships()).toEqual([]);
		expect(socketService.emittedEvents.length).toBe(0);
	});

	it('should populate ships on successful response', () => {
		socketService.connected = true;
		const component = new MockShipHangarPage(socketService, sessionService, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		socketService.triggerEvent(SHIP_LIST_RESPONSE_EVENT, {
			success: true,
			message: 'ok',
			ships: [
				{ id: 's-1', name: 'Courier', location: { positionKm: { x: 1, y: 2, z: 3 } } },
				{ id: 's-2', name: 'Ranger' },
			],
		});

		expect(component.isLoadingShips()).toBe(false);
		expect(component.shipListError()).toBeNull();
		expect(component.ships().length).toBe(2);

		component.ngOnDestroy();
	});

	it('should set error and clear ships on failed response', () => {
		socketService.connected = true;
		const component = new MockShipHangarPage(socketService, sessionService, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		socketService.triggerEvent(SHIP_LIST_RESPONSE_EVENT, {
			success: false,
			message: 'Character not found',
			ships: [{ id: 's-1', name: 'Courier' }],
		});

		expect(component.isLoadingShips()).toBe(false);
		expect(component.shipListError()).toBe('Character not found');
		expect(component.ships()).toEqual([]);

		component.ngOnDestroy();
	});

	it('should return name fallback for blank ship name', () => {
		socketService.connected = false;
		const component = new MockShipHangarPage(socketService, sessionService);

		expect(component.getShipDisplayName({ id: 's-1', name: '   ' })).toBe('s-1');
		expect(component.getShipDisplayName({ id: 's-2', name: 'Courier' })).toBe('Courier');
	});

	it('should summarize location from location.positionKm first', () => {
		socketService.connected = false;
		const component = new MockShipHangarPage(socketService, sessionService);

		const summary = component.getShipLocationSummary({
			id: 's-1',
			name: 'Courier',
			location: { positionKm: { x: 10, y: 20, z: 30 } },
			kinematics: { position: { x: 1, y: 2, z: 3 } },
		});

		expect(summary).toBe('(10, 20, 30) km');
	});

	it('should summarize location from kinematics.position when location is missing', () => {
		socketService.connected = false;
		const component = new MockShipHangarPage(socketService, sessionService);

		const summary = component.getShipLocationSummary({
			id: 's-1',
			name: 'Courier',
			kinematics: { position: { x: -1, y: 0, z: 4 } },
		});

		expect(summary).toBe('(-1, 0, 4) km');
	});

	it('should return unavailable location text when no position exists', () => {
		socketService.connected = false;
		const component = new MockShipHangarPage(socketService, sessionService);

		expect(component.getShipLocationSummary({ id: 's-1', name: 'Courier' })).toBe('Location unavailable');
	});

	it('should navigate to ship-view-inventory with ship state', () => {
		socketService.connected = false;
		const mockRouter: MockRouter = { navigate: jasmine.createSpy('navigate') };
		const character = { id: 'c-1', characterName: 'Nova' };
		const component = new MockShipHangarPage(
			socketService,
			sessionService,
			{ playerName: 'Pioneer', joinCharacter: character },
			mockRouter,
		);
		const ship: ShipSummary = {
			id: 's-1',
			name: 'Dart Runner',
			inventory: [{ id: 'drone-1', itemType: 'expendable-dart-drone', displayName: 'Expendable Dart Drone', state: 'contained', damageStatus: 'intact' }],
		};

		component.navigateToShipInventory(ship);

		expect(mockRouter.navigate).toHaveBeenCalledWith(
			[{ outlets: { left: ['ship-view-inventory'] } }],
			{
				preserveFragment: true,
				state: {
					playerName: 'Pioneer',
					joinCharacter: character,
					joinShip: ship,
				},
			},
		);
	});

	it('should navigate to ship-exterior-view with full ship payload', () => {
		socketService.connected = false;
		const mockRouter: MockRouter = { navigate: jasmine.createSpy('navigate') };
		const character = { id: 'c-1', characterName: 'Nova' };
		const component = new MockShipHangarPage(
			socketService,
			sessionService,
			{ playerName: 'Pioneer', joinCharacter: character },
			mockRouter,
		);
		const ship: ShipSummary = {
			id: 's-1',
			name: 'Dart Runner',
			model: 'Scavenger Pod',
			inventory: [
				{ id: 'drone-1', itemType: 'expendable-dart-drone', displayName: 'Expendable Dart Drone', state: 'contained', damageStatus: 'intact' },
			],
		};

		component.navigateToExteriorView(ship);

		expect(mockRouter.navigate).toHaveBeenCalledWith(
			[{ outlets: { right: ['ship-exterior-view'], left: ['ship-hangar'] } }],
			{
				preserveFragment: true,
				state: {
					playerName: 'Pioneer',
					joinCharacter: character,
					joinShip: ship,
					missionContext: {
						missionId: FIRST_TARGET_MISSION_ID,
						seedPolicy: 'auto',
					},
				},
			},
		);
	});

	it('should navigate to item-view-specs with ship model and ship payload', () => {
		socketService.connected = false;
		const mockRouter: MockRouter = { navigate: jasmine.createSpy('navigate') };
		const character = { id: 'c-1', characterName: 'Nova' };
		const component = new MockShipHangarPage(
			socketService,
			sessionService,
			{ playerName: 'Pioneer', joinCharacter: character },
			mockRouter,
		);
		const ship: ShipSummary = {
			id: 's-1',
			name: 'Dart Runner',
			model: 'Scavenger Pod',
		};

		component.navigateToShipSpecs(ship);

		expect(mockRouter.navigate).toHaveBeenCalledWith(
			[{ outlets: { right: ['item-view-specs'], left: ['ship-hangar'] } }],
			{
				preserveFragment: true,
				queryParams: { specsNav: jasmine.any(Number) },
				state: {
					playerName: 'Pioneer',
					joinCharacter: character,
					itemType: 'Scavenger Pod',
					item: ship,
				},
			},
		);
	});
});
