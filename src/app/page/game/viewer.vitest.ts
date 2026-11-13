import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockSessionService,
  createMockSocketService,
  type MockSessionService,
  type MockSocketService,
} from '../../../testing';
import { SOLAR_SYSTEM_LIST_REQUEST_EVENT, SOLAR_SYSTEM_LIST_RESPONSE_EVENT } from '../../model/solar-system-list';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';
import { ViewerTargetService } from '../../services/viewer-target.service';
import ViewerPage from './viewer';

function setup(options: {
  socketService: MockSocketService;
  sessionService: MockSessionService;
  navigationState?: Record<string, unknown>;
}) {
  const viewerTargetService = {
    clearTarget: vi.fn(),
  };

  const mockRouter = {
    getCurrentNavigation: () => (options.navigationState ? { extras: { state: options.navigationState } } : null),
    navigate: vi.fn(),
  };

  TestBed.configureTestingModule({
    imports: [ViewerPage],
    providers: [
      { provide: SocketService, useValue: options.socketService },
      { provide: SessionService, useValue: options.sessionService },
      { provide: ViewerTargetService, useValue: viewerTargetService },
      { provide: Router, useValue: mockRouter },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const fixture = TestBed.createComponent(ViewerPage);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, mockRouter, viewerTargetService };
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
      expect.objectContaining({ playerName: 'Pioneer', sessionKey: 'test-session-key', limit: 10 }),
    );
  });

  it('populates solar systems on successful response', () => {
    const { component, fixture } = setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer' },
    });

    const listRequest = socketService.emittedEvents[0].data as {
      correlationId?: string;
      requestIdentity?: unknown;
    };

    socketService.triggerEvent(SOLAR_SYSTEM_LIST_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      correlationId: listRequest.correlationId!,
      requestIdentity: listRequest.requestIdentity!,
      solarSystems: [
        { id: 'sol', displayName: 'Sol', source: 'curated', distanceParsec: 0 },
        { id: 'alpha-cen', displayName: 'Alpha Centauri', source: 'curated', distanceParsec: 1.34 },
      ],
    });
    fixture.detectChanges();

    expect(component['solarSystems']().length).toBe(2);
    expect(component['isLoading']()).toBe(false);
    expect(component['listError']()).toBeNull();
  });

  it('renders an error when the response indicates failure', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer' },
    });

    const listRequest = socketService.emittedEvents[0].data as {
      correlationId?: string;
      requestIdentity?: unknown;
    };

    socketService.triggerEvent(SOLAR_SYSTEM_LIST_RESPONSE_EVENT, {
      success: false,
      message: 'backend-down',
      correlationId: listRequest.correlationId!,
      requestIdentity: listRequest.requestIdentity!,
      solarSystems: [],
    });

    expect(component['listError']()).toContain('backend-down');
    expect(component['solarSystems']().length).toBe(0);
  });

  it('sets missing-session error when session key is absent', () => {
    const { component } = setup({
      socketService,
      sessionService: createMockSessionService(null),
      navigationState: { playerName: 'Pioneer' },
    });

    expect(component['listError']()).toContain('missing-session');
    expect(component['solarSystems']()).toEqual([]);
    expect(socketService.emittedEvents.length).toBe(0);
  });

  it('sets missing-session error when player name is absent', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {},
    });

    expect(component['listError']()).toContain('missing-session');
    expect(component['solarSystems']()).toEqual([]);
    expect(socketService.emittedEvents.length).toBe(0);
  });

  it('falls back to an empty list when successful response omits solarSystems', () => {
    const { component, fixture } = setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer' },
    });

    const listRequest = socketService.emittedEvents[0].data as {
      correlationId?: string;
      requestIdentity?: unknown;
    };

    socketService.triggerEvent(SOLAR_SYSTEM_LIST_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      correlationId: listRequest.correlationId!,
      requestIdentity: listRequest.requestIdentity!,
    });
    fixture.detectChanges();

    expect(component['solarSystems']()).toEqual([]);
    expect(component['listError']()).toBeNull();
  });

  it('navigates to details + scene outlets when a system is selected', () => {
    const { component, mockRouter, viewerTargetService } = setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer' },
    });
    const system = { id: 'sol', displayName: 'Sol', settlementName: null, aliases: [], source: 'curated' as const };
    component['selectSystem'](system);

    expect(mockRouter.navigate).toHaveBeenCalled();
    expect(viewerTargetService.clearTarget).toHaveBeenCalled();
    expect(component['selectedSystemId']()).toBe('sol');
    const args = mockRouter.navigate.mock.calls.at(-1)!;
    expect(args[0]).toEqual([{ outlets: { left: ['solar-system-details', 'sol'], right: ['viewer-scene', 'sol'] } }]);
    expect(args[1].state).toEqual(expect.objectContaining({ solarSystem: system, playerName: 'Pioneer' }));
  });

  it('does not inject a local Cygnus X-1 entry; the list contains only server results', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer' },
    });
    expect(component['displayedSolarSystems']()).toEqual([]);
    const listRequest = socketService.emittedEvents.find((entry) => entry.event === SOLAR_SYSTEM_LIST_REQUEST_EVENT)
      ?.data as Record<string, unknown>;
    expect(listRequest).toEqual(
      expect.objectContaining({ limit: 10, offset: 0, maxDistanceParsec: 50, sort: 'distance' }),
    );
  });

  describe('paged discovery', () => {
    type ListRequest = Record<string, unknown> & { correlationId: string; requestIdentity: unknown };
    const listRequests = () =>
      socketService.emittedEvents
        .filter((entry) => entry.event === SOLAR_SYSTEM_LIST_REQUEST_EVENT)
        .map((entry) => entry.data as ListRequest);
    const system = (id: string, distanceParsec = 1) => ({
      id,
      displayName: id,
      source: 'curated' as const,
      distanceParsec,
    });
    const respond = (request: ListRequest, page: Record<string, unknown>) =>
      socketService.triggerEvent(SOLAR_SYSTEM_LIST_RESPONSE_EVENT, {
        success: true,
        correlationId: request.correlationId,
        requestIdentity: request.requestIdentity,
        ...page,
      });

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('loads the next page from offset + effective limit and reports N of total', () => {
      const { component } = setup({ socketService, sessionService, navigationState: { playerName: 'Pioneer' } });
      respond(listRequests()[0], {
        solarSystems: [system('a'), system('b')],
        total: 3,
        offset: 0,
        limit: 2,
        hasMore: true,
      });
      expect(component['resultCountText']()).toBe('2 of 3 systems within 50 parsecs');

      component['loadMore']();
      component['loadMore']();
      expect(listRequests()).toHaveLength(2);
      expect(listRequests()[1]).toEqual(expect.objectContaining({ offset: 2, limit: 10 }));

      respond(listRequests()[1], {
        solarSystems: [system('b'), system('c')],
        total: 3,
        offset: 2,
        limit: 2,
        hasMore: false,
      });
      expect(component['solarSystems']().map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
      expect(component['hasMore']()).toBe(false);
      expect(component['resultCountText']()).toBe('3 of 3 systems within 50 parsecs');
    });

    it('uses the active maximum distance and omits it for all-distance searches', () => {
      const { component } = setup({ socketService, sessionService, navigationState: { playerName: 'Pioneer' } });
      respond(listRequests()[0], {
        solarSystems: [system('a')],
        total: 3,
        offset: 0,
        limit: 10,
        hasMore: false,
      });
      expect(component['resultCountText']()).toBe('1 of 3 systems within 50 parsecs');

      component['onMaxDistanceChange']('12.5');
      const maxDistanceRequest = listRequests()[1];
      respond(maxDistanceRequest, {
        solarSystems: [system('a')],
        total: 1,
        offset: 0,
        limit: 10,
        hasMore: false,
      });
      expect(component['resultCountText']()).toBe('1 of 1 systems within 12.5 parsecs');

      component['onSearchInput']('55 Cnc');
      vi.advanceTimersByTime(300);
      const searchRequest = listRequests()[2];
      expect(searchRequest).not.toHaveProperty('maxDistanceParsec');
      respond(searchRequest, {
        solarSystems: [system('a')],
        total: 1,
        offset: 0,
        limit: 10,
        hasMore: false,
      });
      expect(component['resultCountText']()).toBe('1 of 1 systems');
    });

    it('debounces short CJK substring searches across all distances without folding', () => {
      const { component } = setup({ socketService, sessionService, navigationState: { playerName: 'Pioneer' } });
      respond(listRequests()[0], { solarSystems: [system('a')], total: 1, offset: 0, limit: 10, hasMore: false });

      component['onSearchInput']('星');
      vi.advanceTimersByTime(400);
      expect(listRequests()).toHaveLength(2);
      expect(listRequests()[1]['search']).toBe('星');

      component['onSearchInput']('星空');
      component['onSearchInput']('星河');
      vi.advanceTimersByTime(299);
      expect(listRequests()).toHaveLength(2);
      vi.advanceTimersByTime(1);
      expect(listRequests()).toHaveLength(3);
      const searchRequest = listRequests()[2];
      expect(searchRequest).toEqual(expect.objectContaining({ search: '星河', offset: 0 }));
      expect(searchRequest).not.toHaveProperty('maxDistanceParsec');
      expect(searchRequest).not.toHaveProperty('minDistanceParsec');
    });

    it('resets to offset 0 on every filter or sort change and ignores replies from superseded queries', () => {
      const { component } = setup({ socketService, sessionService, navigationState: { playerName: 'Pioneer' } });
      const first = listRequests()[0];
      respond(first, { solarSystems: [system('a')], total: 9, offset: 0, limit: 1, hasMore: true });
      component['loadMore']();
      const staleLoadMore = listRequests()[1];

      component['onSortChange']('name');
      component['onSourceChange']('exoplanet-catalog');
      component['onSpectralClassChange']('G');
      component['onHasPlanetsChange'](true);
      component['onMaxDistanceChange']('120');
      component['onMinDistanceChange']('10');
      const latest = listRequests().at(-1)!;
      expect(latest).toEqual(
        expect.objectContaining({
          offset: 0,
          sort: 'name',
          source: 'exoplanet-catalog',
          spectralClass: 'G',
          minPlanetCount: 1,
          maxDistanceParsec: 120,
          minDistanceParsec: 10,
        }),
      );

      respond(staleLoadMore, { solarSystems: [system('stale')], total: 9, offset: 1, limit: 1, hasMore: true });
      expect(component['solarSystems']()).toEqual([]);

      respond(latest, { solarSystems: [system('fresh')], total: 1, offset: 0, limit: 10, hasMore: false });
      expect(component['solarSystems']().map((entry) => entry.id)).toEqual(['fresh']);
    });

    it('keeps loaded rows and shows the server message when load more fails', () => {
      const { component } = setup({ socketService, sessionService, navigationState: { playerName: 'Pioneer' } });
      respond(listRequests()[0], { solarSystems: [system('a')], total: 2, offset: 0, limit: 1, hasMore: true });
      component['loadMore']();
      respond(listRequests()[1], { success: false, message: 'limit must be a positive integer when provided' });

      expect(component['solarSystems']().map((entry) => entry.id)).toEqual(['a']);
      expect(component['loadMoreError']()).toContain('limit must be a positive integer when provided');
      expect(component['hasMore']()).toBe(true);
    });

    it('shows approximate distances with a marker', () => {
      const { component } = setup({ socketService, sessionService, navigationState: { playerName: 'Pioneer' } });
      expect(component['formatDistance'](848.25, true)).toBe('≈848.25');
    });

    it('shows the catalog snapshot date on the system name hover title only when available', () => {
      const { fixture } = setup({ socketService, sessionService, navigationState: { playerName: 'Pioneer' } });
      respond(listRequests()[0], {
        solarSystems: [
          { ...system('exo-55-cnc'), source: 'exoplanet-catalog', catalogSnapshotDate: '2026-11-01' },
          system('sol'),
        ],
        total: 2,
        offset: 0,
        limit: 10,
        hasMore: false,
      });
      fixture.detectChanges();
      const names = fixture.nativeElement.querySelectorAll('.solar-system-item__name');
      expect(names[0].getAttribute('title')).toBe('Data as of 2026-11-01');
      expect(names[1].hasAttribute('title')).toBe(false);
      expect(fixture.nativeElement.querySelector('[data-testid="viewer-system-data-as-of"]')).toBeNull();
    });

    it('shows primary star color with travel distance and market cues', () => {
      const { fixture } = setup({ socketService, sessionService, navigationState: { playerName: 'Pioneer' } });
      respond(listRequests()[0], {
        solarSystems: [
          {
            ...system('sol', 0),
            primaryStar: { hygId: 'sun', spectralClass: 'G', colorHex: '#ffe680' },
            marketCount: 14,
          },
        ],
        total: 1,
        offset: 0,
        limit: 10,
        hasMore: false,
      });
      fixture.detectChanges();

      const marker = fixture.nativeElement.querySelector(
        '[data-testid="viewer-system-star-marker"]',
      ) as HTMLElement;
      const distance = fixture.nativeElement.querySelector('[data-testid="viewer-system-distance"]') as HTMLElement;
      const markets = fixture.nativeElement.querySelector('[data-testid="viewer-system-markets"]') as HTMLElement;
      expect(marker.style.getPropertyValue('--star-color')).toBe('#ffe680');
      expect(distance.textContent).toContain('0.00');
      expect(distance.textContent).toContain('pc');
      expect(markets.textContent).toContain('14');
    });

    it('uses a distinct accessible icon for each system source', () => {
      const { fixture } = setup({ socketService, sessionService, navigationState: { playerName: 'Pioneer' } });
      respond(listRequests()[0], {
        solarSystems: [
          { ...system('curated'), source: 'curated' },
          { ...system('procedural'), source: 'procedural' },
          { ...system('exoplanet-catalog'), source: 'exoplanet-catalog' },
        ],
        total: 3,
        offset: 0,
        limit: 10,
        hasMore: false,
      });
      fixture.detectChanges();

      const sourceIcons = Array.from(
        fixture.nativeElement.querySelectorAll('[data-testid="viewer-system-source"]'),
      ) as HTMLElement[];
      expect(sourceIcons.map((icon) => icon.dataset['source'])).toEqual([
        'curated',
        'procedural',
        'exoplanet-catalog',
      ]);
      expect(sourceIcons.map((icon) => icon.getAttribute('aria-label'))).toEqual([
        'Curated',
        'Procedural',
        'Exoplanet catalog',
      ]);
      expect(sourceIcons.every((icon) => icon.querySelector('svg') !== null)).toBe(true);
    });
  });

  it('formats non-finite and finite distances', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer' },
    });

    expect(component['formatDistance'](undefined)).toBe('—');
    expect(component['formatDistance'](Number.NaN)).toBe('—');
    expect(component['formatDistance'](1.236)).toBe('1.24');
  });

  it('reports unlock predicate as true for all characters in the MVP', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer' },
    });
    expect(component['isViewerUnlocked']()).toBe(true);
  });
});
