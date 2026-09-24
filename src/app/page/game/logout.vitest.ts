import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockSessionService, type MockSessionService } from '../../../testing';
import { SessionService } from '../../services/session.service';
import { ShipFlightPositionPersistenceService } from '../../services/ship-flight-position-persistence.service';
import { SocketLifecycleService } from '../../services/socket-lifecycle.service';
import LogoutPage from './logout';

function setup(options: { sessionService: MockSessionService; navigationState?: Record<string, unknown> }) {
  const mockRouter = {
    getCurrentNavigation: () => (options.navigationState ? { extras: { state: options.navigationState } } : null),
    navigate: vi.fn(),
    navigateByUrl: vi.fn(),
  };

  const mockSocketLifecycle = {
    disconnect: vi.fn(),
    ensureConnected: vi.fn(),
    runWhenConnected: vi.fn(),
  };
  const mockPositionPersistence = {
    flushPending: vi.fn().mockResolvedValue(undefined),
  };

  TestBed.configureTestingModule({
    imports: [LogoutPage],
    providers: [
      { provide: SessionService, useValue: options.sessionService },
      { provide: Router, useValue: mockRouter },
      { provide: SocketLifecycleService, useValue: mockSocketLifecycle },
      { provide: ShipFlightPositionPersistenceService, useValue: mockPositionPersistence },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const fixture = TestBed.createComponent(LogoutPage);
  fixture.detectChanges();
  return { component: fixture.componentInstance, fixture, mockRouter, mockSocketLifecycle, mockPositionPersistence };
}

describe('LogoutPage', () => {
  let sessionService: MockSessionService;

  beforeEach(() => {
    sessionService = createMockSessionService('test-session-key');
  });

  it('should flush the ship location before clearing the session and navigating to login', async () => {
    const { component, mockRouter, mockPositionPersistence } = setup({ sessionService });
    const clearSpy = vi.spyOn(sessionService, 'clearSession');

    await component.confirmLogout();

    expect(mockPositionPersistence.flushPending).toHaveBeenCalledTimes(1);
    expect(clearSpy).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(
      [{ outlets: { primary: ['intro'], left: ['login'], right: null } }],
      { preserveFragment: true },
    );
  });

  it('should keep the session active and show an error when the ship location cannot be saved', async () => {
    const { component, fixture, mockRouter, mockPositionPersistence } = setup({ sessionService });
    const clearSpy = vi.spyOn(sessionService, 'clearSession');
    mockPositionPersistence.flushPending.mockRejectedValueOnce(new Error('save failed'));

    await component.confirmLogout();
    fixture.detectChanges();

    expect(clearSpy).not.toHaveBeenCalled();
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Your ship location could not be saved',
    );
  });

  describe('navigateToCharacterList()', () => {
    it('should flush the location and disconnect the socket before navigating', async () => {
      const { component, mockSocketLifecycle, mockPositionPersistence } = setup({ sessionService });

      await component.navigateToCharacterList();

      expect(mockPositionPersistence.flushPending).toHaveBeenCalledTimes(1);
      expect(mockSocketLifecycle.disconnect).toHaveBeenCalled();
    });

    it('should navigate to character-list in left outlet and intro in primary', async () => {
      const { component, mockRouter } = setup({ sessionService });

      await component.navigateToCharacterList();

      expect(mockRouter.navigate).toHaveBeenCalledWith(
        [{ outlets: { primary: ['intro'], left: ['character-list'], right: null } }],
        { state: { playerName: '' } },
      );
    });

    it('should pass playerName in navigation state', async () => {
      const { component, mockRouter } = setup({
        sessionService,
        navigationState: { playerName: 'Pioneer' },
      });

      await component.navigateToCharacterList();

      expect(mockRouter.navigate).toHaveBeenCalledWith(
        [{ outlets: { primary: ['intro'], left: ['character-list'], right: null } }],
        { state: { playerName: 'Pioneer' } },
      );
    });

    it('should not clear session when navigating to character list', async () => {
      const { component } = setup({ sessionService });
      const clearSpy = vi.spyOn(sessionService, 'clearSession');

      await component.navigateToCharacterList();

      expect(clearSpy).not.toHaveBeenCalled();
    });

    it('should keep the game session and socket active when the final save fails', async () => {
      const { component, mockRouter, mockSocketLifecycle, mockPositionPersistence } = setup({ sessionService });
      mockPositionPersistence.flushPending.mockRejectedValueOnce(new Error('save failed'));

      await component.navigateToCharacterList();

      expect(mockSocketLifecycle.disconnect).not.toHaveBeenCalled();
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });
  });

  describe('DOM smoke tests', () => {
    it('should render without error', () => {
      const { fixture } = setup({ sessionService });
      fixture.detectChanges();
      expect(fixture.nativeElement).toBeTruthy();
    });

    it('should render Angular Three footer mark as external link', () => {
      const { fixture } = setup({ sessionService });
      const link = fixture.nativeElement.querySelector('a.angular-three-mark') as HTMLAnchorElement | null;

      expect(link).not.toBeNull();
      expect(link?.getAttribute('href')).toBe('https://angularthree.org');
      expect(link?.getAttribute('target')).toBe('_blank');
      expect(link?.getAttribute('rel')).toContain('noopener');
    });
  });
});
