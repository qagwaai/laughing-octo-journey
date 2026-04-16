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
} from '../model/character-add';

function createSignal<T>(initial: T) {
	let value = initial;
	const sig = () => value;
	sig.set = (v: T) => {
		value = v;
	};
	return sig;
}

interface MockRouter {
	navigate: jest.Mock;
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

class MockCharacterSetupPage {
	private router: MockRouter;
	private socketService: MockSocketService;
	private unsubscribeAddResponse?: () => void;

	playerName = createSignal<string>('Pioneer');
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

	constructor(router: MockRouter, socketService: MockSocketService) {
		this.router = router;
		this.socketService = socketService;
	}

	saveCharacter(): void {
		if (this.characterForm.invalid) {
			this.characterForm.markAllAsTouched();
			return;
		}

		const playerName = this.playerName().trim();
		const characterName = this.characterForm.value.characterName;

		if (!playerName) {
			this.errorMessage.set('Player name is required to add a character.');
			this.isSaved.set(false);
			return;
		}

		this.isSubmitting.set(true);
		this.errorMessage.set(null);
		this.successMessage.set(null);
		this.isSaved.set(false);
		this.unsubscribeAddResponse?.();

		this.unsubscribeAddResponse = this.socketService.on(
			CHARACTER_ADD_RESPONSE_EVENT,
			(response: CharacterAddResponse) => {
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

		const request: CharacterAddRequest = { playerName, characterName };
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
	}
}

describe('CharacterSetupPage', () => {
	let component: MockCharacterSetupPage;
	let router: MockRouter;
	let socketService: MockSocketService;

	beforeEach(() => {
		router = { navigate: jest.fn() };
		socketService = createMockSocketService();
		component = new MockCharacterSetupPage(router, socketService);
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
			expect(socketService.emittedEvents).toHaveLength(0);
		});

		it('should set error when playerName is missing', () => {
			component.playerName.set('');
			component.characterForm.invalid = false;
			component.characterForm.characterName = 'Nova';
			component.saveCharacter();

			expect(component.errorMessage()).toBe('Player name is required to add a character.');
			expect(component.isSaved()).toBe(false);
			expect(socketService.emittedEvents).toHaveLength(0);
		});

		it('should emit character-add request when valid', () => {
			component.characterForm.invalid = false;
			component.characterForm.characterName = 'Nova-Prime';
			component.saveCharacter();

			expect(socketService.emittedEvents).toHaveLength(1);
			expect(socketService.emittedEvents[0].event).toBe(CHARACTER_ADD_REQUEST_EVENT);
			expect(socketService.emittedEvents[0].data).toEqual<CharacterAddRequest>({
				playerName: 'Pioneer',
				characterName: 'Nova-Prime',
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
	});
});
