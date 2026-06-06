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
import type { LoginResponse } from '../../model/login';
import { LOGIN_EVENT, LOGIN_RESPONSE_EVENT } from '../../model/login';
import { REMEMBERED_PLAYER_HANDLE_STORAGE_KEY } from '../../model/remembered-player-handle';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';
import LoginPage from './login';

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
    imports: [LoginPage, ReactiveFormsModule],
    providers: [
      { provide: SocketService, useValue: options.socketService },
      { provide: SessionService, useValue: options.sessionService },
      { provide: Router, useValue: mockRouter },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const fixture = TestBed.createComponent(LoginPage);
  fixture.detectChanges();
  return { component: fixture.componentInstance, fixture, mockRouter };
}

describe('LoginPage', () => {
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

  it('should render Angular Three footer mark as external link', () => {
    const { fixture } = setup({ socketService, sessionService });
    const link = fixture.nativeElement.querySelector('a.angular-three-mark') as HTMLAnchorElement | null;

    expect(link).withContext('Angular Three footer link should exist').not.toBeNull();
    expect(link?.getAttribute('href')).toBe('https://angularthree.org');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toContain('noopener');
  });

  it('should prefill playerName from remembered handle storage', () => {
    window.localStorage.setItem(REMEMBERED_PLAYER_HANDLE_STORAGE_KEY, 'RememberedPilot');
    const { component } = setup({ socketService, sessionService });

    expect(component['loginForm'].value.playerName).toBe('RememberedPilot');
  });

  it('should focus password input when remembered player name exists', () => {
    window.localStorage.setItem(REMEMBERED_PLAYER_HANDLE_STORAGE_KEY, 'RememberedPilot');
    const { fixture } = setup({ socketService, sessionService });

    const activeElement = fixture.nativeElement.ownerDocument.activeElement as HTMLElement | null;
    expect(activeElement?.id).toBe('password');
  });

  it('should focus player name input when remembered player name does not exist', () => {
    const { fixture } = setup({ socketService, sessionService });

    const activeElement = fixture.nativeElement.ownerDocument.activeElement as HTMLElement | null;
    expect(activeElement?.id).toBe('playerName');
  });

  it('should initialise with no messages and not submitting', () => {
    const { component } = setup({ socketService, sessionService });
    expect(component['isSubmitting']()).toBe(false);
    expect(component['successMessage']()).toBeNull();
    expect(component['errorMessage']()).toBeNull();
    expect(component['canNavigateToRegister']()).toBe(false);
  });

  describe('submit()', () => {
    it('should mark form touched and not emit when form is invalid', () => {
      const { component } = setup({ socketService, sessionService });
      // form starts invalid (empty required fields)
      component.submit();
      expect(component['loginForm'].touched).toBe(true);
      expect(socketService.emittedEvents.length).toBe(0);
    });

    it(`should emit '${LOGIN_EVENT}' with correct payload`, () => {
      const { component } = setup({ socketService, sessionService });
      component['loginForm'].patchValue({ playerName: '  Pioneer  ', password: 'password123', locale: 'it' });
      component.submit();

      expect(socketService.emittedEvents.length).toBe(1);
      expect(socketService.emittedEvents[0].event).toBe(LOGIN_EVENT);
      expect(socketService.emittedEvents[0].data).toEqual({
        playerName: 'Pioneer',
        password: 'password123',
        locale: 'it',
      });
    });

    it('should reject whitespace-only player name', () => {
      const { component } = setup({ socketService, sessionService });
      component['loginForm'].patchValue({ playerName: '   ', password: 'password123' });
      component.submit();
      expect(socketService.emittedEvents.length).toBe(0);
    });

    it(`should register a listener for '${LOGIN_RESPONSE_EVENT}'`, () => {
      const { component } = setup({ socketService, sessionService });
      component['loginForm'].patchValue({ playerName: 'Pioneer', password: 'password123' });
      component.submit();
      expect(socketService.registeredListeners.has(LOGIN_RESPONSE_EVENT)).toBe(true);
    });
  });

  describe('login-response handling', () => {
    function submitForm(component: LoginPage) {
      component['loginForm'].patchValue({ playerName: 'Pioneer', password: 'password123' });
      component.submit();
    }

    it('should set successMessage on successful login', () => {
      const { component, mockRouter } = setup({ socketService, sessionService });
      submitForm(component);
      socketService.triggerEvent(LOGIN_RESPONSE_EVENT, {
        success: true,
        message: 'Login successful.',
        playerId: 'abc-123',
        sessionKey: 'session-abc-123',
      } satisfies LoginResponse);

      expect(component['successMessage']()).toBe('Login successful.');
      expect(component['errorMessage']()).toBeNull();
      expect(component['isSubmitting']()).toBe(false);
      expect(mockRouter.navigate).toHaveBeenCalledWith([{ outlets: { left: ['character-list'] } }], {
        preserveFragment: true,
        state: { playerName: 'Pioneer' },
      });
    });

    it('should store the session key returned from login', () => {
      const { component } = setup({ socketService, sessionService });
      submitForm(component);
      socketService.triggerEvent(LOGIN_RESPONSE_EVENT, {
        success: true,
        message: 'Login successful.',
        sessionKey: 'session-xyz-789',
      } satisfies LoginResponse);

      expect(sessionService.storedKey).toBe('session-xyz-789');
      expect(sessionService.hasSession()).toBe(true);
    });

    it('should not call setSessionKey when sessionKey is absent', () => {
      const { component } = setup({ socketService, sessionService });
      submitForm(component);
      socketService.triggerEvent(LOGIN_RESPONSE_EVENT, {
        success: true,
        message: 'Login successful.',
      } satisfies LoginResponse);

      expect(sessionService.storedKey).toBeNull();
    });

    it('should handle unregistered player name failure', () => {
      const { component } = setup({ socketService, sessionService });
      submitForm(component);
      socketService.triggerEvent(LOGIN_RESPONSE_EVENT, {
        success: false,
        message: 'No such player.',
        reason: 'PLAYER_NOT_REGISTERED',
      } satisfies LoginResponse);

      expect(component['errorMessage']()).toBe('Player name is not registered. Please register first.');
      expect(component['successMessage']()).toBeNull();
      expect(component['isSubmitting']()).toBe(false);
      expect(component['canNavigateToRegister']()).toBe(true);
    });

    it('should handle password mismatch failure', () => {
      const { component } = setup({ socketService, sessionService });
      submitForm(component);
      socketService.triggerEvent(LOGIN_RESPONSE_EVENT, {
        success: false,
        message: 'Wrong password.',
        reason: 'PASSWORD_MISMATCH',
      } satisfies LoginResponse);

      expect(component['errorMessage']()).toBe('Password does not match the player name.');
      expect(component['successMessage']()).toBeNull();
      expect(component['isSubmitting']()).toBe(false);
      expect(component['canNavigateToRegister']()).toBe(false);
    });

    it('should fallback to response message for unknown errors', () => {
      const { component } = setup({ socketService, sessionService });
      submitForm(component);
      socketService.triggerEvent(LOGIN_RESPONSE_EVENT, {
        success: false,
        message: 'Service unavailable.',
        reason: 'UNKNOWN',
      } satisfies LoginResponse);

      expect(component['errorMessage']()).toBe('Service unavailable.');
      expect(component['canNavigateToRegister']()).toBe(false);
    });

    it('should clear register navigation state on successful login', () => {
      const { component } = setup({ socketService, sessionService });
      submitForm(component);
      socketService.triggerEvent(LOGIN_RESPONSE_EVENT, {
        success: false,
        message: 'No such player.',
        reason: 'PLAYER_NOT_REGISTERED',
      } satisfies LoginResponse);

      expect(component['canNavigateToRegister']()).toBe(true);

      submitForm(component);
      socketService.triggerEvent(LOGIN_RESPONSE_EVENT, {
        success: true,
        message: 'Login successful.',
        sessionKey: 'session-abc-123',
      } satisfies LoginResponse);

      expect(component['canNavigateToRegister']()).toBe(false);
    });

    it('should unsubscribe listener after handling a response', () => {
      const { component } = setup({ socketService, sessionService });
      submitForm(component);
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
      const { component, fixture } = setup({ socketService, sessionService });
      component['loginForm'].patchValue({ playerName: 'Pioneer', password: 'password123' });
      component.submit();
      expect(socketService.registeredListeners.has(LOGIN_RESPONSE_EVENT)).toBe(true);

      fixture.destroy();
      expect(socketService.registeredListeners.has(LOGIN_RESPONSE_EVENT)).toBe(false);
    });
  });

  describe('navigation', () => {
    it('should navigate to registration in left outlet', () => {
      const { component, mockRouter } = setup({ socketService, sessionService });
      component['loginForm'].patchValue({ locale: 'it' });
      component.navigateToRegistration();

      expect(mockRouter.navigate).toHaveBeenCalledWith([{ outlets: { left: ['registration'] } }], {
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
