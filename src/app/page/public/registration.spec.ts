import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import {
  createMockSessionService,
  createMockSocketService,
  type MockSessionService,
  type MockSocketService,
} from '../../../testing';
import { setActiveLocaleCode } from '../../i18n/locale';
import { LOGIN_EVENT, LOGIN_RESPONSE_EVENT, type LoginResponse } from '../../model/login';
import { REMEMBERED_PLAYER_HANDLE_STORAGE_KEY } from '../../model/remembered-player-handle';
import type { RegisterResponse } from '../../model/register';
import { REGISTER_EVENT, REGISTER_RESPONSE_EVENT } from '../../model/register';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';
import RegistrationPage from './registration';

function setup(options: {
  socketService: MockSocketService;
  sessionService: MockSessionService;
  navigationState?: Record<string, unknown>;
}) {
  const mockRouter = {
    getCurrentNavigation: () => (options.navigationState ? { extras: { state: options.navigationState } } : null),
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
    setActiveLocaleCode('en');
    window.localStorage.removeItem(REMEMBERED_PLAYER_HANDLE_STORAGE_KEY);
    socketService = createMockSocketService();
    sessionService = createMockSessionService();
  });

  afterEach(() => {
    setActiveLocaleCode('en');
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

    it(`should emit '${REGISTER_EVENT}' with correct payload`, () => {
      const { component } = setup({ socketService, sessionService });
      component['registrationForm'].patchValue({
        locale: 'it',
        playerName: '  Pioneer  ',
        email: 'pioneer@stellar.com',
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

    it(`should register a listener for '${REGISTER_RESPONSE_EVENT}'`, () => {
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

    it('should keep rememberHandle disabled by default', () => {
      const { component } = setup({ socketService, sessionService });
      expect(component['registrationForm'].value.rememberHandle).toBe(false);
    });
  });

  describe('register-response handling', () => {
    function submitForm(component: RegistrationPage) {
      fillValidForm(component);
      component.submit();
    }

    it('should perform login after successful registration and then navigate to character list', () => {
      const { component, mockRouter } = setup({ socketService, sessionService });
      submitForm(component);
      socketService.triggerEvent(REGISTER_RESPONSE_EVENT, {
        success: true,
        message: 'Registration successful!',
        playerId: 'abc-123',
      } satisfies RegisterResponse);

      expect(socketService.emittedEvents.length).toBe(2);
      expect(socketService.emittedEvents[1].event).toBe(LOGIN_EVENT);
      expect(socketService.emittedEvents[1].data).toEqual({
        playerName: 'Pioneer',
        password: 'password123',
        locale: 'en',
      });

      socketService.triggerEvent(LOGIN_RESPONSE_EVENT, {
        success: true,
        message: 'Login successful!',
        sessionKey: 'session-login-123',
      } satisfies LoginResponse);

      expect(component['successMessage']()).toBe('Registration successful!');
      expect(component['errorMessage']()).toBeNull();
      expect(component['isSubmitting']()).toBe(false);
      expect(component['registrationForm'].value.playerName).toBeFalsy();
      expect(mockRouter.navigate).toHaveBeenCalledWith([{ outlets: { left: ['character-list'] } }], {
        preserveFragment: true,
        state: { playerName: 'Pioneer' },
      });
    });

    it('should persist remembered handle when opt-in is enabled', () => {
      const { component } = setup({ socketService, sessionService });
      fillValidForm(component);
      component['registrationForm'].patchValue({ rememberHandle: true });
      component.submit();

      socketService.triggerEvent(REGISTER_RESPONSE_EVENT, {
        success: true,
        message: 'Registration successful!',
      } satisfies RegisterResponse);

      expect(window.localStorage.getItem(REMEMBERED_PLAYER_HANDLE_STORAGE_KEY)).toBe('Pioneer');
    });

    it('should clear remembered handle when opt-in is disabled', () => {
      window.localStorage.setItem(REMEMBERED_PLAYER_HANDLE_STORAGE_KEY, 'OldPilot');
      const { component } = setup({ socketService, sessionService });
      fillValidForm(component);
      component['registrationForm'].patchValue({ rememberHandle: false });
      component.submit();

      socketService.triggerEvent(REGISTER_RESPONSE_EVENT, {
        success: true,
        message: 'Registration successful!',
      } satisfies RegisterResponse);

      expect(window.localStorage.getItem(REMEMBERED_PLAYER_HANDLE_STORAGE_KEY)).toBeNull();
    });

    it('should store the session key returned from login after registration success', () => {
      const { component } = setup({ socketService, sessionService });
      submitForm(component);
      socketService.triggerEvent(REGISTER_RESPONSE_EVENT, {
        success: true,
        message: 'Registration successful!',
      } satisfies RegisterResponse);

      socketService.triggerEvent(LOGIN_RESPONSE_EVENT, {
        success: true,
        message: 'Login successful!',
        sessionKey: 'session-login-456',
      } satisfies LoginResponse);

      expect(sessionService.storedKey).toBe('session-login-456');
      expect(sessionService.hasSession()).toBe(true);
    });

    it('should not call setSessionKey when login sessionKey is absent', () => {
      const { component } = setup({ socketService, sessionService });
      submitForm(component);
      socketService.triggerEvent(REGISTER_RESPONSE_EVENT, {
        success: true,
        message: 'Registration successful!',
      } satisfies RegisterResponse);

      socketService.triggerEvent(LOGIN_RESPONSE_EVENT, {
        success: true,
        message: 'Login successful!',
      } satisfies LoginResponse);

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
      } satisfies RegisterResponse);

      socketService.triggerEvent(LOGIN_RESPONSE_EVENT, {
        success: true,
        message: 'Login successful!',
      } satisfies LoginResponse);

      expect(socketService.registeredListeners.has(REGISTER_RESPONSE_EVENT)).toBe(false);
      expect(socketService.registeredListeners.has(LOGIN_RESPONSE_EVENT)).toBe(false);
    });

    it('should stay on registration page and show error when auto-login fails', () => {
      const { component, mockRouter } = setup({ socketService, sessionService });
      submitForm(component);

      socketService.triggerEvent(REGISTER_RESPONSE_EVENT, {
        success: true,
        message: 'Registration successful!',
      } satisfies RegisterResponse);

      socketService.triggerEvent(LOGIN_RESPONSE_EVENT, {
        success: false,
        message: 'Auto-login failed. Please try again.',
      } satisfies LoginResponse);

      expect(component['errorMessage']()).toBe('Auto-login failed. Please try again.');
      expect(component['successMessage']()).toBeNull();
      expect(component['isSubmitting']()).toBe(false);
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  describe('ngOnDestroy()', () => {
    it('should unsubscribe response listener on destroy', () => {
      const { component, fixture } = setup({ socketService, sessionService });
      fillValidForm(component);
      component.submit();
      expect(socketService.registeredListeners.has(REGISTER_RESPONSE_EVENT)).toBe(true);

      socketService.triggerEvent(REGISTER_RESPONSE_EVENT, {
        success: true,
        message: 'Registration successful!',
      } satisfies RegisterResponse);
      expect(socketService.registeredListeners.has(LOGIN_RESPONSE_EVENT)).toBe(true);

      fixture.destroy();
      expect(socketService.registeredListeners.has(REGISTER_RESPONSE_EVENT)).toBe(false);
      expect(socketService.registeredListeners.has(LOGIN_RESPONSE_EVENT)).toBe(false);
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

      expect(mockRouter.navigate).toHaveBeenCalledWith([{ outlets: { left: ['login'] } }], {
        preserveFragment: true,
        state: { preferredLocale: 'it' },
      });
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
    component['registrationForm'].patchValue({
      playerName: 'Pioneer',
      email: 'a@b.com',
      password: 'secret123',
      confirmPassword: 'secret123',
    });
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
    component['registrationForm'].patchValue({
      playerName: 'Pioneer',
      email: 'a@b.com',
      password: 'secret123',
      confirmPassword: 'wrong',
    });
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
