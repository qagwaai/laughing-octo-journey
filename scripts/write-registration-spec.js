const fs = require('fs');
const spec = `import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';

import RegistrationPage from './registration';
import { SocketService } from '../../services/socket.service';
import { SessionService } from '../../services/session.service';
import { REGISTER_EVENT, REGISTER_RESPONSE_EVENT } from '../../model/register';
import type { RegisterResponse } from '../../model/register';
import {
	createMockSocketService,
	type MockSocketService,
	createMockSessionService,
	type MockSessionService,
} from '../../../testing';

function setup(options: {
	socketService: MockSocketService;
	sessionService: MockSessionService;
	navigationState?: Record<string, unknown>;
}) {
	const mockRouter = {
		getCurrentNavigation: () =>
			options.navigationState ? { extras: { state: options.navigationState } } : null,
		navigate: jasmine.createSpy('navigate'),
	};

	TestBed.configureTestingModule({
		imports: [RegistrationPage, ReactiveFormsModule],
		providers: [
			{ provide: SocketService, useValue: options.socketService },
			{ provide: SessionService, useValue: options.sessionService },
			{ provide: Router, useValue: mockRouter },
		],
		schemas: [CUSTOM_ELEMENTS_SCHEMA],
	});

	const fixture = TestBed.createComponent(RegistrationPage);
	fixture.detectChanges();
	return { component: fixture.componentInstance, fixture, mockRouter };
}

function fillValidForm(component: RegistrationPage) {
	component['registrationForm'].patchValue({
		playerName: 'Pioneer',
		email: 'pioneer@stellar.com',
		password: 'password123',
		confirmPassword: 'password123',
	});
}

describe('RegistrationPage', () => {
	let socketService: MockSocketService;
	let sessionService: MockSessionService;

	beforeEach(() => {
		socketService = createMockSocketService();
		sessionService = createMockSessionService();
	});

	it('should create', () => {
		const { component } = setup({ socketService, sessionService });
		expect(component).toBeTruthy();
	});

	it('should initialise with no messages and not submitting', () => {
		const { component } = setup({ socketService, sessionService });
		expect(component['isSubmitting']()).toBe(false);
		expect(component['successMessage']()).toBeNull();
		expect(component['errorMessage']()).toBeNull();
	});

	describe('submit()', () => {
		it('should mark form touched and not emit when form is invalid', () => {
			const { component } = setup({ socketService, sessionService });
			component.submit();
			expect(component['registrationForm'].touched).toBe(true);
			expect(socketService.emittedEvents.length).toBe(0);
		});

		it('should set isSubmitting to true after submission', () => {
			const { component } = setup({ socketService, sessionService });
			fillValidForm(component);
			component.submit();
			expect(component['isSubmitting']()).toBe(true);
		});

		it(\`should emit '\${REGISTER_EVENT}' with correct payload\`, () => {
			const { component } = setup({ socketService, sessionService });
			component['registrationForm'].patchValue({
				locale: 'it',
				playerName: '  Pioneer  ',
				email: '  pioneer@stellar.com  ',
				password: 'password123',
				confirmPassword: 'password123',
			});
			component.submit();

			expect(socketService.emittedEvents.length).toBe(1);
			expect(socketService.emittedEvents[0].event).toBe(REGISTER_EVENT);
			expect(socketService.emittedEvents[0].data).toEqual({
				locale: 'it',
				playerName: 'Pioneer',
				email: 'pioneer@stellar.com',
				password: 'password123',
			});
		});

		it('should reject whitespace-only player name', () => {
			const { component } = setup({ socketService, sessionService });
			component['registrationForm'].patchValue({
				playerName: '   ',
				email: 'pioneer@stellar.com',
				password: 'password123',
				confirmPassword: 'password123',
			});
			component.submit();
			expect(socketService.emittedEvents.length).toBe(0);
		});

		it(\`should register a listener for '\${REGISTER_RESPONSE_EVENT}'\`, () => {
			const { component } = setup({ socketService, sessionService });
			fillValidForm(component);
			component.submit();
			expect(socketService.registeredListeners.has(REGISTER_RESPONSE_EVENT)).toBe(true);
		});

		it('should clear previous messages on re-submit', () => {
			const { component } = setup({ socketService, sessionService });
			component['errorMessage'].set('Previous error');
			component['successMessage'].set('Previous success');
			fillValidForm(component);
			component.submit();
			expect(component['errorMessage']()).toBeNull();
			expect(component['successMessage']()).toBeNull();
		});
	});

	describe('register-response handling', () => {
		function submitForm(component: RegistrationPage) {
			fillValidForm(component);
			component.submit();
		}

		it('should set successMessage and reset form on success response', () => {
			const { component, mockRouter } = setup({ socketService, sessionService });
			submitForm(component);
			socketService.triggerEvent(REGISTER_RESPONSE_EVENT, {
				success: true,
				message: 'Registration successful!',
				playerId: 'abc-123',
				sessionKey: 'session-abc-123',
			} satisfies RegisterResponse);

			expect(component['successMessage']()).toBe('Registration successful!');
			expect(component['errorMessage']()).toBeNull();
			expect(component['isSubmitting']()).toBe(false);
			expect(component['registrationForm'].value.playerName).toBeFalsy();
			expect(mockRouter.navigate).toHaveBeenCalledWith(
				[{ outlets: { left: ['character-list'] } }],
				{ preserveFragment: true, state: { playerName: 'Pioneer' } },
			);
		});

		it('should store the session key returned from registration', () => {
			const { component } = setup({ socketService, sessionService });
			submitForm(component);
			socketService.triggerEvent(REGISTER_RESPONSE_EVENT, {
				success: true,
				message: 'Registration successful!',
				sessionKey: 'session-reg-456',
			} satisfies RegisterResponse);

			expect(sessionService.storedKey).toBe('session-reg-456');
			expect(sessionService.hasSession()).toBe(true);
		});

		it('should not call setSessionKey when sessionKey is absent', () => {
			const { component } = setup({ socketService, sessionService });
			submitForm(component);
			socketService.triggerEvent(REGISTER_RESPONSE_EVENT, {
				success: true,
				message: 'Registration successful!',
			} satisfies RegisterResponse);

			expect(sessionService.storedKey).toBeNull();
		});

		it('should set errorMessage on failure response', () => {
			const { component } = setup({ socketService, sessionService });
			submitForm(component);
			socketService.triggerEvent(REGISTER_RESPONSE_EVENT, {
				success: false,
				message: 'Player name already taken.',
			} satisfies RegisterResponse);

			expect(component['errorMessage']()).toBe('Player name already taken.');
			expect(component['successMessage']()).toBeNull();
			expect(component['isSubmitting']()).toBe(false);
		});

		it('should unsubscribe the response listener after handling a response', () => {
			const { component } = setup({ socketService, sessionService });
			submitForm(component);
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
			const { component, fixture } = setup({ socketService, sessionService });
			fillValidForm(component);
			component.submit();
			expect(socketService.registeredListeners.has(REGISTER_RESPONSE_EVENT)).toBe(true);

			fixture.destroy();
			expect(socketService.registeredListeners.has(REGISTER_RESPONSE_EVENT)).toBe(false);
		});

		it('should not throw when destroyed without a pending submission', () => {
			const { fixture } = setup({ socketService, sessionService });
			expect(() => fixture.destroy()).not.toThrow();
		});
	});

	describe('navigation', () => {
		it('should expose navigateToLogin method', () => {
			const { component } = setup({ socketService, sessionService });
			expect(typeof component.navigateToLogin).toBe('function');
		});

		it('should navigate to login in left outlet', () => {
			const { component, mockRouter } = setup({ socketService, sessionService });
			component['registrationForm'].patchValue({ locale: 'it' });
			component.navigateToLogin();

			expect(mockRouter.navigate).toHaveBeenCalledWith(
				[{ outlets: { left: ['login'] } }],
				{ preserveFragment: true, state: { preferredLocale: 'it' } },
			);
		});
	});

	describe('DOM smoke tests', () => {
		it('should render without error', () => {
			const { fixture } = setup({ socketService, sessionService });
			fixture.detectChanges();
			expect(fixture.nativeElement).toBeTruthy();
		});
	});
});

describe('passwordMatchValidator', () => {
	function makeGroup(password: string, confirmPassword: string) {
		return {
			get: (key: string) => ({
				value: key === 'password' ? password : confirmPassword,
			}),
		} as any;
	}

	it('should return null when passwords match', () => {
		// This is tested implicitly via the form — the validator is embedded in the real component.
		// We test it via form state: valid form means validator passed.
		const socketService = createMockSocketService();
		const sessionService = createMockSessionService();
		const mockRouter = { getCurrentNavigation: () => null, navigate: jasmine.createSpy() };
		TestBed.configureTestingModule({
			imports: [RegistrationPage, ReactiveFormsModule],
			providers: [
				{ provide: SocketService, useValue: socketService },
				{ provide: SessionService, useValue: sessionService },
				{ provide: Router, useValue: mockRouter },
			],
			schemas: [CUSTOM_ELEMENTS_SCHEMA],
		});
		const fixture = TestBed.createComponent(RegistrationPage);
		fixture.detectChanges();
		const component = fixture.componentInstance;
		component['registrationForm'].patchValue({ playerName: 'Pioneer', email: 'a@b.com', password: 'secret123', confirmPassword: 'secret123' });
		expect(component['registrationForm'].errors).toBeNull();
	});

	it('should return { passwordMismatch: true } when passwords differ', () => {
		const socketService = createMockSocketService();
		const sessionService = createMockSessionService();
		const mockRouter = { getCurrentNavigation: () => null, navigate: jasmine.createSpy() };
		TestBed.configureTestingModule({
			imports: [RegistrationPage, ReactiveFormsModule],
			providers: [
				{ provide: SocketService, useValue: socketService },
				{ provide: SessionService, useValue: sessionService },
				{ provide: Router, useValue: mockRouter },
			],
			schemas: [CUSTOM_ELEMENTS_SCHEMA],
		});
		const fixture = TestBed.createComponent(RegistrationPage);
		fixture.detectChanges();
		const component = fixture.componentInstance;
		component['registrationForm'].patchValue({ playerName: 'Pioneer', email: 'a@b.com', password: 'secret123', confirmPassword: 'wrong' });
		expect(component['registrationForm'].errors).toEqual({ passwordMismatch: true });
	});

	it('should return null when both values are empty', () => {
		const socketService = createMockSocketService();
		const sessionService = createMockSessionService();
		const mockRouter = { getCurrentNavigation: () => null, navigate: jasmine.createSpy() };
		TestBed.configureTestingModule({
			imports: [RegistrationPage, ReactiveFormsModule],
			providers: [
				{ provide: SocketService, useValue: socketService },
				{ provide: SessionService, useValue: sessionService },
				{ provide: Router, useValue: mockRouter },
			],
			schemas: [CUSTOM_ELEMENTS_SCHEMA],
		});
		const fixture = TestBed.createComponent(RegistrationPage);
		fixture.detectChanges();
		const component = fixture.componentInstance;
		// Default form state: both password fields are empty — no mismatch error
		expect(component['registrationForm'].errors).toBeNull();
	});
});
`;
fs.writeFileSync('src/app/page/public/registration.spec.ts', spec);
console.log('done', spec.split('\n').length, 'lines');
