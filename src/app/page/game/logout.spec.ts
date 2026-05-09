import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { createMockSessionService, type MockSessionService } from '../../../testing';
import { SessionService } from '../../services/session.service';
import LogoutPage from './logout';

function setup(options: { sessionService: MockSessionService; navigationState?: Record<string, unknown> }) {
  const mockRouter = {
    getCurrentNavigation: () => (options.navigationState ? { extras: { state: options.navigationState } } : null),
    navigate: jasmine.createSpy('navigate'),
  };

  TestBed.configureTestingModule({
    imports: [LogoutPage],
    providers: [
      { provide: SessionService, useValue: options.sessionService },
      { provide: Router, useValue: mockRouter },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const fixture = TestBed.createComponent(LogoutPage);
  fixture.detectChanges();
  return { component: fixture.componentInstance, fixture, mockRouter };
}

describe('LogoutPage', () => {
  let sessionService: MockSessionService;

  beforeEach(() => {
    sessionService = createMockSessionService('test-session-key');
  });

  it('should clear session and navigate to login', () => {
    const { component, mockRouter } = setup({ sessionService });
    const clearSpy = spyOn(sessionService, 'clearSession');

    component.confirmLogout();

    expect(clearSpy).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(
      [{ outlets: { primary: ['intro'], left: ['login'], right: null } }],
      { preserveFragment: true },
    );
  });

  describe('navigateToCharacterList()', () => {
    it('should navigate to character-list in left outlet', () => {
      const { component, mockRouter } = setup({ sessionService });

      component.navigateToCharacterList();

      expect(mockRouter.navigate).toHaveBeenCalledWith([{ outlets: { left: ['character-list'] } }], {
        preserveFragment: true,
        state: { playerName: '' },
      });
    });

    it('should pass playerName in navigation state', () => {
      const { component, mockRouter } = setup({
        sessionService,
        navigationState: { playerName: 'Pioneer' },
      });

      component.navigateToCharacterList();

      expect(mockRouter.navigate).toHaveBeenCalledWith([{ outlets: { left: ['character-list'] } }], {
        preserveFragment: true,
        state: { playerName: 'Pioneer' },
      });
    });

    it('should not clear session when navigating to character list', () => {
      const { component } = setup({ sessionService });
      const clearSpy = spyOn(sessionService, 'clearSession');

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
  });
});
