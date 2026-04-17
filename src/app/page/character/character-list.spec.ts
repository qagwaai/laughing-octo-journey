import {
	CHARACTER_DELETE_REQUEST_EVENT,
	CHARACTER_DELETE_RESPONSE_EVENT,
	CharacterDeleteRequest,
	CharacterDeleteResponse,
} from '../../model/character-delete';
import {
	CHARACTER_LIST_REQUEST_EVENT,
	CHARACTER_LIST_RESPONSE_EVENT,
	CharacterListRequest,
	CharacterListResponse,
} from '../../model/character-list';
import {
	GAME_JOIN_REQUEST_EVENT,
	GameJoinRequest,
} from '../../model/game-join';
import { INVALID_SESSION_EVENT } from '../../model/session';

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
	onceListeners: Map<string, (data?: any) => void>;
	connected: boolean;
	emit(event: string, data?: any): void;
	on(event: string, cb: (data: any) => void): () => void;
	once(event: string, cb: (data?: any) => void): void;
	getIsConnected(): boolean;
	triggerEvent(event: string, data: any): void;
	triggerOnceEvent(event: string, data?: any): void;
}

interface MockRouter {
	navigate: jest.Mock;
}

interface MockSessionService {
	storedKey: string | null;
	setSessionKey(key: string): void;
	getSessionKey(): string | null;
	clearSession(): void;
	hasSession(): boolean;
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
		get storedKey() { return state.key; },
		setSessionKey(key: string) { state.key = key; },
		getSessionKey() { return state.key; },
		clearSession() { state.key = null; },
		hasSession() { return state.key !== null; },
	};
}

class MockCharacterListPage {
	private socketService: MockSocketService;
	private router: MockRouter;
	private sessionService: MockSessionService;
	private unsubscribeResponse?: () => void;
	private unsubscribeDeleteResponse?: () => void;
	private unsubscribeInvalidSession?: () => void;

	playerName = createSignal('Pioneer');
	characters = createSignal<any[]>([]);
	isLoading = createSignal(false);
	errorMessage = createSignal<string | null>(null);
	pendingDeleteCharacter = createSignal<any | null>(null);
	isDeleting = createSignal(false);

	constructor(socketService: MockSocketService, router: MockRouter, sessionService: MockSessionService) {
		this.socketService = socketService;
		this.router = router;
		this.sessionService = sessionService;

		this.unsubscribeInvalidSession = this.socketService.on(
			INVALID_SESSION_EVENT,
			() => {
				this.sessionService.clearSession();
				this.router.navigate([{ outlets: { left: ['login'] } }], { preserveFragment: true });
			},
		);

		if (this.socketService.getIsConnected()) {
			this.loadCharacters();
		} else {
			this.socketService.once('connect', () => this.loadCharacters());
		}
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

		const request: CharacterListRequest = { playerName, sessionKey: this.sessionService.getSessionKey()! };
		this.socketService.emit(CHARACTER_LIST_REQUEST_EVENT, request);
	}

	requestDeleteCharacter(character: any): void {
		this.errorMessage.set(null);
		this.pendingDeleteCharacter.set(character);
	}

	cancelDeleteCharacter(): void {
		if (this.isDeleting()) {
			return;
		}
		this.pendingDeleteCharacter.set(null);
	}

	confirmDeleteCharacter(): void {
		const playerName = this.playerName().trim();
		const character = this.pendingDeleteCharacter();
		if (!character) {
			return;
		}
		if (!playerName) {
			this.errorMessage.set('Player name is required to delete a character.');
			return;
		}

		this.isDeleting.set(true);
		this.errorMessage.set(null);
		this.unsubscribeDeleteResponse?.();

		this.unsubscribeDeleteResponse = this.socketService.on(
			CHARACTER_DELETE_RESPONSE_EVENT,
			(response: CharacterDeleteResponse) => {
				this.isDeleting.set(false);
				if (response.success) {
					this.characters.set(this.characters().filter((c) => c.id !== character.id));
					this.pendingDeleteCharacter.set(null);
				} else {
					this.errorMessage.set(response.message);
				}
				this.unsubscribeDeleteResponse?.();
			},
		);

		const request: CharacterDeleteRequest = {
			playerName,
			characterId: character.id,
			characterName: character.characterName,
			sessionKey: this.sessionService.getSessionKey()!,
		};
		this.socketService.emit(CHARACTER_DELETE_REQUEST_EVENT, request);
	}

	navigateToCharacterSetup(): void {
		const playerName = this.playerName();
		this.router.navigate([{ outlets: { left: ['character-setup'] } }], {
			preserveFragment: true,
			state: { playerName, mode: 'create' },
		});
	}

	navigateToCharacterEdit(character: any): void {
		const playerName = this.playerName();
		this.router.navigate([{ outlets: { left: ['character-setup'] } }], {
			preserveFragment: true,
			state: {
				playerName,
				mode: 'edit',
				editCharacter: character,
			},
		});
	}

	navigateToGameJoin(character: any): void {
		const playerName = this.playerName().trim();
		if (!playerName) {
			this.errorMessage.set('Player name is required to join a game.');
			return;
		}
		if (!character.id) {
			this.errorMessage.set('Character id is required to join a game.');
			return;
		}

		const request: GameJoinRequest = {
			playerName,
			characterId: character.id,
			sessionKey: this.sessionService.getSessionKey()!,
		};
		this.socketService.emit(GAME_JOIN_REQUEST_EVENT, request);

		this.router.navigate([{ outlets: { left: ['game-join'] } }], {
			preserveFragment: true,
			state: {
				playerName,
				joinCharacter: character,
			},
		});
	}

	ngOnDestroy(): void {
		this.unsubscribeResponse?.();
		this.unsubscribeDeleteResponse?.();
		this.unsubscribeInvalidSession?.();
	}
}

describe('CharacterListPage', () => {
	let component: MockCharacterListPage;
	let socketService: MockSocketService;
	let router: MockRouter;
	let sessionService: MockSessionService;

	beforeEach(() => {
		socketService = createMockSocketService();
		router = { navigate: jest.fn() };
		sessionService = createMockSessionService('test-session-key');
		component = new MockCharacterListPage(socketService, router, sessionService);
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

	describe('constructor auto-load behavior', () => {
		it('should load characters immediately when socket is already connected', () => {
			const connectedSocket = createMockSocketService();
			connectedSocket.connected = true;
			const autoLoadComponent = new MockCharacterListPage(connectedSocket, router, sessionService);

			expect(autoLoadComponent.isLoading()).toBe(true);
			expect(connectedSocket.emittedEvents[0].event).toBe(CHARACTER_LIST_REQUEST_EVENT);
		});

		it('should load characters when connect event fires if initially disconnected', () => {
			const disconnectedSocket = createMockSocketService();
			disconnectedSocket.connected = false;
			const autoLoadComponent = new MockCharacterListPage(disconnectedSocket, router, sessionService);

			expect(disconnectedSocket.emittedEvents).toHaveLength(0);
			disconnectedSocket.triggerOnceEvent('connect');
			expect(disconnectedSocket.emittedEvents[0].event).toBe(CHARACTER_LIST_REQUEST_EVENT);
			autoLoadComponent.ngOnDestroy();
		});
	});

	describe('loadCharacters()', () => {
		it('should emit character list request with playerName', () => {
			component.playerName.set('Pioneer');
			component.loadCharacters();

			expect(socketService.emittedEvents).toHaveLength(1);
			expect(socketService.emittedEvents[0].event).toBe(CHARACTER_LIST_REQUEST_EVENT);
			expect(socketService.emittedEvents[0].data).toEqual<CharacterListRequest>({
				playerName: 'Pioneer',
				sessionKey: 'test-session-key',
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

	describe('navigateToCharacterSetup()', () => {
		it('should navigate to character-setup with playerName in left outlet', () => {
			component.playerName.set('Pioneer');
			component.navigateToCharacterSetup();

			expect(router.navigate).toHaveBeenCalledWith(
				[{ outlets: { left: ['character-setup'] } }],
				{ preserveFragment: true, state: { playerName: 'Pioneer', mode: 'create' } },
			);
		});

		it('should navigate to character-setup in edit mode with selected character state', () => {
			const character = { id: '1', characterName: 'Nova', level: 5 };
			component.playerName.set('Pioneer');
			component.navigateToCharacterEdit(character);

			expect(router.navigate).toHaveBeenCalledWith(
				[{ outlets: { left: ['character-setup'] } }],
				{
					preserveFragment: true,
					state: {
						playerName: 'Pioneer',
						mode: 'edit',
						editCharacter: character,
					},
				},
			);
		});

		it('should navigate to game-join with selected character state', () => {
			const character = { id: '1', characterName: 'Nova', level: 5 };
			component.playerName.set('Pioneer');
			component.navigateToGameJoin(character);

			expect(socketService.emittedEvents[socketService.emittedEvents.length - 1]).toEqual({
				event: GAME_JOIN_REQUEST_EVENT,
				data: {
					playerName: 'Pioneer',
					characterId: '1',
					sessionKey: 'test-session-key',
				},
			});

			expect(router.navigate).toHaveBeenCalledWith(
				[{ outlets: { left: ['game-join'] } }],
				{
					preserveFragment: true,
					state: {
						playerName: 'Pioneer',
						joinCharacter: character,
					},
				},
			);
		});

		it('should set error and not navigate when playerName is empty for game join', () => {
			const character = { id: '1', characterName: 'Nova', level: 5 };
			component.playerName.set('   ');
			component.navigateToGameJoin(character);

			expect(component.errorMessage()).toBe('Player name is required to join a game.');
			expect(router.navigate).not.toHaveBeenCalled();
			expect(socketService.emittedEvents).toHaveLength(0);
		});

		it('should set error and not navigate when character id is missing for game join', () => {
			component.playerName.set('Pioneer');
			component.navigateToGameJoin({ characterName: 'Nova' });

			expect(component.errorMessage()).toBe('Character id is required to join a game.');
			expect(router.navigate).not.toHaveBeenCalled();
			expect(socketService.emittedEvents).toHaveLength(0);
		});
	});

	describe('delete character workflow', () => {
		beforeEach(() => {
			component.characters.set([
				{ id: '1', characterName: 'Nova', level: 5 },
				{ id: '2', characterName: 'Atlas', level: 8 },
			]);
		});

		it('should open confirmation dialog when delete is requested', () => {
			component.requestDeleteCharacter({ id: '1', characterName: 'Nova' });

			expect(component.pendingDeleteCharacter()).toEqual({ id: '1', characterName: 'Nova' });
		});

		it('should cancel delete and clear pending character', () => {
			component.requestDeleteCharacter({ id: '1', characterName: 'Nova' });
			component.cancelDeleteCharacter();

			expect(component.pendingDeleteCharacter()).toBeNull();
		});

		it('should emit character delete request on confirm', () => {
			component.requestDeleteCharacter({ id: '1', characterName: 'Nova' });
			component.confirmDeleteCharacter();

			expect(socketService.emittedEvents[socketService.emittedEvents.length - 1].event).toBe(CHARACTER_DELETE_REQUEST_EVENT);
			expect(socketService.emittedEvents[socketService.emittedEvents.length - 1].data).toEqual<CharacterDeleteRequest>({
				playerName: 'Pioneer',
				characterId: '1',
				characterName: 'Nova',
				sessionKey: 'test-session-key',
			});
			expect(component.isDeleting()).toBe(true);
		});

		it('should remove character and close dialog on successful delete response', () => {
			component.requestDeleteCharacter({ id: '1', characterName: 'Nova' });
			component.confirmDeleteCharacter();
			socketService.triggerEvent(CHARACTER_DELETE_RESPONSE_EVENT, {
				success: true,
				message: 'Character deleted.',
				playerName: 'Pioneer',
				characterId: '1',
			} satisfies CharacterDeleteResponse);

			expect(component.characters()).toEqual([{ id: '2', characterName: 'Atlas', level: 8 }]);
			expect(component.pendingDeleteCharacter()).toBeNull();
			expect(component.isDeleting()).toBe(false);
		});

		it('should keep dialog open and show error on failed delete response', () => {
			component.requestDeleteCharacter({ id: '1', characterName: 'Nova' });
			component.confirmDeleteCharacter();
			socketService.triggerEvent(CHARACTER_DELETE_RESPONSE_EVENT, {
				success: false,
				message: 'Character cannot be deleted.',
				playerName: 'Pioneer',
			} satisfies CharacterDeleteResponse);

			expect(component.errorMessage()).toBe('Character cannot be deleted.');
			expect(component.pendingDeleteCharacter()).toEqual({ id: '1', characterName: 'Nova' });
			expect(component.isDeleting()).toBe(false);
		});

		it('should allow cancel after failed delete response', () => {
			component.requestDeleteCharacter({ id: '1', characterName: 'Nova' });
			component.confirmDeleteCharacter();
			socketService.triggerEvent(CHARACTER_DELETE_RESPONSE_EVENT, {
				success: false,
				message: 'Character cannot be deleted.',
				playerName: 'Pioneer',
			} satisfies CharacterDeleteResponse);
			component.cancelDeleteCharacter();

			expect(component.pendingDeleteCharacter()).toBeNull();
		});
	});

	describe('invalid session handling', () => {
		it('should clear session and navigate to login on invalid-session event', () => {
			expect(sessionService.hasSession()).toBe(true);

			socketService.triggerEvent(INVALID_SESSION_EVENT, { message: 'Session expired.' });

			expect(sessionService.hasSession()).toBe(false);
			expect(router.navigate).toHaveBeenCalledWith(
				[{ outlets: { left: ['login'] } }],
				{ preserveFragment: true },
			);
		});
	});

	describe('ngOnDestroy()', () => {
		it('should unsubscribe all listeners on destroy', () => {
			expect(socketService.registeredListeners.has(INVALID_SESSION_EVENT)).toBe(true);

			component.ngOnDestroy();

			expect(socketService.registeredListeners.has(INVALID_SESSION_EVENT)).toBe(false);
		});
	});
});
