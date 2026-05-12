import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import {
  createMockSessionService,
  createMockSocketService,
  type MockSessionService,
  type MockSocketService,
} from '../../../testing';
import { SOLAR_SYSTEM_LIST_REQUEST_EVENT, SOLAR_SYSTEM_LIST_RESPONSE_EVENT } from '../../model/solar-system-list';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';
import ViewerPage from './viewer';

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
    imports: [ViewerPage],
    providers: [
      { provide: SocketService, useValue: options.socketService },
      { provide: SessionService, useValue: options.sessionService },
      { provide: Router, useValue: mockRouter },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const fixture = TestBed.createComponent(ViewerPage);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, mockRouter };
}

describe('ViewerPage', () => {
  let socketService: MockSocketService;
  let sessionService: MockSessionService;

  beforeEach(() => {
    socketService = createMockSocketService();
    sessionService = createMockSessionService('test-session-key');
  });

  it('emits solar-system-list-request on init when player + session are present', () => {
    setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer', joinCharacter: { id: 'c-1', characterName: 'Nova' } },
    });

    expect(socketService.emittedEvents[0]?.event).toBe(SOLAR_SYSTEM_LIST_REQUEST_EVENT);
    expect(socketService.emittedEvents[0]?.data).toEqual(
      jasmine.objectContaining({ playerName: 'Pioneer', sessionKey: 'test-session-key' }),
    );
  });

  it('populates solar systems on successful response', () => {
    const { component, fixture } = setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer' },
    });

    socketService.triggerOnceEvent(SOLAR_SYSTEM_LIST_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      solarSystems: [
        { id: 'sol', displayName: 'Sol', source: 'curated', distanceParsec: 0 },
        { id: 'alpha-cen', displayName: 'Alpha Centauri', source: 'curated', distanceParsec: 1.34 },
      ],
    });
    fixture.detectChanges();

    expect(component['solarSystems']().length).toBe(2);
    expect(component['isLoading']()).toBeFalse();
    expect(component['listError']()).toBeNull();
  });

  it('renders an error when the response indicates failure', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer' },
    });

    socketService.triggerOnceEvent(SOLAR_SYSTEM_LIST_RESPONSE_EVENT, {
      success: false,
      message: 'backend-down',
      solarSystems: [],
    });

    expect(component['listError']()).toContain('backend-down');
    expect(component['solarSystems']().length).toBe(0);
  });

  it('navigates to details + scene outlets when a system is selected', () => {
    const { component, mockRouter } = setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer' },
    });

    const system = { id: 'sol', displayName: 'Sol', source: 'curated' as const };
    component['selectSystem'](system);

    expect(mockRouter.navigate).toHaveBeenCalled();
    const args = mockRouter.navigate.calls.mostRecent().args;
    expect(args[0]).toEqual([{ outlets: { left: ['solar-system-details', 'sol'], right: ['viewer-scene', 'sol'] } }]);
    expect(args[1].state).toEqual(
      jasmine.objectContaining({ solarSystem: system, playerName: 'Pioneer' }),
    );
  });

  it('reports unlock predicate as true for all characters in the MVP', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer' },
    });
    expect(component['isViewerUnlocked']()).toBeTrue();
  });
});
