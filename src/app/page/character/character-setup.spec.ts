/**
 * Unit tests for CharacterSetupPage component
 *
 * Uses direct logic testing with a mock component pattern consistent with
 * existing page specs in this project.
 */

import {
	CHARACTER_ADD_REQUEST_EVENT,
	CHARACTER_ADD_RESPONSE_EVENT,
	CharacterAddRequest,
	CharacterAddResponse,
} from '../../model/character-add';
import {
	CHARACTER_EDIT_REQUEST_EVENT,
	CHARACTER_EDIT_RESPONSE_EVENT,
	CharacterEditResponse,
} from '../../model/character-edit';
import { INVALID_SESSION_EVENT } from '../../model/session';

function createSignal<T>(initial: T) {
	let value = initial;
	const sig = () => value;
	sig.set = (v: T) => {
		value = v;
	};
	return sig;
}

interface MockRouter {
	navigate: jasmine.Spy;
}

interface MockSessionService {
	storedKey: string | null;
	setSessionKey(key: string): void;
	getSessionKey(): string | null;
	clearSession(): void;
	hasSession(): boolean;
}

interface MockSocketService {
	emittedEvents: Array<{ event: string; data: any }>;
	registeredListeners: Map<string, (data: any) => void>;
	emit(event: string, data?: any): void;
	on(event: string, cb: (data: any) => void): () => void;
	triggerEvent(event: string, data: any): void;
}

interface SetupState {
	playerName?: string;
	mode?: 'create' | 'edit';
	editCharacter?: { id: string; characterName: string; level?: number };
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

class MockCharacterSetupPage {
	private router: MockRouter;
	private socketService: MockSocketService;
	private sessionService: MockSessionService;
	private unsubscribeAddResponse?: () => void;
	private unsubscribeInvalidSession?: () => void;
	private editCharacterId: string | null = null;

	playerName = createSignal<string>('Pioneer');
	isEditMode = createSignal(false);
	isSaved = createSignal(false);
	successMessage = createSignal<string | null>(null);
	errorMessage = createSignal<string | null>(null);
	isSubmitting = createSignal(false);

	characterForm = {
		characterName: 'Pioneer',
		invalid: false,
		touched: false,
		markAllAsTouched() {
			this.touched = true;
		},
		get value() {
			return { characterName: this.characterName };
		},
	};

	constructor(
		router: MockRouter,
		socketService: MockSocketService,
		sessionService: MockSessionService,
		setupState?: SetupState,
	) {
		this.router = router;
		this.socketService = socketService;
		this.sessionService = sessionService;

		if (setupState?.playerName !== undefined) {
			this.playerName.set(setupState.playerName);
		}

		if (setupState?.mode === 'edit' && setupState.editCharacter) {
			this.isEditMode.set(true);
			this.characterForm.characterName = setupState.editCharacter.characterName;
			this.editCharacterId = setupState.editCharacter.id;
		} else {
			this.characterForm.characterName = this.playerName();
		}

		this.unsubscribeInvalidSession = this.socketService.on(
			INVALID_SESSION_EVENT,
			() => {
				this.sessionService.clearSession();
				this.router.navigate([{ outlets: { left: ['login'] } }], { preserveFragment: true });
			},
		);
	}

	saveCharacter(): void {
		if (this.characterForm.invalid) {
			this.characterForm.markAllAsTouched();
			return;
		}

		const playerName = this.playerName().trim();
		const characterName = this.characterForm.value.characterName;

		if (!playerName) {
			this.errorMessage.set('Player name is required to save a character.');
			this.isSaved.set(false);
			return;
		}

		this.isSubmitting.set(true);
		this.errorMessage.set(null);
		this.successMessage.set(null);
		this.isSaved.set(false);
		this.unsubscribeAddResponse?.();

		const isEditMode = this.isEditMode();
		if (isEditMode && !this.editCharacterId) {
			this.isSubmitting.set(false);
			this.errorMessage.set('Character id is required to edit a character.');
			return;
		}

		const responseEventName = isEditMode ? CHARACTER_EDIT_RESPONSE_EVENT : CHARACTER_ADD_RESPONSE_EVENT;

		this.unsubscribeAddResponse = this.socketService.on(
			responseEventName,
			(response: CharacterAddResponse | CharacterEditResponse) => {
				this.isSubmitting.set(false);
				if (response.success) {
					this.isSaved.set(true);
					this.successMessage.set(response.message);
					this.errorMessage.set(null);
				} else {
					this.isSaved.set(false);
					this.successMessage.set(null);
					this.errorMessage.set(response.message);
				}
				this.unsubscribeAddResponse?.();
			},
		);

		if (isEditMode) {
			this.socketService.emit(CHARACTER_EDIT_REQUEST_EVENT, {
				characterId: this.editCharacterId!,
				playerName,
				characterName,
				sessionKey: this.sessionService.getSessionKey()!,
			});
			return;
		}

		const request: CharacterAddRequest = { playerName, characterName, sessionKey: this.sessionService.getSessionKey()! };
		this.socketService.emit(CHARACTER_ADD_REQUEST_EVENT, request);
	}

	navigateToCharacterList(): void {
		const playerName = this.playerName() || this.characterForm.value.characterName || '';
		this.router.navigate([{ outlets: { left: ['character-list'] } }], {
			preserveFragment: true,
			state: { playerName },
		});
	}

	ngOnDestroy(): void {
		this.unsubscribeAddResponse?.();
		this.unsubscribeInvalidSession?.();
	}
}

describe('CharacterSetupPage', () => {
	let component: MockCharacterSetupPage;
	let router: MockRouter;
	let socketService: MockSocketService;
	let sessionService: MockSessionService;

	beforeEach(() => {
		router = { navigate: jasmine.createSpy() };
		socketService = createMockSocketService();
		sessionService = createMockSessionService('test-session-key');
		component = new MockCharacterSetupPage(router, socketService, sessionService);
	});

	afterEach(() => {
		component.ngOnDestroy();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should initialize with a playerName value', () => {
		expect(component.playerName()).toBe('Pioneer');
	});

	it('should initialize form in edit mode using selected character name', () => {
		const editModeComponent = new MockCharacterSetupPage(
			router,
			socketService,
			sessionService,
			{
				playerName: 'Pioneer',
				mode: 'edit',
				editCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
			},
		);

		expect(editModeComponent.isEditMode()).toBe(true);
		expect(editModeComponent.characterForm.characterName).toBe('Nova-Prime');
		expect(editModeComponent.playerName()).toBe('Pioneer');

		editModeComponent.ngOnDestroy();
	});

	it('should initialize with unsaved and idle state', () => {
		expect(component.isSaved()).toBe(false);
		expect(component.successMessage()).toBeNull();
		expect(component.errorMessage()).toBeNull();
		expect(component.isSubmitting()).toBe(false);
	});

	describe('saveCharacter()', () => {
		it('should mark form touched and not emit when invalid', () => {
			component.characterForm.invalid = true;
			component.saveCharacter();

			expect(component.characterForm.touched).toBe(true);
			expect(component.isSaved()).toBe(false);
			expect(component.successMessage()).toBeNull();
			expect(socketService.emittedEvents).toBeDefined(); if (socketService.emittedEvents) { expect(socketService.emittedEvents.length).toBe(0) };
		});

		it('should set error when playerName is missing', () => {
			component.playerName.set('');
			component.characterForm.invalid = false;
			component.characterForm.characterName = 'Nova';
			component.saveCharacter();

			expect(component.errorMessage()).toBe('Player name is required to save a character.');
			expect(component.isSaved()).toBe(false);
			expect(socketService.emittedEvents).toBeDefined(); if (socketService.emittedEvents) { expect(socketService.emittedEvents.length).toBe(0) };
		});

		it('should emit save request in edit mode with updated character name', () => {
			const editModeComponent = new MockCharacterSetupPage(
				router,
				socketService,
				sessionService,
				{
					playerName: 'Pioneer',
					mode: 'edit',
					editCharacter: { id: 'c-1', characterName: 'Nova' },
				},
			);
			editModeComponent.characterForm.invalid = false;
			editModeComponent.characterForm.characterName = 'Nova-Prime';
			editModeComponent.saveCharacter();

			expect(editModeComponent.isEditMode()).toBe(true);
			expect(socketService.emittedEvents[socketService.emittedEvents.length - 1]).toEqual({
				event: CHARACTER_EDIT_REQUEST_EVENT,
				data: {
					characterId: 'c-1',
					playerName: 'Pioneer',
					characterName: 'Nova-Prime',
					sessionKey: 'test-session-key',
				},
			});

			editModeComponent.ngOnDestroy();
		});

		it('should handle successful character-edit response in edit mode', () => {
			const editModeComponent = new MockCharacterSetupPage(
				router,
				socketService,
				sessionService,
				{
					playerName: 'Pioneer',
					mode: 'edit',
					editCharacter: { id: 'c-1', characterName: 'Nova' },
				},
			);

			editModeComponent.characterForm.invalid = false;
			editModeComponent.characterForm.characterName = 'Nova-Prime';
			editModeComponent.saveCharacter();

			socketService.triggerEvent(CHARACTER_EDIT_RESPONSE_EVENT, {
				success: true,
				message: "Character 'Nova-Prime' updated.",
				playerName: 'Pioneer',
				characterId: 'c-1',
				characterName: 'Nova-Prime',
			} satisfies CharacterEditResponse);

			expect(editModeComponent.isSubmitting()).toBe(false);
			expect(editModeComponent.isSaved()).toBe(true);
			expect(editModeComponent.successMessage()).toBe("Character 'Nova-Prime' updated.");
			expect(editModeComponent.errorMessage()).toBeNull();

			editModeComponent.ngOnDestroy();
		});

		it('should emit character-add request when valid', () => {
			component.characterForm.invalid = false;
			component.characterForm.characterName = 'Nova-Prime';
			component.saveCharacter();

			expect(socketService.emittedEvents).toBeDefined(); if (socketService.emittedEvents) { expect(socketService.emittedEvents.length).toBe(1) };
			expect(socketService.emittedEvents[0].event).toBe(CHARACTER_ADD_REQUEST_EVENT);
				expect(socketService.emittedEvents[0].data).toEqual({
				playerName: 'Pioneer',
				characterName: 'Nova-Prime',
				sessionKey: 'test-session-key',
			});
			expect(component.isSubmitting()).toBe(true);
		});

		it('should handle successful character-add response', () => {
			component.characterForm.invalid = false;
			component.characterForm.characterName = 'Nova-Prime';
			component.saveCharacter();

			socketService.triggerEvent(CHARACTER_ADD_RESPONSE_EVENT, {
				success: true,
				message: "Character 'Nova-Prime' created.",
				playerName: 'Pioneer',
				characterName: 'Nova-Prime',
				characterId: 'c-1',
			} satisfies CharacterAddResponse);

			expect(component.isSubmitting()).toBe(false);
			expect(component.isSaved()).toBe(true);
			expect(component.successMessage()).toBe("Character 'Nova-Prime' created.");
			expect(component.errorMessage()).toBeNull();
		});

		it('should handle failed character-add response', () => {
			component.characterForm.invalid = false;
			component.characterForm.characterName = 'Nova-Prime';
			component.saveCharacter();

			socketService.triggerEvent(CHARACTER_ADD_RESPONSE_EVENT, {
				success: false,
				message: 'Character name already exists.',
				playerName: 'Pioneer',
			} satisfies CharacterAddResponse);

			expect(component.isSubmitting()).toBe(false);
			expect(component.isSaved()).toBe(false);
			expect(component.successMessage()).toBeNull();
			expect(component.errorMessage()).toBe('Character name already exists.');
		});

		it('should clear previous messages before a new request', () => {
			component.errorMessage.set('Old error');
			component.successMessage.set('Old success');
			component.characterForm.invalid = false;
			component.characterForm.characterName = 'Atlas';
			component.saveCharacter();

			expect(component.errorMessage()).toBeNull();
			expect(component.successMessage()).toBeNull();
		});
	});

	describe('navigateToCharacterList()', () => {
		it('should navigate to character-list with playerName from login context', () => {
			component.playerName.set('Pioneer');
			component.navigateToCharacterList();

			expect(router.navigate).toHaveBeenCalledWith(
				[{ outlets: { left: ['character-list'] } }],
				{ preserveFragment: true, state: { playerName: 'Pioneer' } },
			);
		});

		it('should fallback to character name when playerName is empty', () => {
			component.playerName.set('');
			component.characterForm.characterName = 'Nova';
			component.navigateToCharacterList();

			expect(router.navigate).toHaveBeenCalledWith(
				[{ outlets: { left: ['character-list'] } }],
				{ preserveFragment: true, state: { playerName: 'Nova' } },
			);
		});
	});

	describe('ngOnDestroy()', () => {
		it('should unsubscribe add-response listener on destroy', () => {
			component.characterForm.invalid = false;
			component.characterForm.characterName = 'Nova';
			component.saveCharacter();
			expect(socketService.registeredListeners.has(CHARACTER_ADD_RESPONSE_EVENT)).toBe(true);

			component.ngOnDestroy();
			expect(socketService.registeredListeners.has(CHARACTER_ADD_RESPONSE_EVENT)).toBe(false);
		});

		it('should unsubscribe invalid-session listener on destroy', () => {
			expect(socketService.registeredListeners.has(INVALID_SESSION_EVENT)).toBe(true);

			component.ngOnDestroy();
			expect(socketService.registeredListeners.has(INVALID_SESSION_EVENT)).toBe(false);
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
});
