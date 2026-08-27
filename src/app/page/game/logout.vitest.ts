import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockSessionService, type MockSessionService } from '../../../testing';
import { SessionService } from '../../services/session.service';
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

  TestBed.configureTestingModule({
    imports: [LogoutPage],
    providers: [
      { provide: SessionService, useValue: options.sessionService },
      { provide: Router, useValue: mockRouter },
      { provide: SocketLifecycleService, useValue: mockSocketLifecycle },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const fixture = TestBed.createComponent(LogoutPage);
  fixture.detectChanges();
  return { component: fixture.componentInstance, fixture, mockRouter, mockSocketLifecycle };
}

describe('LogoutPage', () => {
  let sessionService: MockSessionService;

  beforeEach(() => {
    sessionService = createMockSessionService('test-session-key');
  });

  it('should clear session and navigate to login', () => {
    const { component, mockRouter } = setup({ sessionService });
    const clearSpy = vi.spyOn(sessionService, 'clearSession');

    component.confirmLogout();

    expect(clearSpy).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(
      [{ outlets: { primary: ['intro'], left: ['login'], right: null } }],
      { preserveFragment: true },
    );
  });

  describe('navigateToCharacterList()', () => {
    it('should disconnect socket before navigating', () => {
      const { component, mockSocketLifecycle } = setup({ sessionService });

      component.navigateToCharacterList();

      expect(mockSocketLifecycle.disconnect).toHaveBeenCalled();
    });

    it('should navigate to character-list in left outlet and intro in primary', () => {
      const { component, mockRouter } = setup({ sessionService });

      component.navigateToCharacterList();

      expect(mockRouter.navigate).toHaveBeenCalledWith(
        [{ outlets: { primary: ['intro'], left: ['character-list'], right: null } }],
        { state: { playerName: '' } },
      );
    });

    it('should pass playerName in navigation state', () => {
      const { component, mockRouter } = setup({
        sessionService,
        navigationState: { playerName: 'Pioneer' },
      });

      component.navigateToCharacterList();

      expect(mockRouter.navigate).toHaveBeenCalledWith(
        [{ outlets: { primary: ['intro'], left: ['character-list'], right: null } }],
        { state: { playerName: 'Pioneer' } },
      );
    });

    it('should not clear session when navigating to character list', () => {
      const { component } = setup({ sessionService });
      const clearSpy = vi.spyOn(sessionService, 'clearSession');

      component.navigateToCharacterList();

      expect(clearSpy).not.toHaveBeenCalled();
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
