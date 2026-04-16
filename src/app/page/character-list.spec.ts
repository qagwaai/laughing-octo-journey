import {
	CHARACTER_LIST_REQUEST_EVENT,
	CHARACTER_LIST_RESPONSE_EVENT,
	CharacterListRequest,
	CharacterListResponse,
} from '../model/character-list';

function createSignal<T>(initial: T) {
	let value = initial;
	const sig = () => value;
	sig.set = (v: T) => {
		value = v;
	};
	return sig;
}

interface MockSocketService {
	emittedEvents: Array<{ event: string; data: any }>;
	registeredListeners: Map<string, (data: any) => void>;
	emit(event: string, data?: any): void;
	on(event: string, cb: (data: any) => void): () => void;
	triggerEvent(event: string, data: any): void;
}

function createMockSocketService(): MockSocketService {
	const emittedEvents: Array<{ event: string; data: any }> = [];
	const registeredListeners = new Map<string, (data: any) => void>();

	return {
		emittedEvents,
		registeredListeners,
		emit(event: string, data?: any) {
			emittedEvents.push({ event, data });
		},
		on(event: string, cb: (data: any) => void) {
			registeredListeners.set(event, cb);
			return () => registeredListeners.delete(event);
		},
		triggerEvent(event: string, data: any) {
			registeredListeners.get(event)?.(data);
		},
	};
}

class MockCharacterListPage {
	private socketService: MockSocketService;
	private unsubscribeResponse?: () => void;

	playerName = createSignal('Pioneer');
	characters = createSignal<any[]>([]);
	isLoading = createSignal(false);
	errorMessage = createSignal<string | null>(null);

	constructor(socketService: MockSocketService) {
		this.socketService = socketService;
	}

	loadCharacters(): void {
		const playerName = this.playerName().trim();
		if (!playerName) {
			this.errorMessage.set('Player name is required to load characters.');
			this.characters.set([]);
			return;
		}

		this.isLoading.set(true);
		this.errorMessage.set(null);
		this.unsubscribeResponse?.();

		this.unsubscribeResponse = this.socketService.on(
			CHARACTER_LIST_RESPONSE_EVENT,
			(response: CharacterListResponse) => {
				this.isLoading.set(false);
				if (response.success) {
					this.characters.set(response.characters ?? []);
				} else {
					this.characters.set([]);
					this.errorMessage.set(response.message);
				}
				this.unsubscribeResponse?.();
			},
		);

		const request: CharacterListRequest = { playerName };
		this.socketService.emit(CHARACTER_LIST_REQUEST_EVENT, request);
	}

	ngOnDestroy(): void {
		this.unsubscribeResponse?.();
	}
}

describe('CharacterListPage', () => {
	let component: MockCharacterListPage;
	let socketService: MockSocketService;

	beforeEach(() => {
		socketService = createMockSocketService();
		component = new MockCharacterListPage(socketService);
	});

	afterEach(() => {
		component.ngOnDestroy();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should initialize with empty list and no error', () => {
		expect(component.characters()).toEqual([]);
		expect(component.errorMessage()).toBeNull();
		expect(component.isLoading()).toBe(false);
	});

	describe('loadCharacters()', () => {
		it('should emit character list request with playerName', () => {
			component.playerName.set('Pioneer');
			component.loadCharacters();

			expect(socketService.emittedEvents).toHaveLength(1);
			expect(socketService.emittedEvents[0].event).toBe(CHARACTER_LIST_REQUEST_EVENT);
			expect(socketService.emittedEvents[0].data).toEqual<CharacterListRequest>({
				playerName: 'Pioneer',
			});
		});

		it('should show validation error when playerName is empty', () => {
			component.playerName.set('   ');
			component.loadCharacters();

			expect(component.errorMessage()).toBe('Player name is required to load characters.');
			expect(socketService.emittedEvents).toHaveLength(0);
		});

		it('should populate characters on successful response', () => {
			component.loadCharacters();
			socketService.triggerEvent(CHARACTER_LIST_RESPONSE_EVENT, {
				success: true,
				message: 'ok',
				playerName: 'Pioneer',
				characters: [
					{ id: '1', characterName: 'Nova', level: 5 },
					{ id: '2', characterName: 'Atlas', level: 8 },
				],
			} satisfies CharacterListResponse);

			expect(component.characters()).toHaveLength(2);
			expect(component.errorMessage()).toBeNull();
			expect(component.isLoading()).toBe(false);
		});

		it('should set error and clear list on failure response', () => {
			component.loadCharacters();
			socketService.triggerEvent(CHARACTER_LIST_RESPONSE_EVENT, {
				success: false,
				message: 'Player not found.',
				playerName: 'Pioneer',
				characters: [],
			} satisfies CharacterListResponse);

			expect(component.characters()).toEqual([]);
			expect(component.errorMessage()).toBe('Player not found.');
			expect(component.isLoading()).toBe(false);
		});
	});
});
