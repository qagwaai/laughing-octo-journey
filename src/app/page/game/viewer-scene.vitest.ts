import { describe, expect, it, vi } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
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
import { SHIP_LIST_BY_OWNER_REQUEST_EVENT, SHIP_LIST_BY_OWNER_RESPONSE_EVENT } from '../../model/ship-list-by-owner';
import { SHIP_UPSERT_REQUEST_EVENT } from '../../model/ship-upsert';
import { SOLAR_SYSTEM_GET_REQUEST_EVENT, SOLAR_SYSTEM_GET_RESPONSE_EVENT } from '../../model/solar-system-get';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';
import { ViewerTargetService } from '../../services/viewer-target.service';
import ViewerScenePage from './viewer-scene';

function setup(navigationState?: Record<string, unknown>, queryParams?: Record<string, string>) {
  const socketService: MockSocketService = createMockSocketService();
  const sessionService: MockSessionService = createMockSessionService('test-session-key');

  const mockRouter = {
    getCurrentNavigation: () => (navigationState ? { extras: { state: navigationState } } : null),
    navigate: vi.fn(),
  };

  const solarSystemIdParam = navigationState?.['solarSystemId'] as string | undefined;
  const paramMapMock = {
    get: (key: string) => (key === 'solarSystemId' ? solarSystemIdParam || null : null),
  };

  const queryParamMapMock = {
    get: (key: string) => queryParams?.[key] ?? null,
  };

  const mockActivatedRoute = {
    paramMap: of(paramMapMock),
    queryParamMap: of(queryParamMapMock),
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
  it('enables viewer QA force-hero defaults in dev builds', () => {
    const { component } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });

    expect(component['isDevBuild']).toBe(true);
    expect(component['viewerQaEnabled']()).toBe(true);
    expect(component['forceHeroMode']()).toBe(true);
    expect(component['showEffectiveRenderProfile']()).toBe(true);
  });

  it('applies URL override query params for QA toggles', () => {
    const { component } = setup(
      { playerName: 'Pioneer', solarSystemId: 'sol' },
      { viewerQa: '1', forceHero: '0', showRenderProfile: '0' },
    );

    expect(component['viewerQaEnabled']()).toBe(true);
    expect(component['forceHeroMode']()).toBe(false);
    expect(component['showEffectiveRenderProfile']()).toBe(false);
  });

  it('shows the empty state when no system was provided in navigation state', () => {
    const { component } = setup();
    expect(component['hasSystem']()).toBe(false);
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
      expect.objectContaining({ playerName: 'Pioneer', sessionKey: 'test-session-key', solarSystemId: 'sol' }),
    );
  });

  it('populates bodies on a successful response', () => {
    const { component, socketService, fixture } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });

    const getRequest = socketService.emittedEvents.find((entry) => entry.event === SOLAR_SYSTEM_GET_REQUEST_EVENT)?.data as {
      correlationId?: string;
      requestIdentity?: unknown;
    };

    socketService.triggerEvent(SOLAR_SYSTEM_GET_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      correlationId: getRequest?.correlationId,
      requestIdentity: getRequest?.requestIdentity,
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
    expect(component['isLoading']()).toBe(false);
    expect(component['sceneError']()).toBeNull();
  });

  it('hydrates market stations from market-list-by-location when solar-system-get has none', () => {
    const { component, socketService, fixture } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });

    const getRequest = socketService.emittedEvents.find((entry) => entry.event === SOLAR_SYSTEM_GET_REQUEST_EVENT)?.data as {
      correlationId?: string;
      requestIdentity?: unknown;
    };

    socketService.triggerEvent(SOLAR_SYSTEM_GET_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      correlationId: getRequest?.correlationId,
      requestIdentity: getRequest?.requestIdentity,
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

    expect(socketService.emittedEvents.some((entry) => entry.event === MARKET_LIST_BY_LOCATION_REQUEST_EVENT)).toBe(true);

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
      expect.objectContaining({
        bodyType: 'station',
        stationKind: 'market',
        displayName: 'Ceres Exchange Station',
      }),
    );
  });

  it('reports an error when the response indicates failure', () => {
    const { component, socketService } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });

    const getRequest = socketService.emittedEvents.find((entry) => entry.event === SOLAR_SYSTEM_GET_REQUEST_EVENT)?.data as {
      correlationId?: string;
      requestIdentity?: unknown;
    };

    socketService.triggerEvent(SOLAR_SYSTEM_GET_RESPONSE_EVENT, {
      success: false,
      message: 'not-found',
      correlationId: getRequest?.correlationId,
      requestIdentity: getRequest?.requestIdentity,
      solarSystemId: 'sol',
      bodies: [],
    });

    expect(component['sceneError']()).toContain('not-found');
  });

  it('navigates to planet-view route when planet focus transition is requested', async () => {
    vi.useFakeTimers();
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

    expect(component['isPlanetTransitioning']()).toBe(true);
    await vi.advanceTimersByTimeAsync(150);

    expect((router as unknown as { navigate: ReturnType<typeof vi.fn> }).navigate).toHaveBeenCalledWith(
      [{ outlets: { right: ['planet-view', 'sol', 'earth'] } }],
      expect.objectContaining({
        preserveFragment: true,
        state: expect.objectContaining({ playerName: 'Pioneer' }),
      }),
    );
    vi.useRealTimers();
  });

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
    (socketService as unknown as { upsertShip: ReturnType<typeof vi.fn> }).upsertShip = vi.fn();

    const getRequest = socketService.emittedEvents.find((entry) => entry.event === SOLAR_SYSTEM_GET_REQUEST_EVENT)?.data as {
      correlationId?: string;
      requestIdentity?: unknown;
    };

    socketService.triggerEvent(SOLAR_SYSTEM_GET_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      correlationId: getRequest?.correlationId,
      requestIdentity: getRequest?.requestIdentity,
      solarSystemId: 'sol',
      stars: [],
      bodies: [],
    });
    fixture.detectChanges();

    expect(socketService.emittedEvents.some((entry) => entry.event === SHIP_LIST_BY_OWNER_REQUEST_EVENT)).toBe(true);

    const shipListRequest = socketService.emittedEvents.find((entry) => entry.event === SHIP_LIST_BY_OWNER_REQUEST_EVENT)?.data as {
      correlationId?: string;
      requestIdentity?: unknown;
    };

    socketService.triggerEvent(SHIP_LIST_BY_OWNER_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      correlationId: shipListRequest?.correlationId,
      requestIdentity: shipListRequest?.requestIdentity,
      owner: { ownerType: 'player-character', playerId: 'p-1', characterId: 'char-1', npcId: null, factionId: null },
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

    const upsertShipSpy = (socketService as unknown as { upsertShip: ReturnType<typeof vi.fn> }).upsertShip;
    expect(upsertShipSpy).toHaveBeenCalledTimes(1);
    const [request] = upsertShipSpy.mock.calls.slice(-1)[0] as [
      { playerName: string; characterId: string; ship: { id: string; spatial: { positionKm: { x: number } } } },
    ];
    expect(request.playerName).toBe('Pioneer');
    expect(request.characterId).toBe('char-1');
    expect(request.ship.id).toBe('ship-broken');
    // Deterministic asteroid-belt placement: magnitude well above the sun-origin floor.
    const { x, y, z } = request.ship.spatial.positionKm as { x: number; y: number; z: number };
    expect(Math.hypot(x, y, z)).toBeGreaterThan(1e7);
    // Ship is still surfaced to the viewer so the unknown-spatial fallback can render it.
    expect(component['ships']().some((s) => s.id === 'ship-broken')).toBe(true);
    expect(component['hasUnknownSpatialShip']()).toBe(true);
  });

  it('does not lazy-repair ships that already have valid spatial', () => {
    const { socketService, fixture } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });
    const sessionService = TestBed.inject(SessionService) as unknown as MockSessionService;
    sessionService.setActiveCharacter({ id: 'char-1', characterName: 'Nova', level: 5 });
    (socketService as unknown as { upsertShip: ReturnType<typeof vi.fn> }).upsertShip = vi.fn();

    const getRequest = socketService.emittedEvents.find((entry) => entry.event === SOLAR_SYSTEM_GET_REQUEST_EVENT)?.data as {
      correlationId?: string;
      requestIdentity?: unknown;
    };

    socketService.triggerEvent(SOLAR_SYSTEM_GET_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      correlationId: getRequest?.correlationId,
      requestIdentity: getRequest?.requestIdentity,
      solarSystemId: 'sol',
      stars: [],
      bodies: [],
    });
    fixture.detectChanges();

    socketService.triggerEvent(SHIP_LIST_BY_OWNER_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      owner: { ownerType: 'player-character', playerId: 'p-1', characterId: 'char-1', npcId: null, factionId: null },
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

    expect((socketService as unknown as { upsertShip: ReturnType<typeof vi.fn> }).upsertShip).not.toHaveBeenCalled();
    expect(socketService.emittedEvents.some((entry) => entry.event === SHIP_UPSERT_REQUEST_EVENT)).toBe(false);
  });

  it('ignores wheel zoom input when no system is loaded', () => {
    const { component } = setup();
    const preventDefault = vi.fn();

    component['onWheel']({ deltaY: 100, deltaMode: 0, preventDefault } as unknown as WheelEvent);

    expect(component['zoomLevel']()).toBe(78);
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('applies wheel zoom when a system is loaded', () => {
    const { component } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });
    const preventDefault = vi.fn();

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
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    component['onZoomContextMenu']({ preventDefault, stopPropagation } as unknown as MouseEvent);

    expect(preventDefault).toHaveBeenCalled();
    expect(stopPropagation).toHaveBeenCalled();
  });

  it('blocks right-click interactions on zoom controls only for secondary button', () => {
    const { component } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    component['onZoomPointerDown']({ button: 0, preventDefault, stopPropagation } as unknown as PointerEvent);
    component['onZoomPointerDown']({ button: 2, preventDefault, stopPropagation } as unknown as PointerEvent);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(stopPropagation).toHaveBeenCalledTimes(1);
  });

  it('blocks right-button pointer up and mouse up interactions', () => {
    const { component } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

    component['onZoomPointerUp']({ button: 2, preventDefault, stopPropagation } as unknown as PointerEvent);
    component['onZoomMouseUp']({ button: 2, preventDefault, stopPropagation } as unknown as MouseEvent);

    expect(preventDefault).toHaveBeenCalledTimes(2);
    expect(stopPropagation).toHaveBeenCalledTimes(2);
  });

  it('does not block non-right button pointer and mouse interactions', () => {
    const { component } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

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
    const preventDefault = vi.fn();
    const stopPropagation = vi.fn();

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

    expect((router as unknown as { navigate: ReturnType<typeof vi.fn> }).navigate).not.toHaveBeenCalled();
  });

  it('cancels pending transition timer on destroy', async () => {
    vi.useFakeTimers();
    const { component } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });
    const router = TestBed.inject(Router);

    component['onPlanetViewRequest']({
      id: 'earth',
      bodyType: 'planet',
      displayName: 'Earth',
      spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 1, y: 0, z: 0 }, epochMs: 0 },
    });

    component.ngOnDestroy();
    await vi.advanceTimersByTimeAsync(200);

    expect((router as unknown as { navigate: ReturnType<typeof vi.fn> }).navigate).not.toHaveBeenCalled();
    expect(component['planetTransitionTimer']).toBeNull();
    vi.useRealTimers();
  });

  it('maps effective scene bodies to force-hero descriptors when QA mode is enabled', () => {
    const { component } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });

    component['bodies'].set([
      {
        id: 'body-asteroid',
        bodyType: 'asteroid',
        displayName: 'A-01',
        spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 1, y: 0, z: 0 }, epochMs: 0 },
      },
      {
        id: 'body-debris',
        bodyType: 'debris',
        displayName: 'Debris-01',
        spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 2, y: 0, z: 0 }, epochMs: 0 },
      },
      {
        id: 'body-gate',
        bodyType: 'jump-gate',
        displayName: 'Gate-01',
        spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 3, y: 0, z: 0 }, epochMs: 0 },
      },
      {
        id: 'body-station',
        bodyType: 'station',
        displayName: 'Station-01',
        spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 4, y: 0, z: 0 }, epochMs: 0 },
      },
      {
        id: 'body-planet',
        bodyType: 'planet',
        displayName: 'Planet-01',
        spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 5, y: 0, z: 0 }, epochMs: 0 },
      },
    ] as any);

    const effective = component['effectiveSceneBodies']();
    expect(effective.find((b) => b.id === 'body-asteroid')?.externalObjectDescriptor?.domain).toBe('asteroids');
    expect(effective.find((b) => b.id === 'body-debris')?.externalObjectDescriptor?.domain).toBe('debris');
    expect(effective.find((b) => b.id === 'body-gate')?.externalObjectDescriptor?.domain).toBe('gates');
    expect(effective.find((b) => b.id === 'body-station')?.externalObjectDescriptor?.domain).toBe('stations');
    expect(effective.find((b) => b.id === 'body-planet')?.externalObjectDescriptor).toBeUndefined();
  });

  it('maps effective scene ships to hero descriptors and infers family for descriptor-less ships', () => {
    const { component } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });

    component['ships'].set([
      {
        id: 'ship-existing',
        name: 'Existing Ship',
        model: 'Scavenger Pod',
        tier: 1,
        status: 'ACTIVE',
        externalObjectDescriptor: {
          descriptorId: 'existing-descriptor',
          schemaVersion: 'sw-13-m0-v1',
          domain: 'ships',
          objectFamily: 'scout',
          roleCue: 'default',
          factionCue: 'neutral',
          fallbackTier: 'minimal',
          displayLabel: 'Existing Ship',
          silhouetteProfile: 'default',
          materialProfile: 'default',
          emissiveProfile: 'default',
        },
      },
      {
        id: 'ship-inferred',
        name: 'War Pike',
        model: 'Heavy Frigate',
        tier: 2,
        status: 'ACTIVE',
      },
    ] as any);

    const effective = component['effectiveSceneShips']();
    expect(effective.find((s) => s.id === 'ship-existing')?.externalObjectDescriptor?.fallbackTier).toBe('hero');
    expect(effective.find((s) => s.id === 'ship-inferred')?.externalObjectDescriptor).toEqual(
      expect.objectContaining({ domain: 'ships', objectFamily: 'frigate', fallbackTier: 'hero' }),
    );
  });

  it('keeps original scene bodies and ships when QA mode is disabled', () => {
    const { component } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });
    component['viewerQaEnabled'].set(false);
    component['forceHeroMode'].set(true);

    const bodies = [
      {
        id: 'body-1',
        bodyType: 'asteroid',
        displayName: 'Asteroid-1',
        spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 1, y: 0, z: 0 }, epochMs: 0 },
      },
    ] as any;
    const ships = [{ id: 'ship-1', model: 'Scavenger Pod' }] as any;

    component['bodies'].set(bodies);
    component['ships'].set(ships);

    expect(component['effectiveSceneBodies']()).toBe(bodies);
    expect(component['effectiveSceneShips']()).toBe(ships);
  });

  it('ignores QA toggle events for non-input targets and applies input checkbox state', () => {
    const { component } = setup({ playerName: 'Pioneer', solarSystemId: 'sol' });

    component['onViewerQaToggle']({ target: {} } as unknown as Event);
    component['onForceHeroToggle']({ target: {} } as unknown as Event);
    component['onShowRenderProfileToggle']({ target: {} } as unknown as Event);

    expect(component['viewerQaEnabled']()).toBe(true);
    expect(component['forceHeroMode']()).toBe(true);
    expect(component['showEffectiveRenderProfile']()).toBe(true);

    const viewerQaInput = document.createElement('input');
    viewerQaInput.type = 'checkbox';
    viewerQaInput.checked = false;
    component['onViewerQaToggle']({ target: viewerQaInput } as unknown as Event);

    const forceHeroInput = document.createElement('input');
    forceHeroInput.type = 'checkbox';
    forceHeroInput.checked = false;
    component['onForceHeroToggle']({ target: forceHeroInput } as unknown as Event);

    const profileInput = document.createElement('input');
    profileInput.type = 'checkbox';
    profileInput.checked = false;
    component['onShowRenderProfileToggle']({ target: profileInput } as unknown as Event);

    expect(component['viewerQaEnabled']()).toBe(false);
    expect(component['forceHeroMode']()).toBe(false);
    expect(component['showEffectiveRenderProfile']()).toBe(false);
  });

  it('does not start planet transition when solar system id is missing', async () => {
    vi.useFakeTimers();
    const { component } = setup();
    const router = TestBed.inject(Router);

    component['onPlanetViewRequest']({
      id: 'earth',
      bodyType: 'planet',
      displayName: 'Earth',
      spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 1, y: 0, z: 0 }, epochMs: 0 },
    });
    await vi.advanceTimersByTimeAsync(160);

    expect(component['isPlanetTransitioning']()).toBe(false);
    expect((router as unknown as { navigate: ReturnType<typeof vi.fn> }).navigate).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
