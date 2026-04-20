import { LOGIN_EVENT, LOGIN_RESPONSE_EVENT, LoginRequest, LoginResponse } from '../../model/login';

/**
 * Unit tests for LoginPage component
 *
 * Uses direct logic testing with a mock component pattern consistent with
 * current project tests.
 */

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

function createMockSessionService(): MockSessionService {
	const state = { key: null as string | null };
	return {
		get storedKey() { return state.key; },
		setSessionKey(key: string) { state.key = key; },
		getSessionKey() { return state.key; },
		clearSession() { state.key = null; },
		hasSession() { return state.key !== null; },
	};
}

class MockLoginPage {
	private socketService: MockSocketService;
	private router: MockRouter;
	private sessionService: MockSessionService;
	private unsubscribeResponse?: () => void;

	loginForm = {
		playerName: '',
		password: '',
		invalid: false,
		touched: false,
		markAllAsTouched() {
			this.touched = true;
		},
		get value() {
			return {
				playerName: this.playerName,
				password: this.password,
			};
		},
	};

	isSubmitting = createSignal(false);
	successMessage = createSignal<string | null>(null);
	errorMessage = createSignal<string | null>(null);
	canNavigateToRegister = createSignal(false);

	constructor(socketService: MockSocketService, router: MockRouter, sessionService: MockSessionService) {
		this.socketService = socketService;
		this.router = router;
		this.sessionService = sessionService;
	}

	submit(): void {
		if (this.loginForm.invalid) {
			this.loginForm.markAllAsTouched();
			return;
		}

		const { playerName, password } = this.loginForm.value;
		const normalizedPlayerName = playerName?.trim() ?? '';
		const normalizedPassword = password ?? '';

		if (!normalizedPlayerName || !normalizedPassword) {
			this.loginForm.markAllAsTouched();
			this.errorMessage.set('Player name and password are required.');
			this.canNavigateToRegister.set(false);
			return;
		}

		const request: LoginRequest = {
			playerName: normalizedPlayerName,
			password: normalizedPassword,
		};

		this.isSubmitting.set(true);
		this.successMessage.set(null);
		this.errorMessage.set(null);
		this.canNavigateToRegister.set(false);

		this.unsubscribeResponse = this.socketService.on(
			LOGIN_RESPONSE_EVENT,
			(response: LoginResponse) => {
				this.isSubmitting.set(false);
				if (response.success) {
					if (response.sessionKey) {
						this.sessionService.setSessionKey(response.sessionKey);
					}
					this.successMessage.set(response.message);
					this.canNavigateToRegister.set(false);
					this.router.navigate([{ outlets: { left: ['character-list'] } }], {
						preserveFragment: true,
						state: { playerName: request.playerName },
					});
					this.unsubscribeResponse?.();
					return;
				}

				if (response.reason === 'PLAYER_NOT_REGISTERED') {
					this.errorMessage.set('Player name is not registered. Please register first.');
					this.canNavigateToRegister.set(true);
				} else if (response.reason === 'PASSWORD_MISMATCH') {
					this.errorMessage.set('Password does not match the player name.');
					this.canNavigateToRegister.set(false);
				} else {
					this.errorMessage.set(response.message);
					this.canNavigateToRegister.set(false);
				}
				this.unsubscribeResponse?.();
			},
		);

		this.socketService.emit(LOGIN_EVENT, request);
	}

	navigateToRegistration(): void {
		this.router.navigate([{ outlets: { left: ['registration'] } }], { preserveFragment: true });
	}

	ngOnDestroy(): void {
		this.unsubscribeResponse?.();
	}
}

describe('LoginPage', () => {
	let component: MockLoginPage;
	let socketService: MockSocketService;
	let router: MockRouter;
	let sessionService: MockSessionService;

	beforeEach(() => {
		socketService = createMockSocketService();
		router = {
			navigate: jasmine.createSpy(),
		};
		sessionService = createMockSessionService();
		component = new MockLoginPage(socketService, router, sessionService);
	});

	afterEach(() => {
		component.ngOnDestroy();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should initialise with no messages and not submitting', () => {
		expect(component.isSubmitting()).toBe(false);
		expect(component.successMessage()).toBeNull();
		expect(component.errorMessage()).toBeNull();
		expect(component.canNavigateToRegister()).toBe(false);
	});

	describe('submit()', () => {
		it('should mark form touched and not emit when form is invalid', () => {
			component.loginForm.invalid = true;
			component.submit();
			expect(component.loginForm.touched).toBe(true);
			expect(socketService.emittedEvents).toBeDefined(); if (socketService.emittedEvents) { expect(socketService.emittedEvents.length).toBe(0) };
		});

		it(`should emit '${LOGIN_EVENT}' with correct payload`, () => {
			component.loginForm.invalid = false;
			component.loginForm.playerName = '  Pioneer  ';
			component.loginForm.password = 'password123';
			component.submit();

			expect(socketService.emittedEvents).toBeDefined(); if (socketService.emittedEvents) { expect(socketService.emittedEvents.length).toBe(1) };
			expect(socketService.emittedEvents[0].event).toBe(LOGIN_EVENT);
			expect(socketService.emittedEvents[0].data).toEqual({
				playerName: 'Pioneer',
				password: 'password123',
			});
		});

		it('should reject whitespace-only player name', () => {
			component.loginForm.invalid = false;
			component.loginForm.playerName = '   ';
			component.loginForm.password = 'password123';
			component.submit();

			expect(component.loginForm.touched).toBe(true);
			expect(component.errorMessage()).toBe('Player name and password are required.');
			expect(socketService.emittedEvents.length).toBe(0);
		});

		it(`should register a listener for '${LOGIN_RESPONSE_EVENT}'`, () => {
			component.loginForm.invalid = false;
			component.loginForm.playerName = 'Pioneer';
			component.loginForm.password = 'password123';
			component.submit();
			expect(socketService.registeredListeners.has(LOGIN_RESPONSE_EVENT)).toBe(true);
		});
	});

	describe('login-response handling', () => {
		function submitForm() {
			component.loginForm.invalid = false;
			component.loginForm.playerName = 'Pioneer';
			component.loginForm.password = 'password123';
			component.submit();
		}

		it('should set successMessage on successful login', () => {
			submitForm();
			socketService.triggerEvent(LOGIN_RESPONSE_EVENT, {
				success: true,
				message: 'Login successful.',
				playerId: 'abc-123',
				sessionKey: 'session-abc-123',
			} satisfies LoginResponse);

			expect(component.successMessage()).toBe('Login successful.');
			expect(component.errorMessage()).toBeNull();
			expect(component.isSubmitting()).toBe(false);
			expect(router.navigate).toHaveBeenCalledWith(
				[{ outlets: { left: ['character-list'] } }],
				{ preserveFragment: true, state: { playerName: 'Pioneer' } },
			);
		});

		it('should store the session key returned from login', () => {
			submitForm();
			socketService.triggerEvent(LOGIN_RESPONSE_EVENT, {
				success: true,
				message: 'Login successful.',
				sessionKey: 'session-xyz-789',
			} satisfies LoginResponse);

			expect(sessionService.storedKey).toBe('session-xyz-789');
			expect(sessionService.hasSession()).toBe(true);
		});

		it('should not call setSessionKey when sessionKey is absent', () => {
			submitForm();
			socketService.triggerEvent(LOGIN_RESPONSE_EVENT, {
				success: true,
				message: 'Login successful.',
			} satisfies LoginResponse);

			expect(sessionService.storedKey).toBeNull();
		});

		it('should handle unregistered player name failure', () => {
			submitForm();
			socketService.triggerEvent(LOGIN_RESPONSE_EVENT, {
				success: false,
				message: 'No such player.',
				reason: 'PLAYER_NOT_REGISTERED',
			} satisfies LoginResponse);

			expect(component.errorMessage()).toBe('Player name is not registered. Please register first.');
			expect(component.successMessage()).toBeNull();
			expect(component.isSubmitting()).toBe(false);
			expect(component.canNavigateToRegister()).toBe(true);
		});

		it('should handle password mismatch failure', () => {
			submitForm();
			socketService.triggerEvent(LOGIN_RESPONSE_EVENT, {
				success: false,
				message: 'Wrong password.',
				reason: 'PASSWORD_MISMATCH',
			} satisfies LoginResponse);

			expect(component.errorMessage()).toBe('Password does not match the player name.');
			expect(component.successMessage()).toBeNull();
			expect(component.isSubmitting()).toBe(false);
			expect(component.canNavigateToRegister()).toBe(false);
		});

		it('should fallback to response message for unknown errors', () => {
			submitForm();
			socketService.triggerEvent(LOGIN_RESPONSE_EVENT, {
				success: false,
				message: 'Service unavailable.',
				reason: 'UNKNOWN',
			} satisfies LoginResponse);

			expect(component.errorMessage()).toBe('Service unavailable.');
			expect(component.canNavigateToRegister()).toBe(false);
		});

		it('should clear register navigation state on successful login', () => {
			submitForm();
			socketService.triggerEvent(LOGIN_RESPONSE_EVENT, {
				success: false,
				message: 'No such player.',
				reason: 'PLAYER_NOT_REGISTERED',
			} satisfies LoginResponse);

			expect(component.canNavigateToRegister()).toBe(true);

			submitForm();
			socketService.triggerEvent(LOGIN_RESPONSE_EVENT, {
				success: true,
				message: 'Login successful.',
				sessionKey: 'session-abc-123',
			} satisfies LoginResponse);

			expect(component.canNavigateToRegister()).toBe(false);
		});

		it('should unsubscribe listener after handling a response', () => {
			submitForm();
			socketService.triggerEvent(LOGIN_RESPONSE_EVENT, {
				success: true,
				message: 'Login successful.',
				sessionKey: 'session-abc-123',
			} satisfies LoginResponse);

			expect(socketService.registeredListeners.has(LOGIN_RESPONSE_EVENT)).toBe(false);
		});
	});

	describe('ngOnDestroy()', () => {
		it('should unsubscribe response listener on destroy', () => {
			component.loginForm.invalid = false;
			component.loginForm.playerName = 'Pioneer';
			component.loginForm.password = 'password123';
			component.submit();
			expect(socketService.registeredListeners.has(LOGIN_RESPONSE_EVENT)).toBe(true);

			component.ngOnDestroy();
			expect(socketService.registeredListeners.has(LOGIN_RESPONSE_EVENT)).toBe(false);
		});
	});

	describe('navigation', () => {
		it('should navigate to registration in left outlet', () => {
			component.navigateToRegistration();

			expect(router.navigate).toHaveBeenCalledWith(
				[{ outlets: { left: ['registration'] } }],
				{ preserveFragment: true },
			);
		});
	});
});
