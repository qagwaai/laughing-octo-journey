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
import {
  MARKET_LIST_BY_LOCATION_REQUEST_EVENT,
  MARKET_LIST_BY_LOCATION_RESPONSE_EVENT,
} from '../../model/market-list';
import { SHIP_LIST_REQUEST_EVENT, SHIP_LIST_RESPONSE_EVENT } from '../../model/ship-list';
import { SHIP_UPSERT_REQUEST_EVENT } from '../../model/ship-upsert';
import { SOLAR_SYSTEM_GET_REQUEST_EVENT, SOLAR_SYSTEM_GET_RESPONSE_EVENT } from '../../model/solar-system-get';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';
import { ViewerTargetService } from '../../services/viewer-target.service';
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

  it('sets missing-session scene error when loadSystem runs without solar system id', () => {
    const { component } = setup();

    component['loadSystem']();

    expect(component['sceneError']()).toContain('missing-session');
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

  it('hydrates market stations from market-list-by-location when solar-system-get has none', () => {
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
          spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 0, y: 0, z: 0 }, epochMs: 0 },
        },
      ],
      bodies: [
        {
          id: 'earth',
          bodyType: 'planet',
          displayName: 'Earth',
          spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 1.5e8, y: 0, z: 0 }, epochMs: 0 },
        },
      ],
    });
    fixture.detectChanges();

    expect(socketService.emittedEvents.some((entry) => entry.event === MARKET_LIST_BY_LOCATION_REQUEST_EVENT)).toBeTrue();

    socketService.triggerEvent(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      solarSystemId: 'sol',
      markets: [
        {
          marketId: 'sol-ceres-exchange',
          solarSystemId: 'sol',
          marketName: 'Ceres Exchange',
          siteType: 'station',
          siteName: 'Ceres Exchange Station',
          spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 4.2e8, y: 0, z: 0 }, epochMs: 0 },
          priceMultiplier: 1,
          driftPercentPerHour: 0,
          restockIntervalMinutes: 15,
          trajectory: {
            kind: 'orbital-elements',
            orbit: {
              anchorBodyId: 'sol-star',
              semiMajorAxisKm: 4.2e8,
              eccentricity: 0.08,
              inclinationDeg: 2.2,
              longitudeOfAscendingNodeDeg: 45,
              argumentOfPeriapsisDeg: 70,
              meanAnomalyAtEpochDeg: 130,
              orbitalPeriodSec: 16873920,
              epoch: '2026-05-11T00:00:00.000Z',
            },
          },
        },
      ],
    });
    fixture.detectChanges();

    const marketBody = component['bodies']().find((body) => body.id === 'sol-ceres-exchange');
    expect(marketBody).toEqual(
      jasmine.objectContaining({
        bodyType: 'station',
        stationKind: 'market',
        displayName: 'Ceres Exchange Station',
      }),
    );
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

  it('clamps stellar viewer zoom input into the expected range', () => {
    const { component } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });

    component['onZoomChange'](-10);
    expect(component['zoomLevel']()).toBe(0);

    component['onZoomChange'](135);
    expect(component['zoomLevel']()).toBe(100);

    component['onZoomChange']('42');
    expect(component['zoomLevel']()).toBe(42);
    expect(component['zoomPercent']()).toBe(42);
  });

  it('ignores non-finite zoom input values', () => {
    const { component } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });

    component['onZoomChange']('not-a-number');
    component['onZoomChange'](Number.POSITIVE_INFINITY);

    expect(component['zoomLevel']()).toBe(78);
  });

  it('lazy-repairs ships with invalid spatial by re-issuing the deterministic upsert', () => {
    const { component, socketService, fixture } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });
    const sessionService = TestBed.inject(SessionService) as unknown as MockSessionService;
    sessionService.setActiveCharacter({ id: 'char-1', characterName: 'Nova', level: 5 });

    // Hand the SocketService mock an `upsertShip` spy so the production code's
    // `socketService.upsertShip(...)` call is observable in this test.
    (socketService as unknown as { upsertShip: jasmine.Spy }).upsertShip = jasmine.createSpy('upsertShip');

    socketService.triggerOnceEvent(SOLAR_SYSTEM_GET_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      solarSystemId: 'sol',
      stars: [],
      bodies: [],
    });
    fixture.detectChanges();

    expect(socketService.emittedEvents.some((entry) => entry.event === SHIP_LIST_REQUEST_EVENT)).toBeTrue();

    socketService.triggerEvent(SHIP_LIST_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      playerName: 'Pioneer',
      characterId: 'char-1',
      ships: [
        {
          id: 'ship-broken',
          name: 'Wraith',
          model: 'Scavenger Pod',
          tier: 1,
          status: 'ACTIVE',
          spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 0, y: 0, z: 0 }, epochMs: 0 },
        },
      ],
    });
    fixture.detectChanges();

    const upsertShipSpy = (socketService as unknown as { upsertShip: jasmine.Spy }).upsertShip;
    expect(upsertShipSpy).toHaveBeenCalledTimes(1);
    const [request] = upsertShipSpy.calls.mostRecent().args as [
      { playerName: string; characterId: string; ship: { id: string; spatial: { positionKm: { x: number } } } },
    ];
    expect(request.playerName).toBe('Pioneer');
    expect(request.characterId).toBe('char-1');
    expect(request.ship.id).toBe('ship-broken');
    // Deterministic asteroid-belt placement: magnitude well above the sun-origin floor.
    const { x, y, z } = request.ship.spatial.positionKm as { x: number; y: number; z: number };
    expect(Math.hypot(x, y, z)).toBeGreaterThan(1e7);
    // Ship is still surfaced to the viewer so the unknown-spatial fallback can render it.
    expect(component['ships']().some((s) => s.id === 'ship-broken')).toBeTrue();
    expect(component['hasUnknownSpatialShip']()).toBeTrue();
  });

  it('does not lazy-repair ships that already have valid spatial', () => {
    const { socketService, fixture } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });
    const sessionService = TestBed.inject(SessionService) as unknown as MockSessionService;
    sessionService.setActiveCharacter({ id: 'char-1', characterName: 'Nova', level: 5 });
    (socketService as unknown as { upsertShip: jasmine.Spy }).upsertShip = jasmine.createSpy('upsertShip');

    socketService.triggerOnceEvent(SOLAR_SYSTEM_GET_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      solarSystemId: 'sol',
      stars: [],
      bodies: [],
    });
    fixture.detectChanges();

    socketService.triggerEvent(SHIP_LIST_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      playerName: 'Pioneer',
      characterId: 'char-1',
      ships: [
        {
          id: 'ship-ok',
          name: 'Nomad',
          model: 'Scavenger Pod',
          tier: 1,
          status: 'ACTIVE',
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: { x: 3.5e8, y: 0, z: 0 },
            epochMs: 1700000000000,
          },
        },
      ],
    });
    fixture.detectChanges();

    expect((socketService as unknown as { upsertShip: jasmine.Spy }).upsertShip).not.toHaveBeenCalled();
    expect(socketService.emittedEvents.some((entry) => entry.event === SHIP_UPSERT_REQUEST_EVENT)).toBeFalse();
  });

  it('ignores wheel zoom input when no system is loaded', () => {
    const { component } = setup();
    const preventDefault = jasmine.createSpy('preventDefault');

    component['onWheel']({ deltaY: 100, deltaMode: 0, preventDefault } as unknown as WheelEvent);

    expect(component['zoomLevel']()).toBe(78);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('applies wheel zoom when a system is loaded', () => {
    const { component } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });
    const preventDefault = jasmine.createSpy('preventDefault');

    component['onWheel']({ deltaY: -100, deltaMode: 0, preventDefault } as unknown as WheelEvent);

    expect(preventDefault).toHaveBeenCalled();
    expect(component['zoomLevel']()).toBeLessThan(78);
  });

  it('ignores zoom input events when target is not an input element', () => {
    const { component } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });

    component['onZoomInput']({ target: {} } as unknown as Event);

    expect(component['zoomLevel']()).toBe(78);
  });

  it('always suppresses zoom context menu interactions', () => {
    const { component } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });
    const preventDefault = jasmine.createSpy('preventDefault');
    const stopPropagation = jasmine.createSpy('stopPropagation');

    component['onZoomContextMenu']({ preventDefault, stopPropagation } as unknown as MouseEvent);

    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
  });

  it('blocks right-click interactions on zoom controls only for secondary button', () => {
    const { component } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });
    const preventDefault = jasmine.createSpy('preventDefault');
    const stopPropagation = jasmine.createSpy('stopPropagation');

    component['onZoomPointerDown']({ button: 0, preventDefault, stopPropagation } as unknown as PointerEvent);
    component['onZoomPointerDown']({ button: 2, preventDefault, stopPropagation } as unknown as PointerEvent);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(stopPropagation).toHaveBeenCalledTimes(1);
  });

  it('blocks right-button pointer up and mouse up interactions', () => {
    const { component } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });
    const preventDefault = jasmine.createSpy('preventDefault');
    const stopPropagation = jasmine.createSpy('stopPropagation');

    component['onZoomPointerUp']({ button: 2, preventDefault, stopPropagation } as unknown as PointerEvent);
    component['onZoomMouseUp']({ button: 2, preventDefault, stopPropagation } as unknown as MouseEvent);

    expect(preventDefault).toHaveBeenCalledTimes(2);
    expect(stopPropagation).toHaveBeenCalledTimes(2);
  });

  it('does not block non-right button pointer and mouse interactions', () => {
    const { component } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });
    const preventDefault = jasmine.createSpy('preventDefault');
    const stopPropagation = jasmine.createSpy('stopPropagation');

    component['onZoomPointerUp']({ button: 0, preventDefault, stopPropagation } as unknown as PointerEvent);
    component['onZoomMouseDown']({ button: 0, preventDefault, stopPropagation } as unknown as MouseEvent);
    component['onZoomMouseUp']({ button: 0, preventDefault, stopPropagation } as unknown as MouseEvent);
    component['onZoomAuxClick']({ button: 0, preventDefault, stopPropagation } as unknown as MouseEvent);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(stopPropagation).not.toHaveBeenCalled();
  });

  it('updates hovered and focused body signals from scene callbacks', () => {
    const { component } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });
    const earth = {
      id: 'earth',
      bodyType: 'planet',
      displayName: 'Earth',
      spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 1, y: 0, z: 0 }, epochMs: 0 },
    } as any;

    component['onHoveredBodyChange'](earth);
    component['onFocusedPlanetChange'](earth);

    expect(component['hoveredBody']()).toBe(earth);
    expect(component['focusedPlanet']()).toBe(earth);
  });

  it('feeds target and active ship ids into scene inputs', () => {
    const { component } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });
    const sessionService = TestBed.inject(SessionService) as unknown as MockSessionService;
    const viewerTargetService = TestBed.inject(ViewerTargetService);

    sessionService.setActiveShip({
      id: 'ship-active-1',
      name: 'Scout',
      model: 'Scavenger Pod',
      tier: 1,
      spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 2, y: 0, z: 0 }, epochMs: 0 },
    } as any);
    viewerTargetService.target('earth');

    const inputs = component['sceneInputs']();
    expect(inputs.targetBodyId).toBe('earth');
    expect(inputs.activeShipId).toBe('ship-active-1');
  });

  it('blocks right-button mouse down and auxclick interactions', () => {
    const { component } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });
    const preventDefault = jasmine.createSpy('preventDefault');
    const stopPropagation = jasmine.createSpy('stopPropagation');

    component['onZoomMouseDown']({ button: 2, preventDefault, stopPropagation } as unknown as MouseEvent);
    component['onZoomAuxClick']({ button: 2, preventDefault, stopPropagation } as unknown as MouseEvent);

    expect(preventDefault).toHaveBeenCalledTimes(2);
    expect(stopPropagation).toHaveBeenCalledTimes(2);
  });

  it('does not start planet transition when already transitioning', () => {
    const { component } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });
    const router = TestBed.inject(Router);
    component['isPlanetTransitioning'].set(true);

    component['onPlanetViewRequest']({
      id: 'earth',
      bodyType: 'planet',
      displayName: 'Earth',
      spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 1, y: 0, z: 0 }, epochMs: 0 },
    });

    expect((router as unknown as { navigate: jasmine.Spy }).navigate).not.toHaveBeenCalled();
  });

  it('cancels pending transition timer on destroy', fakeAsync(() => {
    const { component } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });
    const router = TestBed.inject(Router);

    component['onPlanetViewRequest']({
      id: 'earth',
      bodyType: 'planet',
      displayName: 'Earth',
      spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 1, y: 0, z: 0 }, epochMs: 0 },
    });

    component.ngOnDestroy();
    tick(200);

    expect((router as unknown as { navigate: jasmine.Spy }).navigate).not.toHaveBeenCalled();
    expect(component['planetTransitionTimer']).toBeNull();
  }));
});
