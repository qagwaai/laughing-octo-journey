export {};

import { computeDistanceKm, type MarketSummary } from '../../model/market-list';
import type { Triple } from '../../model/triple';

function createSignal<T>(initial: T) {
	let value = initial;
	const sig = () => value;
	sig.set = (v: T) => {
		value = v;
	};
	return sig;
}

type WritableSignalLike<T> = (() => T) & { set(v: T): void };

interface NavigationState {
	playerName?: string;
	joinCharacter?: { id: string; characterName: string };
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
	activeShip: WritableSignalLike<{
		status?: string | null;
		kinematics?: { position: Triple; reference?: { solarSystemId?: string } };
		location?: { positionKm: Triple };
	} | null>;
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
	const activeShip = createSignal<{
		status?: string | null;
		kinematics?: { position: Triple; reference?: { solarSystemId?: string } };
		location?: { positionKm: Triple };
	} | null>(null);

	return {
		getSessionKey() {
			return initialKey;
		},
		activeShip,
	};
}

const MARKET_LIST_REQUEST_EVENT = 'market-list-request';
const MARKET_LIST_RESPONSE_EVENT = 'market-list-response';
const KNOWN_MARKET_POSITIONS_KM: Record<string, Triple> = {
	'sol-ceres-exchange': { x: 413_700_000, y: 0, z: 0 },
};

class MockMarketHubPage {
	private socketService: MockSocketService;
	private sessionService: MockSessionService;

	playerName = createSignal<string>('');
	joinCharacter = createSignal<NavigationState['joinCharacter'] | null>(null);
 	markets = createSignal<MarketSummary[]>([]);
 	marketListError = createSignal<string | null>(null);
 	selectedRadiusKm = createSignal<number>(100);

	constructor(socketService: MockSocketService, sessionService: MockSessionService, state?: NavigationState) {
		this.socketService = socketService;
		this.sessionService = sessionService;
		this.playerName.set(state?.playerName ?? '');
		this.joinCharacter.set(state?.joinCharacter ?? null);

		if (this.socketService.getIsConnected()) {
			this.loadNearbyMarkets();
		} else {
			this.socketService.once('connect', () => this.loadNearbyMarkets());
		}
	}

	private getSolarSystemId(): string {
		return this.sessionService.activeShip()?.kinematics?.reference?.solarSystemId?.trim() || 'sol';
	}

	loadNearbyMarkets(): void {
		const playerName = this.playerName().trim();
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

		if (!playerName) {
			this.marketListError.set('Player name is required to load markets.');
			this.markets.set([]);
			return;
		}

		if (!sessionKey) {
			this.marketListError.set('Session key is required to load markets.');
			this.markets.set([]);
			return;
		}

		this.socketService.on(MARKET_LIST_RESPONSE_EVENT, (response: { success: boolean; message: string; markets: MarketSummary[] }) => {
			if (response.success) {
				this.markets.set(response.markets ?? []);
				this.marketListError.set(null);
			} else {
				this.markets.set([]);
				this.marketListError.set(response.message);
			}
		});

		this.socketService.emit(MARKET_LIST_REQUEST_EVENT, {
			playerName,
			sessionKey,
			solarSystemId: this.getSolarSystemId(),
		});
	}

	setRadius(radiusKm: number): void {
		this.selectedRadiusKm.set(radiusKm);
	}

	isDocked(): boolean {
		return (this.sessionService.activeShip()?.status?.trim().toLowerCase() ?? '') === 'docked';
	}

	canTransact(): boolean {
		return this.isDocked();
	}

	localMarkets(): Array<MarketSummary & { distanceKm: number | null }> {
		const radiusKm = this.selectedRadiusKm();
		const shipPosition = this.sessionService.activeShip()?.kinematics?.position ?? this.sessionService.activeShip()?.location?.positionKm ?? null;
		const solarSystemId = this.getSolarSystemId();

		return this.markets()
			.filter((market) => market.solarSystemId === solarSystemId)
			.map((market) => {
				const marketPosition = KNOWN_MARKET_POSITIONS_KM[market.marketId];
				const distanceKm = shipPosition && marketPosition ? computeDistanceKm(shipPosition, marketPosition) : null;
				return {
					...market,
					distanceKm,
				};
			})
			.filter((market) => market.distanceKm === null || market.distanceKm <= radiusKm);
	}
}

describe('MarketHubPage', () => {
	it('should initialize from navigation state', () => {
		const socketService = createMockSocketService();
		socketService.connected = true;
		const sessionService = createMockSessionService('session-key');
		const component = new MockMarketHubPage(socketService, sessionService, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		expect(component.playerName()).toBe('Pioneer');
		expect(component.joinCharacter()).toEqual({ id: 'c-1', characterName: 'Nova' });
	});

	it('should fallback to empty values', () => {
		const socketService = createMockSocketService();
		socketService.connected = true;
		const sessionService = createMockSessionService('session-key');
		const component = new MockMarketHubPage(socketService, sessionService);
		expect(component.playerName()).toBe('');
		expect(component.joinCharacter()).toBeNull();
	});

	it('should emit market-list-request scoped to active ship solar system', () => {
		const socketService = createMockSocketService();
		socketService.connected = true;
		const sessionService = createMockSessionService('session-key');
		sessionService.activeShip.set({
			status: 'docked',
			kinematics: {
				position: { x: 413_700_000, y: 0, z: 0 },
				reference: { solarSystemId: 'sol' },
			},
		});

		new MockMarketHubPage(socketService, sessionService, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		expect(socketService.emittedEvents[0]).toEqual({
			event: MARKET_LIST_REQUEST_EVENT,
			data: {
				playerName: 'Pioneer',
				sessionKey: 'session-key',
				solarSystemId: 'sol',
			},
		});
	});

	it('should set an error when session key is missing', () => {
		const socketService = createMockSocketService();
		socketService.connected = true;
		const sessionService = createMockSessionService(null);
		const component = new MockMarketHubPage(socketService, sessionService, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		expect(component.marketListError()).toBe('Session key is required to load markets.');
		expect(component.markets()).toEqual([]);
	});

	it('should expose market list from successful response', () => {
		const socketService = createMockSocketService();
		socketService.connected = true;
		const sessionService = createMockSessionService('session-key');
		const component = new MockMarketHubPage(socketService, sessionService, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		socketService.triggerEvent(MARKET_LIST_RESPONSE_EVENT, {
			success: true,
			message: 'ok',
			markets: [
				{
					marketId: 'sol-ceres-exchange',
					solarSystemId: 'sol',
					marketName: 'Ceres Exchange',
					locationType: 'station',
					locationName: 'Ceres Belt Trade Ring',
					priceMultiplier: 1,
					driftPercentPerHour: 6,
					restockIntervalMinutes: 60,
				},
			],
		});

		expect(component.marketListError()).toBeNull();
		expect(component.markets().length).toBe(1);
		expect(component.markets()[0].marketId).toBe('sol-ceres-exchange');
	});

	it('should filter markets by selected radius for known market positions', () => {
		const socketService = createMockSocketService();
		socketService.connected = true;
		const sessionService = createMockSessionService('session-key');
		sessionService.activeShip.set({
			status: 'docked',
			kinematics: {
				position: { x: 413_700_020, y: 0, z: 0 },
				reference: { solarSystemId: 'sol' },
			},
		});
		const component = new MockMarketHubPage(socketService, sessionService, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		socketService.triggerEvent(MARKET_LIST_RESPONSE_EVENT, {
			success: true,
			message: 'ok',
			markets: [
				{
					marketId: 'sol-ceres-exchange',
					solarSystemId: 'sol',
					marketName: 'Ceres Exchange',
					locationType: 'station',
					locationName: 'Ceres Belt Trade Ring',
					priceMultiplier: 1,
					driftPercentPerHour: 6,
					restockIntervalMinutes: 60,
				},
			],
		});

		component.setRadius(10);
		expect(component.localMarkets().length).toBe(0);

		component.setRadius(30);
		expect(component.localMarkets().length).toBe(1);
		expect(component.localMarkets()[0].distanceKm).not.toBeNull();
	});

	it('should require docking for transact actions', () => {
		const socketService = createMockSocketService();
		socketService.connected = true;
		const sessionService = createMockSessionService('session-key');
		sessionService.activeShip.set({ status: 'in-flight' });
		const component = new MockMarketHubPage(socketService, sessionService, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		expect(component.isDocked()).toBeFalse();
		expect(component.canTransact()).toBeFalse();

		sessionService.activeShip.set({ status: 'docked' });
		expect(component.isDocked()).toBeTrue();
		expect(component.canTransact()).toBeTrue();
	});
});
