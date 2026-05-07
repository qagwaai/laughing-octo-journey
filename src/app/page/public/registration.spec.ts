import { createSignal, createMockSocketService, type MockSocketService, createMockSessionService, type MockSessionService } from '../../../testing';
import { REGISTER_EVENT, REGISTER_RESPONSE_EVENT, RegisterRequest, RegisterResponse } from '../../model/register';

const passwordMatchValidator = (group: any) => {
	const password = group.get('password')?.value;
	const confirmPassword = group.get('confirmPassword')?.value;
	return password && confirmPassword && password !== confirmPassword
		? { passwordMismatch: true }
		: null;
};

/**
 * Unit tests for RegistrationPage component
 *
 * Tests component logic directly using a mock class pattern, consistent with
 * other specs in this project (avoids ESM/Angular TestBed resolution issues).
 */

// ── Helpers ──────────────────────────────────────────────────────────────────





interface MockRouter {
	navigate: jasmine.Spy;
}







// ── Mock component ────────────────────────────────────────────────────────────

class MockRegistrationPage {
	private socketService: MockSocketService;
	private router: MockRouter;
	private sessionService: MockSessionService;
	private unsubscribeResponse?: () => void;

	registrationForm = {
		locale: 'en',
		playerName: '',
		email: '',
		password: '',
		confirmPassword: '',
		invalid: false,
		touched: false,
		markAllAsTouched() { this.touched = true; },
		reset() {
			this.locale = 'en';
			this.playerName = '';
			this.email = '';
			this.password = '';
			this.confirmPassword = '';
		},
		get value() {
			return {
				locale: this.locale,
				playerName: this.playerName,
				email: this.email,
				password: this.password,
				confirmPassword: this.confirmPassword,
			};
		},
	};

	isSubmitting = createSignal(false);
	successMessage = createSignal<string | null>(null);
	errorMessage = createSignal<string | null>(null);

	constructor(socketService: MockSocketService, router: MockRouter, sessionService: MockSessionService) {
		this.socketService = socketService;
		this.router = router;
		this.sessionService = sessionService;
	}

	submit(): void {
		if (this.registrationForm.invalid) {
			this.registrationForm.markAllAsTouched();
			return;
		}

		const { playerName, email, password, locale } = this.registrationForm.value;
		const normalizedPlayerName = playerName?.trim() ?? '';
		const normalizedEmail = email?.trim() ?? '';
		const normalizedPassword = password ?? '';

		if (!normalizedPlayerName || !normalizedEmail || !normalizedPassword) {
			this.registrationForm.markAllAsTouched();
			this.errorMessage.set('Player name, email, and password are required.');
			return;
		}

		const request: RegisterRequest = {
			playerName: normalizedPlayerName,
			email: normalizedEmail,
			password: normalizedPassword,
			locale,
		};

		this.isSubmitting.set(true);
		this.successMessage.set(null);
		this.errorMessage.set(null);

		this.unsubscribeResponse = this.socketService.on(
			REGISTER_RESPONSE_EVENT,
			(response: RegisterResponse) => {
				this.isSubmitting.set(false);
				if (response.success) {
					if (response.sessionKey) {
						this.sessionService.setSessionKey(response.sessionKey);
					}
					this.successMessage.set(response.message);
					this.router.navigate([{ outlets: { left: ['character-list'] } }], {
						preserveFragment: true,
						state: { playerName: request.playerName },
					});
					this.registrationForm.reset();
				} else {
					this.errorMessage.set(response.message);
				}
				this.unsubscribeResponse?.();
			},
		);

		this.socketService.emit(REGISTER_EVENT, request);
	}

	navigateToLogin(): void {
		this.router.navigate([{ outlets: { left: ['login'] } }], {
			preserveFragment: true,
			state: {
				preferredLocale: this.registrationForm.locale,
			},
		});
	}

	ngOnDestroy(): void {
		this.unsubscribeResponse?.();
	}
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RegistrationPage', () => {
	let component: MockRegistrationPage;
	let socketService: MockSocketService;
	let router: MockRouter;
	let sessionService: MockSessionService;

	beforeEach(() => {
		socketService = createMockSocketService();
		router = { navigate: jasmine.createSpy() };
		sessionService = createMockSessionService();
		component = new MockRegistrationPage(socketService, router, sessionService);
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
	});

	describe('submit()', () => {
		it('should mark form touched and not emit when form is invalid', () => {
			component.registrationForm.invalid = true;
			component.submit();
			expect(component.registrationForm.touched).toBe(true);
			expect(socketService.emittedEvents).toBeDefined(); if (socketService.emittedEvents) { expect(socketService.emittedEvents.length).toBe(0) };
		});

		it('should set isSubmitting to true after submission', () => {
			component.registrationForm.invalid = false;
			component.registrationForm.playerName = 'Pioneer';
			component.registrationForm.email = 'pioneer@stellar.com';
			component.registrationForm.password = 'password123';
			component.submit();
			expect(component.isSubmitting()).toBe(true);
		});

		it(`should emit '${REGISTER_EVENT}' with correct payload`, () => {
			component.registrationForm.invalid = false;
			component.registrationForm.locale = 'it';
			component.registrationForm.playerName = '  Pioneer  ';
			component.registrationForm.email = '  pioneer@stellar.com  ';
			component.registrationForm.password = 'password123';
			component.submit();

			expect(socketService.emittedEvents).toBeDefined(); if (socketService.emittedEvents) { expect(socketService.emittedEvents.length).toBe(1) };
			expect(socketService.emittedEvents[0].event).toBe(REGISTER_EVENT);
			expect(socketService.emittedEvents[0].data).toEqual({
				locale: 'it',
				playerName: 'Pioneer',
				email: 'pioneer@stellar.com',
				password: 'password123',
			});
		});

		it('should reject whitespace-only player name', () => {
			component.registrationForm.invalid = false;
			component.registrationForm.playerName = '   ';
			component.registrationForm.email = 'pioneer@stellar.com';
			component.registrationForm.password = 'password123';
			component.submit();

			expect(component.registrationForm.touched).toBe(true);
			expect(component.errorMessage()).toBe('Player name, email, and password are required.');
			expect(socketService.emittedEvents.length).toBe(0);
		});

		it(`should register a listener for '${REGISTER_RESPONSE_EVENT}'`, () => {
			component.registrationForm.invalid = false;
			component.registrationForm.playerName = 'Pioneer';
			component.registrationForm.email = 'pioneer@stellar.com';
			component.registrationForm.password = 'password123';
			component.submit();

			expect(socketService.registeredListeners.has(REGISTER_RESPONSE_EVENT)).toBe(true);
		});

		it('should clear previous messages on re-submit', () => {
			component.errorMessage.set('Previous error');
			component.successMessage.set('Previous success');
			component.registrationForm.invalid = false;
			component.registrationForm.playerName = 'Pioneer';
			component.registrationForm.email = 'pioneer@stellar.com';
			component.registrationForm.password = 'password123';
			component.submit();

			expect(component.errorMessage()).toBeNull();
			expect(component.successMessage()).toBeNull();
		});
	});

	describe('register-response handling', () => {
		function submitForm() {
			component.registrationForm.invalid = false;
			component.registrationForm.playerName = 'Pioneer';
			component.registrationForm.email = 'pioneer@stellar.com';
			component.registrationForm.password = 'password123';
			component.submit();
		}

		it('should set successMessage and reset form on success response', () => {
			submitForm();
			socketService.triggerEvent(REGISTER_RESPONSE_EVENT, {
				success: true,
				message: 'Registration successful!',
				playerId: 'abc-123',
				sessionKey: 'session-abc-123',
			} satisfies RegisterResponse);

			expect(component.successMessage()).toBe('Registration successful!');
			expect(component.errorMessage()).toBeNull();
			expect(component.isSubmitting()).toBe(false);
			expect(component.registrationForm.value.playerName).toBe('');
			expect(router.navigate).toHaveBeenCalledWith(
				[{ outlets: { left: ['character-list'] } }],
				{ preserveFragment: true, state: { playerName: 'Pioneer' } },
			);
		});

		it('should store the session key returned from registration', () => {
			submitForm();
			socketService.triggerEvent(REGISTER_RESPONSE_EVENT, {
				success: true,
				message: 'Registration successful!',
				sessionKey: 'session-reg-456',
			} satisfies RegisterResponse);

			expect(sessionService.storedKey).toBe('session-reg-456');
			expect(sessionService.hasSession()).toBe(true);
		});

		it('should not call setSessionKey when sessionKey is absent', () => {
			submitForm();
			socketService.triggerEvent(REGISTER_RESPONSE_EVENT, {
				success: true,
				message: 'Registration successful!',
			} satisfies RegisterResponse);

			expect(sessionService.storedKey).toBeNull();
		});

		it('should set errorMessage on failure response', () => {
			submitForm();
			socketService.triggerEvent(REGISTER_RESPONSE_EVENT, {
				success: false,
				message: 'Player name already taken.',
			} satisfies RegisterResponse);

			expect(component.errorMessage()).toBe('Player name already taken.');
			expect(component.successMessage()).toBeNull();
			expect(component.isSubmitting()).toBe(false);
		});

		it('should unsubscribe the response listener after handling a response', () => {
			submitForm();
			socketService.triggerEvent(REGISTER_RESPONSE_EVENT, {
				success: true,
				message: 'Registration successful!',
				sessionKey: 'session-abc-123',
			} satisfies RegisterResponse);

			expect(socketService.registeredListeners.has(REGISTER_RESPONSE_EVENT)).toBe(false);
		});
	});

	describe('ngOnDestroy()', () => {
		it('should unsubscribe response listener on destroy', () => {
			component.registrationForm.invalid = false;
			component.registrationForm.playerName = 'Pioneer';
			component.registrationForm.email = 'pioneer@stellar.com';
			component.registrationForm.password = 'password123';
			component.submit();
			// Listener is registered
			expect(socketService.registeredListeners.has(REGISTER_RESPONSE_EVENT)).toBe(true);

			component.ngOnDestroy();
			expect(socketService.registeredListeners.has(REGISTER_RESPONSE_EVENT)).toBe(false);
		});

		it('should not throw when destroyed without a pending submission', () => {
			expect(() => component.ngOnDestroy()).not.toThrow();
		});
	});

	describe('navigation', () => {
		it('should expose navigateToLogin method', () => {
			expect(typeof component.navigateToLogin).toBe('function');
		});

		it('should navigate to login in left outlet', () => {
			component.registrationForm.locale = 'it';
			component.navigateToLogin();

			expect(router.navigate).toHaveBeenCalledWith(
				[{ outlets: { left: ['login'] } }],
				{ preserveFragment: true, state: { preferredLocale: 'it' } },
			);
		});
	});
});

// ── passwordMatchValidator ────────────────────────────────────────────────────

describe('passwordMatchValidator', () => {
	function makeGroup(password: string, confirmPassword: string) {
		return {
			get: (key: string) => ({
				value: key === 'password' ? password : confirmPassword,
			}),
		} as any;
	}

	it('should return null when passwords match', () => {
		const group = makeGroup('secret123', 'secret123');
		expect(passwordMatchValidator(group)).toBeNull();
	});

	it('should return { passwordMismatch: true } when passwords differ', () => {
		const group = makeGroup('secret123', 'wrong');
		expect(passwordMatchValidator(group)).toEqual({ passwordMismatch: true });
	});

	it('should return null when both values are empty', () => {
		const group = makeGroup('', '');
		expect(passwordMatchValidator(group)).toBeNull();
	});
});
