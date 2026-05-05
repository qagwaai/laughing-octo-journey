export {};

import type { MarketSummary } from '../../model/market-list';
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
		id?: string;
		status?: string | null;
		spatial?: { solarSystemId?: string; positionKm: Triple };
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
		id?: string;
		status?: string | null;
		spatial?: { solarSystemId?: string; positionKm: Triple };
	} | null>(null);

	return {
		getSessionKey() {
			return initialKey;
		},
		activeShip,
	};
}

const MARKET_LIST_BY_LOCATION_REQUEST_EVENT = 'market-list-by-location-request';
const MARKET_LIST_BY_LOCATION_RESPONSE_EVENT = 'market-list-by-location-response';
const SHIP_LIST_REQUEST_EVENT = 'ship-list-request';
const SHIP_LIST_RESPONSE_EVENT = 'ship-list-response';

class MockMarketHubPage {
	private socketService: MockSocketService;
	private sessionService: MockSessionService;

	playerName = createSignal<string>('');
	joinCharacter = createSignal<NavigationState['joinCharacter'] | null>(null);
 	markets = createSignal<MarketSummary[]>([]);
 	marketListError = createSignal<string | null>(null);
 	selectedRadiusKm = createSignal<number>(100);
	isDockedAtAnyMarket = createSignal(false);
	dockedMarketId = createSignal<string | null>(null);

	constructor(socketService: MockSocketService, sessionService: MockSessionService, state?: NavigationState) {
		this.socketService = socketService;
		this.sessionService = sessionService;
		this.playerName.set(state?.playerName ?? '');
		this.joinCharacter.set(state?.joinCharacter ?? null);

		if (this.socketService.getIsConnected()) {
			this.ensureActiveShipPosition();
			this.loadNearbyMarkets();
		} else {
			this.socketService.once('connect', () => {
				this.ensureActiveShipPosition();
				this.loadNearbyMarkets();
			});
		}
	}

	private ensureActiveShipPosition(): void {
		const existing = this.sessionService.activeShip();
		if (existing?.spatial?.positionKm) {
			return;
		}

		const playerName = this.playerName().trim();
		const characterId = this.joinCharacter()?.id?.trim() ?? '';
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';

		if (!playerName || !characterId || !sessionKey) {
			return;
		}

		this.socketService.on(
			SHIP_LIST_RESPONSE_EVENT,
			(response: {
				success: boolean;
				message: string;
				ships: Array<{
					id: string;
					name: string;
					model: string;
					tier: number;
					status?: string;
					spatial?: { solarSystemId?: string; positionKm: Triple };
				}>;
			}) => {
				if (!response.success) {
					return;
				}

				const ships = response.ships ?? [];
				if (ships.length === 0) {
					return;
				}

				const current = this.sessionService.activeShip();
				const sameShip = current ? ships.find((ship) => ship.id === current.id) : undefined;
				const shipWithPosition = ships.find((ship) => ship.spatial?.positionKm);
				const resolved = sameShip ?? shipWithPosition ?? ships[0];

				this.sessionService.activeShip.set(resolved);
			},
		);

		this.socketService.emit(SHIP_LIST_REQUEST_EVENT, {
			playerName,
			characterId,
			sessionKey,
		});
	}

	private getSolarSystemId(): string {
		return this.sessionService.activeShip()?.spatial?.solarSystemId?.trim() || 'sol';
	}

	loadNearbyMarkets(): void {
		const playerName = this.playerName().trim();
		const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
		const positionKm = this.sessionService.activeShip()?.spatial?.positionKm ?? null;
		const characterId = this.joinCharacter()?.id?.trim() ?? '';
		const shipId = this.sessionService.activeShip()?.id?.trim() ?? '';
		const solarSystemId = this.getSolarSystemId();

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

		if (!positionKm) {
			this.marketListError.set('Active ship position is required to load local markets.');
			this.markets.set([]);
			this.isDockedAtAnyMarket.set(false);
			this.dockedMarketId.set(null);
			return;
		}

		this.socketService.on(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT, (response: {
			success: boolean;
			message: string;
			markets: MarketSummary[];
			isDocked?: boolean;
			dockedMarketId?: string | null;
		}) => {
			if (response.success) {
				this.markets.set(response.markets ?? []);
				this.isDockedAtAnyMarket.set(Boolean(response.isDocked));
				this.dockedMarketId.set(response.dockedMarketId ?? null);
				this.marketListError.set(null);
			} else {
				this.markets.set([]);
				this.isDockedAtAnyMarket.set(false);
				this.dockedMarketId.set(null);
				this.marketListError.set(response.message);
			}
		});

		this.socketService.emit(MARKET_LIST_BY_LOCATION_REQUEST_EVENT, {
			playerName,
			sessionKey,
			solarSystemId,
			positionKm,
			distanceKm: this.selectedRadiusKm(),
			limit: 50,
			locationTypes: ['station'],
			...(characterId ? { characterId } : {}),
			...(shipId ? { shipId } : {}),
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

	canTransactAtMarket(market: MarketSummary): boolean {
		if (market.isDocked === true) {
			return true;
		}
		return this.isDockedAtAnyMarket() && this.dockedMarketId() === market.marketId;
	}

	localMarkets(): MarketSummary[] {
		return this.markets()
			.filter((market) => market.solarSystemId === this.getSolarSystemId())
			.map((market) => {
				const distanceKm = typeof market.distanceKm === 'number' ? market.distanceKm : undefined;
				return {
					...market,
					distanceKm,
				};
			})
			.sort((a, b) => {
				const aDistance = typeof a.distanceKm === 'number' ? a.distanceKm : Number.POSITIVE_INFINITY;
				const bDistance = typeof b.distanceKm === 'number' ? b.distanceKm : Number.POSITIVE_INFINITY;
				return aDistance - bDistance;
			});
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
			spatial: {
				solarSystemId: 'sol',
				positionKm: { x: 413_700_000, y: 0, z: 0 },
			},
		});

		new MockMarketHubPage(socketService, sessionService, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		expect(socketService.emittedEvents.find((event) => event.event === MARKET_LIST_BY_LOCATION_REQUEST_EVENT)).toEqual({
			event: MARKET_LIST_BY_LOCATION_REQUEST_EVENT,
			data: {
				playerName: 'Pioneer',
				sessionKey: 'session-key',
				solarSystemId: 'sol',
				positionKm: { x: 413_700_000, y: 0, z: 0 },
				distanceKm: 100,
				limit: 50,
				locationTypes: ['station'],
				characterId: 'c-1',
			},
		});
	});

	it('should request ship-list and hydrate active ship when active ship has no position', () => {
		const socketService = createMockSocketService();
		socketService.connected = true;
		const sessionService = createMockSessionService('session-key');
		sessionService.activeShip.set({ id: 'starter-pod-c-1', status: 'ACTIVE' } as any);

		new MockMarketHubPage(socketService, sessionService, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		expect(socketService.emittedEvents[0]).toEqual({
			event: SHIP_LIST_REQUEST_EVENT,
			data: {
				playerName: 'Pioneer',
				characterId: 'c-1',
				sessionKey: 'session-key',
			},
		});

		socketService.triggerEvent(SHIP_LIST_RESPONSE_EVENT, {
			success: true,
			message: 'ok',
			ships: [
				{
					id: 'starter-pod-c-1',
					name: 'Scavenger Pod',
					model: 'Scavenger Pod',
					tier: 1,
					status: 'docked',
					spatial: { solarSystemId: 'sol', positionKm: { x: 100, y: 200, z: 300 } },
				},
			],
		});

		expect(sessionService.activeShip()?.spatial?.positionKm).toEqual({ x: 100, y: 200, z: 300 });
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
		sessionService.activeShip.set({
			id: 'starter-pod-c-1',
			status: 'docked',
			spatial: {
				solarSystemId: 'sol',
				positionKm: { x: 413_700_000, y: 0, z: 0 },
			},
		});
		const component = new MockMarketHubPage(socketService, sessionService, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		socketService.triggerEvent(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT, {
			success: true,
			message: 'ok',
			isDocked: false,
			dockedMarketId: null,
			markets: [
				{
					marketId: 'sol-ceres-exchange',
					solarSystemId: 'sol',
					marketName: 'Ceres Exchange',
					siteType: 'station',
					siteName: 'Ceres Belt Trade Ring',
					spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 413_704_822, y: 0, z: 0 }, epochMs: 1 },
					distanceKm: 4821.8,
					isDocked: false,
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

	it('should sort markets by authoritative distance from response', () => {
		const socketService = createMockSocketService();
		socketService.connected = true;
		const sessionService = createMockSessionService('session-key');
		sessionService.activeShip.set({
			status: 'docked',
			spatial: {
				solarSystemId: 'sol',
				positionKm: { x: 413_700_020, y: 0, z: 0 },
			},
		});
		const component = new MockMarketHubPage(socketService, sessionService, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		socketService.triggerEvent(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT, {
			success: true,
			message: 'ok',
			isDocked: false,
			dockedMarketId: null,
			markets: [
				{
					marketId: 'sol-far-exchange',
					solarSystemId: 'sol',
					marketName: 'Far Exchange',
					siteType: 'station',
					siteName: 'Far Ring',
					spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 413_709_520, y: 0, z: 0 }, epochMs: 1 },
					distanceKm: 9500,
					isDocked: false,
					priceMultiplier: 1,
					driftPercentPerHour: 6,
					restockIntervalMinutes: 60,
				},
				{
					marketId: 'sol-ceres-exchange',
					solarSystemId: 'sol',
					marketName: 'Ceres Exchange',
					siteType: 'station',
					siteName: 'Ceres Belt Trade Ring',
					spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 413_704_842, y: 0, z: 0 }, epochMs: 1 },
					distanceKm: 4821.8,
					isDocked: false,
					priceMultiplier: 1,
					driftPercentPerHour: 6,
					restockIntervalMinutes: 60,
				},
			],
		});

		expect(component.localMarkets().length).toBe(2);
		expect(component.localMarkets()[0].marketId).toBe('sol-ceres-exchange');
		expect(component.localMarkets()[1].marketId).toBe('sol-far-exchange');
	});

	it('should use response docking state to enable transact only at docked market', () => {
		const socketService = createMockSocketService();
		socketService.connected = true;
		const sessionService = createMockSessionService('session-key');
		sessionService.activeShip.set({
			id: 'starter-pod-c-1',
			status: 'in-flight',
			spatial: {
				solarSystemId: 'sol',
				positionKm: { x: 413_700_020, y: 0, z: 0 },
			},
		});
		const component = new MockMarketHubPage(socketService, sessionService, {
			playerName: 'Pioneer',
			joinCharacter: { id: 'c-1', characterName: 'Nova' },
		});

		socketService.triggerEvent(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT, {
			success: true,
			message: 'ok',
			isDocked: true,
			dockedMarketId: 'sol-ceres-exchange',
			markets: [
				{
					marketId: 'sol-ceres-exchange',
					solarSystemId: 'sol',
					marketName: 'Ceres Exchange',
					siteType: 'station',
					siteName: 'Ceres Belt Trade Ring',
					spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 413_700_022, y: 0, z: 0 }, epochMs: 1 },
					distanceKm: 2,
					isDocked: true,
					priceMultiplier: 1,
					driftPercentPerHour: 6,
					restockIntervalMinutes: 60,
				},
				{
					marketId: 'sol-far-exchange',
					solarSystemId: 'sol',
					marketName: 'Far Exchange',
					siteType: 'station',
					siteName: 'Far Ring',
					spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 413_700_220, y: 0, z: 0 }, epochMs: 1 },
					distanceKm: 200,
					isDocked: false,
					priceMultiplier: 1,
					driftPercentPerHour: 6,
					restockIntervalMinutes: 60,
				},
			],
		});

		expect(component.canTransactAtMarket(component.localMarkets()[0])).toBeTrue();
		expect(component.canTransactAtMarket(component.localMarkets()[1])).toBeFalse();
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
