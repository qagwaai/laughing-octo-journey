import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import {
  createMockSessionService,
  createMockSocketService,
  type MockSessionService,
  type MockSocketService,
} from '../../../testing';
import type { MarketSummary } from '../../model/market-list';
import { MARKET_LIST_BY_LOCATION_REQUEST_EVENT, MARKET_LIST_BY_LOCATION_RESPONSE_EVENT } from '../../model/market-list';
import { resolveJumpGateHops } from '../../model/math/jump-gate';
import { SHIP_LIST_REQUEST_EVENT, SHIP_LIST_RESPONSE_EVENT } from '../../model/ship-list';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';
import MarketHubPage from './market-hub';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

interface NavigationState {
  playerName?: string;
  joinCharacter?: { id: string; characterName: string };
}

function makeMockRouter(state: NavigationState | null = null) {
  return {
    getCurrentNavigation: () => (state ? { extras: { state } } : null),
    navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)),
  };
}

function setup(options: {
  socketService: MockSocketService;
  sessionService: MockSessionService;
  navigationState?: NavigationState;
}): { component: MarketHubPage; fixture: ComponentFixture<MarketHubPage> } {
  const router = makeMockRouter(options.navigationState ?? null);

  TestBed.configureTestingModule({
    imports: [MarketHubPage],
    providers: [
      { provide: SocketService, useValue: options.socketService },
      { provide: SessionService, useValue: options.sessionService },
      { provide: Router, useValue: router },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const fixture = TestBed.createComponent(MarketHubPage);
  fixture.detectChanges();
  return { component: fixture.componentInstance, fixture };
}

const SPATIAL_SOL = {
  solarSystemId: 'sol',
  frame: 'barycentric' as const,
  positionKm: { x: 413_700_020, y: 0, z: 0 },
  epochMs: 0,
};

const SPATIAL_SOL_DOCKED = {
  solarSystemId: 'sol',
  frame: 'barycentric' as const,
  positionKm: { x: 413_700_000, y: 0, z: 0 },
  epochMs: 0,
};

// ---------------------------------------------------------------------------
// Spec
// ---------------------------------------------------------------------------

describe('MarketHubPage', () => {
  let socketService: MockSocketService;
  let sessionService: MockSessionService;

  beforeEach(() => {
    socketService = createMockSocketService();
    socketService.connected = true;
    sessionService = createMockSessionService('session-key');
  });

  it('should create the component', () => {
    const { component } = setup({ socketService, sessionService });
    expect(component).toBeTruthy();
  });

  it('should initialize from navigation state', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer', joinCharacter: { id: 'c-1', characterName: 'Nova' } },
    });

    expect(component['playerName']()).toBe('Pioneer');
    expect(component['joinCharacter']()).toEqual({ id: 'c-1', characterName: 'Nova' });
  });

  it('should fallback to empty values', () => {
    const { component } = setup({ socketService, sessionService });
    expect(component['playerName']()).toBe('');
    expect(component['joinCharacter']()).toBeNull();
  });

  it('should emit market-list-request scoped to active ship solar system', () => {
    // No id on ship so shipId is omitted from request (matches original test intent)
    sessionService.activeShip.set({
      name: 'Pod',
      model: 'Scavenger Pod',
      tier: 1,
      status: 'docked',
      spatial: SPATIAL_SOL_DOCKED,
    } as any);

    setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer', joinCharacter: { id: 'c-1', characterName: 'Nova' } },
    });

    expect(socketService.emittedEvents.find((e) => e.event === MARKET_LIST_BY_LOCATION_REQUEST_EVENT)).toEqual({
      event: MARKET_LIST_BY_LOCATION_REQUEST_EVENT,
      data: {
        playerName: 'Pioneer',
        sessionKey: 'session-key',
        solarSystemId: 'sol',
        positionKm: { x: 413_700_000, y: 0, z: 0 },
        distanceAu: 0.5,
        limit: 50,
        locationTypes: ['station', 'free-floating'],
        characterId: 'c-1',
      },
    });
  });

  it('should request ship-list and hydrate active ship when active ship has no position', () => {
    // Provide spatial with origin position (real component computed crashes if spatial is absent)
    sessionService.activeShip.set({
      id: 'starter-pod-c-1',
      name: 'Pod',
      model: 'M',
      tier: 1,
      status: 'ACTIVE',
      spatial: { solarSystemId: 'sol', frame: 'barycentric' as const, positionKm: { x: 0, y: 0, z: 0 }, epochMs: 0 },
    });

    setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer', joinCharacter: { id: 'c-1', characterName: 'Nova' } },
    });

    expect(socketService.emittedEvents[0]).toEqual({
      event: SHIP_LIST_REQUEST_EVENT,
      data: { playerName: 'Pioneer', characterId: 'c-1', sessionKey: 'session-key' },
    });

    socketService.triggerEvent(SHIP_LIST_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      ships: [
        {
          id: 'starter-pod-c-1',
          name: 'Scavenger Pod',
          model: 'Scavenger Pod',
          tier: 1,
          status: 'docked',
          spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 100, y: 200, z: 300 }, epochMs: 0 },
        },
      ],
    });

    expect(sessionService.activeShip()?.spatial?.positionKm).toEqual({ x: 100, y: 200, z: 300 });
  });

  it('should request ship-list when active ship has placeholder origin position', () => {
    sessionService.activeShip.set({
      id: 'starter-pod-c-1',
      name: 'Pod',
      model: 'M',
      tier: 1,
      status: 'ACTIVE',
      spatial: { solarSystemId: 'sol', frame: 'barycentric' as const, positionKm: { x: 0, y: 0, z: 0 }, epochMs: 0 },
    });

    setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer', joinCharacter: { id: 'c-1', characterName: 'Nova' } },
    });

    expect(socketService.emittedEvents[0]).toEqual({
      event: SHIP_LIST_REQUEST_EVENT,
      data: { playerName: 'Pioneer', characterId: 'c-1', sessionKey: 'session-key' },
    });
  });

  it('should set an error when session key is missing', () => {
    const noKeySession = createMockSessionService(null);
    const { component } = setup({
      socketService,
      sessionService: noKeySession,
      navigationState: { playerName: 'Pioneer', joinCharacter: { id: 'c-1', characterName: 'Nova' } },
    });

    expect(component['marketListError']()).toBe('Session key is required to load markets.');
    expect(component['markets']()).toEqual([]);
  });

  it('should expose market list from successful response', () => {
    sessionService.activeShip.set({
      id: 'pod-1',
      name: 'Pod',
      model: 'M',
      tier: 1,
      status: 'docked',
      spatial: SPATIAL_SOL_DOCKED,
    });

    const { component } = setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer', joinCharacter: { id: 'c-1', characterName: 'Nova' } },
    });

    socketService.triggerEvent(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      isDocked: false,
      dockedMarketId: null,
      markets: [
        {
          marketId: 'sol-ceres-exchange',
          solarSystemId: 'sol',
          marketName: 'Ceres Exchange',
          siteType: 'station',
          siteName: 'Ceres Belt Trade Ring',
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: { x: 413_704_822, y: 0, z: 0 },
            epochMs: 1,
          },
          distanceAu: 0.032,
          isDocked: false,
          priceMultiplier: 1,
          driftPercentPerHour: 6,
          restockIntervalMinutes: 60,
        },
      ],
    });

    expect(component['marketListError']()).toBeNull();
    expect(component['markets']().length).toBe(1);
    expect(component['markets']()[0].marketId).toBe('sol-ceres-exchange');
  });

  it('should sort markets by authoritative distance from response', () => {
    sessionService.activeShip.set({
      id: 'pod-1',
      name: 'Pod',
      model: 'M',
      tier: 1,
      status: 'docked',
      spatial: {
        solarSystemId: 'sol',
        frame: 'barycentric' as const,
        positionKm: { x: 413_700_020, y: 0, z: 0 },
        epochMs: 0,
      },
    });

    const { component } = setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer', joinCharacter: { id: 'c-1', characterName: 'Nova' } },
    });

    socketService.triggerEvent(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      isDocked: false,
      dockedMarketId: null,
      markets: [
        {
          marketId: 'sol-far-exchange',
          solarSystemId: 'sol',
          marketName: 'Far Exchange',
          siteType: 'station',
          siteName: 'Far Ring',
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: { x: 413_709_520, y: 0, z: 0 },
            epochMs: 1,
          },
          distanceAu: 0.12,
          isDocked: false,
          priceMultiplier: 1,
          driftPercentPerHour: 6,
          restockIntervalMinutes: 60,
        },
        {
          marketId: 'sol-ceres-exchange',
          solarSystemId: 'sol',
          marketName: 'Ceres Exchange',
          siteType: 'station',
          siteName: 'Ceres Belt Trade Ring',
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: { x: 413_704_842, y: 0, z: 0 },
            epochMs: 1,
          },
          distanceAu: 0.04,
          isDocked: false,
          priceMultiplier: 1,
          driftPercentPerHour: 6,
          restockIntervalMinutes: 60,
        },
      ],
    });

    const sorted = component['localMarkets']();
    expect(sorted.length).toBe(2);
    expect(sorted[0].marketId).toBe('sol-ceres-exchange');
    expect(sorted[1].marketId).toBe('sol-far-exchange');

    const reachable = component['reachableMarkets']();
    expect(reachable[0].marketId).toBe('sol-ceres-exchange');
    expect(reachable[1].marketId).toBe('sol-far-exchange');
  });

  it('should request markets using selected radius even when it exceeds starter drive range', () => {
    sessionService.activeShip.set({
      id: 'pod-1',
      name: 'Pod',
      model: 'Scavenger Pod',
      tier: 1,
      status: 'docked',
      spatial: SPATIAL_SOL,
    });

    const { component } = setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer', joinCharacter: { id: 'c-1', characterName: 'Nova' } },
    });

    component['selectedRadiusAu'].set(10);
    component.loadNearbyMarkets();

    const request = socketService.emittedEvents[socketService.emittedEvents.length - 1];
    expect(request.event).toBe(MARKET_LIST_BY_LOCATION_REQUEST_EVENT);
    expect(request.data.distanceAu).toBe(10);
  });

  it('should allow sending an empty market type filter to the backend', () => {
    sessionService.activeShip.set({
      id: 'pod-1',
      name: 'Pod',
      model: 'M',
      tier: 1,
      status: 'docked',
      spatial: SPATIAL_SOL,
    });

    const { component } = setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer', joinCharacter: { id: 'c-1', characterName: 'Nova' } },
    });

    component['selectedLocationTypes'].set([]);
    component.loadNearbyMarkets();

    const request = socketService.emittedEvents[socketService.emittedEvents.length - 1];
    expect(request.data.locationTypes).toEqual([]);
  });

  it('should separate reachable and beyond-current-drive markets', () => {
    sessionService.activeShip.set({
      id: 'pod-1',
      name: 'Pod',
      model: 'M',
      tier: 1,
      status: 'docked',
      spatial: SPATIAL_SOL,
    });

    const { component } = setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer', joinCharacter: { id: 'c-1', characterName: 'Nova' } },
    });

    socketService.triggerEvent(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      isDocked: false,
      dockedMarketId: null,
      markets: [
        {
          marketId: 'sol-near-exchange',
          solarSystemId: 'sol',
          marketName: 'Near Exchange',
          siteType: 'station',
          siteName: 'Near Ring',
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: { x: 413_700_120, y: 0, z: 0 },
            epochMs: 1,
          },
          distanceAu: 0.2,
          isDocked: false,
          priceMultiplier: 1,
          driftPercentPerHour: 6,
          restockIntervalMinutes: 60,
        },
        {
          marketId: 'sol-far-exchange',
          solarSystemId: 'sol',
          marketName: 'Far Exchange',
          siteType: 'station',
          siteName: 'Far Ring',
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: { x: 413_709_520, y: 0, z: 0 },
            epochMs: 1,
          },
          distanceAu: 0.8,
          isDocked: false,
          priceMultiplier: 1,
          driftPercentPerHour: 6,
          restockIntervalMinutes: 60,
        },
        {
          marketId: 'ac-station',
          solarSystemId: 'alpha-centauri',
          marketName: 'Alpha Station',
          siteType: 'station',
          siteName: 'AC Hub',
          spatial: {
            solarSystemId: 'alpha-centauri',
            frame: 'barycentric',
            positionKm: { x: 0, y: 0, z: 0 },
            epochMs: 1,
          },
          isDocked: false,
          priceMultiplier: 1,
          driftPercentPerHour: 6,
          restockIntervalMinutes: 60,
          route: { kind: 'gate-route' as const, hops: 1 },
        },
        {
          marketId: 'wolf-outpost',
          solarSystemId: 'wolf-359',
          marketName: 'Wolf Outpost',
          siteType: 'station',
          siteName: 'Wolf Hub',
          spatial: { solarSystemId: 'wolf-359', frame: 'barycentric', positionKm: { x: 0, y: 0, z: 0 }, epochMs: 1 },
          isDocked: false,
          priceMultiplier: 1,
          driftPercentPerHour: 6,
          restockIntervalMinutes: 60,
          route: { kind: 'no-route' as const },
        },
      ],
    });

    expect(component['reachableMarkets']().map((m) => m.marketId)).toEqual(['sol-near-exchange', 'ac-station']);
    expect(component['outOfRangeMarkets']().map((m) => m.marketId)).toEqual(['sol-far-exchange', 'wolf-outpost']);
  });

  it('should use response docking state to enable transact only at docked market', () => {
    sessionService.activeShip.set({
      id: 'pod-1',
      name: 'Pod',
      model: 'M',
      tier: 1,
      status: 'in-flight',
      spatial: SPATIAL_SOL,
    });

    const { component } = setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer', joinCharacter: { id: 'c-1', characterName: 'Nova' } },
    });

    socketService.triggerEvent(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      isDocked: true,
      dockedMarketId: 'sol-ceres-exchange',
      markets: [
        {
          marketId: 'sol-ceres-exchange',
          solarSystemId: 'sol',
          marketName: 'Ceres Exchange',
          siteType: 'station',
          siteName: 'Ceres Belt Trade Ring',
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: { x: 413_700_022, y: 0, z: 0 },
            epochMs: 1,
          },
          distanceAu: 0.01,
          isDocked: true,
          priceMultiplier: 1,
          driftPercentPerHour: 6,
          restockIntervalMinutes: 60,
        },
        {
          marketId: 'sol-far-exchange',
          solarSystemId: 'sol',
          marketName: 'Far Exchange',
          siteType: 'station',
          siteName: 'Far Ring',
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: { x: 413_700_220, y: 0, z: 0 },
            epochMs: 1,
          },
          distanceAu: 0.2,
          isDocked: false,
          priceMultiplier: 1,
          driftPercentPerHour: 6,
          restockIntervalMinutes: 60,
        },
      ],
    });

    const sorted = component['localMarkets']();
    expect(component['canTransactAtMarket'](sorted[0])).toBeTrue();
    expect(component['canTransactAtMarket'](sorted[1])).toBeFalse();
  });

  it('should require docking for transact actions', () => {
    sessionService.activeShip.set({
      id: 'pod-1',
      name: 'Pod',
      model: 'M',
      tier: 1,
      status: 'in-flight',
      spatial: SPATIAL_SOL,
    });

    const { component } = setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer', joinCharacter: { id: 'c-1', characterName: 'Nova' } },
    });

    // Before server response: not docked
    expect(component['isDocked']()).toBeFalse();

    // Server reports docked
    socketService.triggerEvent(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      isDocked: true,
      dockedMarketId: 'sol-ceres-exchange',
      markets: [],
    });

    expect(component['isDocked']()).toBeTrue();

    // The response handler self-unsubscribes after firing (real component design).
    // Re-register by calling loadNearbyMarkets(), then trigger undocked response.
    component.loadNearbyMarkets();
    socketService.triggerEvent(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      isDocked: false,
      dockedMarketId: null,
      markets: [],
    });

    expect(component['isDocked']()).toBeFalse();
  });

  describe('marketRouteStatus — server-route precedence', () => {
    let component: MarketHubPage;

    beforeEach(() => {
      sessionService.activeShip.set({
        id: 'pod-1',
        name: 'Pod',
        model: 'M',
        tier: 1,
        status: 'ACTIVE',
        spatial: {
          solarSystemId: 'sol',
          frame: 'barycentric' as const,
          positionKm: { x: 100, y: 0, z: 0 },
          epochMs: 0,
        },
      });
      ({ component } = setup({
        socketService,
        sessionService,
        navigationState: { playerName: 'Pioneer', joinCharacter: { id: 'c-1', characterName: 'Nova' } },
      }));
    });

    it('uses server route kind when present — gate-route', () => {
      const market: MarketSummary = {
        marketId: 'ac-station',
        solarSystemId: 'alpha-centauri',
        marketName: 'Alpha Station',
        siteType: 'station',
        siteName: 'AC Hub',
        spatial: {
          solarSystemId: 'alpha-centauri',
          frame: 'barycentric',
          positionKm: { x: 0, y: 0, z: 0 },
          epochMs: 1,
        },
        distanceAu: undefined,
        isDocked: false,
        priceMultiplier: 1,
        driftPercentPerHour: 6,
        restockIntervalMinutes: 60,
        route: { kind: 'gate-route', hops: 1 },
      };

      expect(component['marketRouteStatus'](market)).toBe('gate-route');
      expect(component['marketRouteLabel'](market)).toBe('1 gate hop');
    });

    it('server no-route overrides BFS when BFS would return gate-route', () => {
      const market: MarketSummary = {
        marketId: 'ac-station',
        solarSystemId: 'alpha-centauri',
        marketName: 'Alpha Station',
        siteType: 'station',
        siteName: 'AC Hub',
        spatial: {
          solarSystemId: 'alpha-centauri',
          frame: 'barycentric',
          positionKm: { x: 0, y: 0, z: 0 },
          epochMs: 1,
        },
        distanceAu: undefined,
        isDocked: false,
        priceMultiplier: 1,
        driftPercentPerHour: 6,
        restockIntervalMinutes: 60,
        route: { kind: 'no-route' },
      };

      expect(resolveJumpGateHops('sol', 'alpha-centauri')).toBe(1);
      expect(component['marketRouteStatus'](market)).toBe('no-route');
      expect(component['marketRouteLabel'](market)).toBe('No route');
    });

    it('falls back to BFS when server route is absent', () => {
      const market: MarketSummary = {
        marketId: 'ac-station',
        solarSystemId: 'alpha-centauri',
        marketName: 'Alpha Station',
        siteType: 'station',
        siteName: 'AC Hub',
        spatial: {
          solarSystemId: 'alpha-centauri',
          frame: 'barycentric',
          positionKm: { x: 0, y: 0, z: 0 },
          epochMs: 1,
        },
        distanceAu: undefined,
        isDocked: false,
        priceMultiplier: 1,
        driftPercentPerHour: 6,
        restockIntervalMinutes: 60,
      };

      expect(component['marketRouteStatus'](market)).toBe('gate-route');
      expect(component['marketRouteLabel'](market)).toBe('1 gate hop');
    });

    it('uses server-provided hops count over BFS hops when both are available', () => {
      const market: MarketSummary = {
        marketId: 'bs-depot',
        solarSystemId: 'barnards-star',
        marketName: "Barnard's Depot",
        siteType: 'station',
        siteName: "Barnard's Freight",
        spatial: { solarSystemId: 'barnards-star', frame: 'barycentric', positionKm: { x: 0, y: 0, z: 0 }, epochMs: 1 },
        distanceAu: undefined,
        isDocked: false,
        priceMultiplier: 1,
        driftPercentPerHour: 10,
        restockIntervalMinutes: 120,
        route: { kind: 'gate-route', hops: 3 },
      };

      expect(resolveJumpGateHops('sol', 'barnards-star')).toBe(2);
      expect(component['resolvedGateHopsForMarket'](market)).toBe(3);
      expect(component['marketRouteLabel'](market)).toBe('3 gate hops');
    });

    it('uses in-system from server route even for cross-solarSystem id (unlikely but valid)', () => {
      const market: MarketSummary = {
        marketId: 'mystery-station',
        solarSystemId: 'unknown-system',
        marketName: 'Mystery Station',
        siteType: 'station',
        siteName: 'Mystery',
        spatial: {
          solarSystemId: 'unknown-system',
          frame: 'barycentric',
          positionKm: { x: 0, y: 0, z: 0 },
          epochMs: 1,
        },
        distanceAu: 0.4,
        isDocked: false,
        priceMultiplier: 1,
        driftPercentPerHour: 6,
        restockIntervalMinutes: 60,
        route: { kind: 'in-system' },
      };

      expect(component['marketRouteStatus'](market)).toBe('in-system');
      expect(component['marketRouteLabel'](market)).toBe('In-system');
    });
  });

  describe('DOM smoke tests', () => {
    it('should render the host element', () => {
      const { fixture } = setup({ socketService, sessionService });
      expect(fixture.nativeElement).toBeTruthy();
    });

    it('should show error message in template when session key is missing', () => {
      const noKeySession = createMockSessionService(null);
      const { fixture } = setup({
        socketService,
        sessionService: noKeySession,
        navigationState: { playerName: 'Pioneer', joinCharacter: { id: 'c-1', characterName: 'Nova' } },
      });
      fixture.detectChanges();
      const text: string = fixture.nativeElement.textContent ?? '';
      expect(text).toContain('Session key is required');
    });
  });
});
