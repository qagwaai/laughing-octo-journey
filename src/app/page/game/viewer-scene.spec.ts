import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import {
  createMockSessionService,
  createMockSocketService,
  type MockSessionService,
  type MockSocketService,
} from '../../../testing';
import { SOLAR_SYSTEM_GET_REQUEST_EVENT, SOLAR_SYSTEM_GET_RESPONSE_EVENT } from '../../model/solar-system-get';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';
import ViewerScenePage from './viewer-scene';

function setup(navigationState?: Record<string, unknown>) {
  const socketService: MockSocketService = createMockSocketService();
  const sessionService: MockSessionService = createMockSessionService('test-session-key');

  const mockRouter = {
    getCurrentNavigation: () => (navigationState ? { extras: { state: navigationState } } : null),
    navigate: jasmine.createSpy('navigate'),
  };

  const solarSystemIdParam = navigationState?.['solarSystemId'] as string | undefined;
  const paramMapMock = {
    get: (key: string) => (key === 'solarSystemId' ? solarSystemIdParam || null : null),
  };

  const mockActivatedRoute = {
    paramMap: of(paramMapMock),
  };

  TestBed.configureTestingModule({
    imports: [ViewerScenePage],
    providers: [
      { provide: SocketService, useValue: socketService },
      { provide: SessionService, useValue: sessionService },
      { provide: Router, useValue: mockRouter },
      { provide: ActivatedRoute, useValue: mockActivatedRoute },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const fixture = TestBed.createComponent(ViewerScenePage);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, socketService };
}

describe('ViewerScenePage', () => {
  it('shows the empty state when no system was provided in navigation state', () => {
    const { component } = setup();
    expect(component['hasSystem']()).toBeFalse();
    expect(component['bodies']()).toEqual([]);
  });

  it('emits solar-system-get-request when a system id is provided', () => {
    const { socketService } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });
    expect(socketService.emittedEvents[0]?.event).toBe(SOLAR_SYSTEM_GET_REQUEST_EVENT);
    expect(socketService.emittedEvents[0]?.data).toEqual(
      jasmine.objectContaining({ playerName: 'Pioneer', sessionKey: 'test-session-key', solarSystemId: 'sol' }),
    );
  });

  it('populates bodies on a successful response', () => {
    const { component, socketService, fixture } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });

    socketService.triggerOnceEvent(SOLAR_SYSTEM_GET_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      solarSystemId: 'sol',
      stars: [
        {
          id: 'sol-star',
          bodyType: 'star',
          displayName: 'Sol',
          spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 0, y: 0, z: 0 }, epochMs: 0 },
          luminositySolar: 1,
          visualization: { colorHex: '#ffe680' },
        },
      ],
      bodies: [
        {
          id: 'earth',
          bodyType: 'planet',
          displayName: 'Earth',
          spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 1.5e8, y: 0, z: 0 }, epochMs: 0 },
          visualization: { colorHex: '#3399ff' },
          physicalCatalog: { estimatedDiameterM: 12_742_000 },
        },
      ],
    });
    fixture.detectChanges();

    expect(component['bodies']().length).toBe(2);
    expect(component['isLoading']()).toBeFalse();
    expect(component['sceneError']()).toBeNull();
  });

  it('reports an error when the response indicates failure', () => {
    const { component, socketService } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });

    socketService.triggerOnceEvent(SOLAR_SYSTEM_GET_RESPONSE_EVENT, {
      success: false,
      message: 'not-found',
      solarSystemId: 'sol',
      bodies: [],
    });

    expect(component['sceneError']()).toContain('not-found');
  });

  it('navigates to planet-view route when planet focus transition is requested', fakeAsync(() => {
    const { component, fixture } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });
    const router = TestBed.inject(Router);

    component['bodies'].set([
      {
        id: 'earth',
        bodyType: 'planet',
        displayName: 'Earth',
        spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 1.5e8, y: 0, z: 0 }, epochMs: 0 },
      },
    ]);
    fixture.detectChanges();

    component['onPlanetViewRequest']({
      id: 'earth',
      bodyType: 'planet',
      displayName: 'Earth',
      spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 1.5e8, y: 0, z: 0 }, epochMs: 0 },
    });

    expect(component['isPlanetTransitioning']()).toBeTrue();
    tick(150);

    expect((router as unknown as { navigate: jasmine.Spy }).navigate).toHaveBeenCalledWith(
      [{ outlets: { right: ['planet-view', 'sol', 'earth'] } }],
      jasmine.objectContaining({
        preserveFragment: true,
        state: jasmine.objectContaining({ playerName: 'Pioneer' }),
      }),
    );
  }));
});
