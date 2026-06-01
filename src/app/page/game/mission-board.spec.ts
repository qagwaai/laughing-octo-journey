import { CUSTOM_ELEMENTS_SCHEMA, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import {
  createMockSessionService,
  createMockSocketService,
  type MockSessionService,
  type MockSocketService,
} from '../../../testing';
import { serializeMissionGateState } from '../../mission/ship-exterior-mission';
import { SessionService } from '../../services/session.service';
import { ShipExteriorMissionStateService } from '../../services/ship-exterior-mission-state.service';
import { SocketService } from '../../services/socket.service';
import MissionBoardPage from './mission-board';

const MISSION_LIST_REQUEST_EVENT = 'list-missions-request';
const MISSION_LIST_RESPONSE_EVENT = 'list-missions-response';

function createMockMissionStateService() {
  return {
    lastSaved: signal<any>(null),
    loadState: () => null,
    saveState: () => {},
  };
}

function setup(options: {
  socketService: MockSocketService;
  sessionService: MockSessionService;
  navigationState?: Record<string, unknown>;
  connected?: boolean;
  outlet?: string;
  queryParams?: Record<string, string>;
}) {
  TestBed.resetTestingModule();

  const queryParamMap = convertToParamMap(options.queryParams ?? {});
  const mockRouter = {
    getCurrentNavigation: () => (options.navigationState ? { extras: { state: options.navigationState } } : null),
    navigate: jasmine.createSpy('navigate'),
  };

  options.socketService.connected = options.connected ?? false;

  TestBed.configureTestingModule({
    imports: [MissionBoardPage],
    providers: [
      { provide: SocketService, useValue: options.socketService },
      { provide: SessionService, useValue: options.sessionService },
      { provide: Router, useValue: mockRouter },
      {
        provide: ActivatedRoute,
        useValue: {
          outlet: options.outlet ?? 'left',
          snapshot: {
            queryParamMap,
          },
        },
      },
      { provide: ShipExteriorMissionStateService, useValue: createMockMissionStateService() },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const fixture = TestBed.createComponent(MissionBoardPage);
  fixture.detectChanges();
  const component = fixture.componentInstance;

  return { component, fixture, mockRouter };
}

describe('MissionBoardPage', () => {
  let socketService: MockSocketService;
  let sessionService: MockSessionService;

  beforeEach(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.clear();
    }

    socketService = createMockSocketService();
    sessionService = createMockSessionService('test-session-key');
  });

  it('should initialize from navigation state and request missions when connected', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
      connected: true,
    });

    expect(component['playerName']()).toBe('Pioneer');
    expect(component['joinCharacter']()).toEqual({ id: 'c-1', characterName: 'Nova' });
    expect(socketService.emittedEvents[0]).toEqual({
      event: MISSION_LIST_REQUEST_EVENT,
      data: jasmine.objectContaining({
        playerName: 'Pioneer',
        characterId: 'c-1',
        sessionKey: 'test-session-key',
        correlationId: jasmine.any(String),
        correlationSource: 'mission-board-service.listMissions',
        requestIdentity: {
          operation: 'mission-list',
          entityType: 'mission',
          containerId: 'c-1',
        },
      }),
    });
  });

  it('should request missions when connect event fires for initially disconnected socket', () => {
    setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
      connected: false,
    });

    expect(socketService.emittedEvents.length).toBe(0);
    socketService.triggerOnceEvent('connect');
    expect(socketService.emittedEvents[0].event).toBe(MISSION_LIST_REQUEST_EVENT);
  });

  it('should set validation error when playerName is missing', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: '   ',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
      connected: true,
    });

    expect(component['missionListError']()).toBe('Player name is required to load missions.');
    expect(component['missions']()).toEqual([]);
    expect(socketService.emittedEvents.length).toBe(0);
  });

  it('should set validation error when character id is missing', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: '', characterName: 'Nova' },
      },
      connected: true,
    });

    expect(component['missionListError']()).toBe('Character id is required to load missions.');
    expect(component['missions']()).toEqual([]);
    expect(socketService.emittedEvents.length).toBe(0);
  });

  it('should set validation error when session key is missing', () => {
    const { component } = setup({
      socketService,
      sessionService: createMockSessionService(null),
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
      connected: true,
    });

    expect(component['missionListError']()).toBe('Session key is required to load missions.');
    expect(component['missions']()).toEqual([]);
    expect(socketService.emittedEvents.length).toBe(0);
  });

  it('should populate missions on successful response', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
      connected: true,
    });
    const requestPayload = socketService.emittedEvents[socketService.emittedEvents.length - 1].data as {
      correlationId?: string;
      requestIdentity?: unknown;
    };

    socketService.triggerEvent(MISSION_LIST_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      correlationId: requestPayload.correlationId!,
      requestIdentity: requestPayload.requestIdentity!,
      missions: [
        { missionId: 'first-target', status: 'active', startedAt: '2026-04-01T10:00:00Z' },
        { missionId: 'second-mission', status: 'completed', updatedAt: '2026-04-10T12:00:00Z' },
      ],
    });

    expect(component['isLoadingMissions']()).toBe(false);
    expect(component['missionListError']()).toBeNull();
    expect(component['missions']().length).toBe(2);
  });

  it('should set error and clear missions on failed response', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
      connected: true,
    });
    const requestPayload = socketService.emittedEvents[socketService.emittedEvents.length - 1].data as {
      correlationId?: string;
      requestIdentity?: unknown;
    };

    socketService.triggerEvent(MISSION_LIST_RESPONSE_EVENT, {
      success: false,
      message: 'Character not found',
      correlationId: requestPayload.correlationId!,
      requestIdentity: requestPayload.requestIdentity!,
      missions: [],
    });

    expect(component['isLoadingMissions']()).toBe(false);
    expect(component['missionListError']()).toBe('Character not found');
    expect(component['missions']()).toEqual([]);
  });

  it('should keep listener subscribed after receiving a response', () => {
    const {} = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
      connected: true,
    });

    socketService.triggerEvent(MISSION_LIST_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      missions: [],
    });

    expect(socketService.registeredListeners.has(MISSION_LIST_RESPONSE_EVENT)).toBe(true);
  });

  it('should set isLoadingMissions true while waiting for response', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
      connected: true,
    });

    expect(component['isLoadingMissions']()).toBe(true);
  });

  it('should format ISO date to YYYY-MM-DD', () => {
    const { component } = setup({ socketService, sessionService });

    expect(component['formatDate']('2026-04-21T08:30:00.000Z')).toBe('2026-04-21');
    expect(component['formatDate']('2026-01-05T00:00:00Z')).toBe('2026-01-05');
  });

  it('should return dash for missing date', () => {
    const { component } = setup({ socketService, sessionService });

    expect(component['formatDate'](undefined)).toBe('—');
    expect(component['formatDate']('')).toBe('—');
  });

  it('should navigate to character-profile with state', () => {
    const character = { id: 'c-1', characterName: 'Nova' };
    const { component, mockRouter } = setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer', joinCharacter: character },
    });

    component.navigateToCharacterProfile();

    expect(mockRouter.navigate).toHaveBeenCalledWith([{ outlets: { left: ['character-profile'] } }], {
      preserveFragment: true,
      state: {
        playerName: 'Pioneer',
        joinCharacter: character,
      },
    });
  });

  it('should clean up listener on ngOnDestroy', () => {
    const { fixture } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
      connected: true,
    });

    expect(socketService.registeredListeners.has(MISSION_LIST_RESPONSE_EVENT)).toBe(true);

    fixture.destroy();

    expect(socketService.registeredListeners.has(MISSION_LIST_RESPONSE_EVENT)).toBe(false);
  });

  it('computes available and locked catalog missions from completed prerequisites', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
    });

    component['missions'].set([{ missionId: 'first-target', status: 'completed' } as any]);

    const availableIds = component['availableCatalogMissions']().map((mission) => mission.id);
    const lockedIds = component['lockedCatalogMissions']().map((mission) => mission.id);

    expect(availableIds).toContain('m-01');
    expect(lockedIds).toContain('m-02');
  });

  it('maps canonical status for non-ship mission types', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
    });

    const displayStatus = component.getMissionDisplayStatus({
      missionId: 'm-01',
      status: 'available',
    } as any);

    expect(displayStatus).toBe('available');
  });

  it('maps canonical active and completed statuses for non-ship mission types', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
    });

    const activeStatus = component.getMissionDisplayStatus({
      missionId: 'custom-active',
      status: 'active',
    } as any);
    const completedStatus = component.getMissionDisplayStatus({
      missionId: 'custom-completed',
      status: 'completed',
    } as any);

    expect(activeStatus).toBe('active');
    expect(completedStatus).toBe('completed');
  });

  it('returns contract-violation for unknown non-ship mission statuses', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
    });

    const displayStatus = component.getMissionDisplayStatus({
      missionId: 'm-01',
      status: 'abandoned',
    } as any);

    expect(displayStatus).toBe('contract-violation');
  });

  it('maps contract violation status to a visible UI label', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
    });

    const label = component.getMissionDisplayStatusLabel({
      missionId: 'm-01',
      status: 'abandoned',
    } as any);

    expect(label).toBe('Contract Violation');
  });

  it('hydrates lane filter state from missionStatusFilter query param', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
      queryParams: {
        missionStatusFilter: 'completed',
      },
    });

    expect(component['selectedLaneFilter']()).toBe('completed');
  });

  it('persists lane filter updates to route query params', () => {
    const character = { id: 'c-1', characterName: 'Nova' };
    const { component, mockRouter } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: character,
      },
    });

    component.setMissionLaneFilter('active');

    expect(mockRouter.navigate).toHaveBeenCalledWith([], {
      relativeTo: jasmine.anything(),
      queryParams: {
        missionStatusFilter: 'active',
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
      preserveFragment: true,
    });
  });

  it('keeps unknown statuses out of canonical lane counts', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
    });

    component['missions'].set([
      { missionId: 'custom-active', status: 'active' },
      { missionId: 'custom-completed', status: 'completed' },
      { missionId: 'custom-unknown', status: 'abandoned' },
    ] as any);

    expect(component.getMissionLaneCount('available')).toBe(0);
    expect(component.getMissionLaneCount('active')).toBe(1);
    expect(component.getMissionLaneCount('completed')).toBe(1);
    expect(component['visibleUnknownStatusViolations']().length).toBe(1);
  });

  it('returns mission title fallback when mission id is unknown', () => {
    const { component } = setup({ socketService, sessionService });

    expect(component.getMissionTitle('unknown-mission')).toBe('unknown-mission');
  });

  it('returns mission type labels for main and side missions', () => {
    const { component } = setup({ socketService, sessionService });

    expect(component.getMissionTypeLabel('main')).toBe('Main');
    expect(component.getMissionTypeLabel('side')).toBe('Side Quest');
  });

  it('showGuardedMenu is true for left outlet', () => {
    const { component } = setup({ socketService, sessionService, outlet: 'left' });

    expect(component['showGuardedMenu']()).toBeTrue();
  });

  it('showGuardedMenu is false for right outlet', () => {
    const { component } = setup({ socketService, sessionService, outlet: 'right' });

    expect(component['showGuardedMenu']()).toBeFalse();
  });

  describe('getMissionStageInfo', () => {
    it('should return initial stage when statusDetail is absent', () => {
      const { component } = setup({
        socketService,
        sessionService,
        navigationState: {
          playerName: 'Pioneer',
          joinCharacter: { id: 'c-1', characterName: 'Nova' },
        },
      });

      const result = component.getMissionStageInfo({
        missionId: 'first-target',
        status: 'active',
      });
      expect(result).not.toBeNull();
      expect(result.stage).toBe('Stage 1 of 4');
    });

    it('should return initial stage when statusDetail is not parseable gate state', () => {
      const { component } = setup({
        socketService,
        sessionService,
        navigationState: {
          playerName: 'Pioneer',
          joinCharacter: { id: 'c-1', characterName: 'Nova' },
        },
      });

      const result = component.getMissionStageInfo({
        missionId: 'first-target',
        status: 'active',
        statusDetail: 'not-json',
      });
      expect(result).not.toBeNull();
      expect(result.stage).toBe('Stage 1 of 4');
    });

    it('should return Stage 1 of 4 when first step is active', () => {
      const { component } = setup({
        socketService,
        sessionService,
        navigationState: {
          playerName: 'Pioneer',
          joinCharacter: { id: 'c-1', characterName: 'Nova' },
        },
      });
      const gateState = {
        missionId: 'first-target',
        characterId: 'c-1',
        activeObjectiveText: 'Objective: Identify an Iron asteroid via full scan.',
        updatedAt: '2026-04-01T10:00:00Z',
        steps: [
          { key: 'identify_iron_asteroid', status: 'active' as const },
          { key: 'neutralize_identified_asteroid', status: 'locked' as const },
          { key: 'manufacture_hull_patch_kit', status: 'locked' as const },
          { key: 'repair_scavenger_pod', status: 'locked' as const },
        ],
      };
      const result = component.getMissionStageInfo({
        missionId: 'first-target',
        status: 'active',
        statusDetail: serializeMissionGateState(gateState),
      });
      expect(result).not.toBeNull();
      expect(result.stage).toBe('Stage 1 of 4');
      expect(result.nextStep).toBe('Objective: Identify an Iron asteroid via full scan.');
    });

    it('should return Stage 2 of 4 when second step is active', () => {
      const { component } = setup({
        socketService,
        sessionService,
        navigationState: {
          playerName: 'Pioneer',
          joinCharacter: { id: 'c-1', characterName: 'Nova' },
        },
      });
      const gateState = {
        missionId: 'first-target',
        characterId: 'c-1',
        activeObjectiveText: 'Objective unlocked: Neutralize the identified asteroid using a launchable payload.',
        updatedAt: '2026-04-02T10:00:00Z',
        steps: [
          { key: 'identify_iron_asteroid', status: 'completed' as const },
          { key: 'neutralize_identified_asteroid', status: 'active' as const },
          { key: 'manufacture_hull_patch_kit', status: 'locked' as const },
          { key: 'repair_scavenger_pod', status: 'locked' as const },
        ],
      };
      const result = component.getMissionStageInfo({
        missionId: 'first-target',
        status: 'active',
        statusDetail: serializeMissionGateState(gateState),
      });
      expect(result).not.toBeNull();
      expect(result.stage).toBe('Stage 2 of 4');
      expect(result.nextStep).toBe(
        'Objective unlocked: Neutralize the identified asteroid using a launchable payload.',
      );
    });

    it('should return Stage 3 of 4 when third step is active', () => {
      const { component } = setup({
        socketService,
        sessionService,
        navigationState: {
          playerName: 'Pioneer',
          joinCharacter: { id: 'c-1', characterName: 'Nova' },
        },
      });
      const gateState = {
        missionId: 'first-target',
        characterId: 'c-1',
        activeObjectiveText:
          'Objective unlocked: Manufacture a Hull Patch Kit at the Fabrication Lab (requires 1 iron).',
        updatedAt: '2026-04-03T10:00:00Z',
        steps: [
          { key: 'identify_iron_asteroid', status: 'completed' as const },
          { key: 'neutralize_identified_asteroid', status: 'completed' as const },
          { key: 'manufacture_hull_patch_kit', status: 'active' as const },
          { key: 'repair_scavenger_pod', status: 'locked' as const },
        ],
      };
      const result = component.getMissionStageInfo({
        missionId: 'first-target',
        status: 'active',
        statusDetail: serializeMissionGateState(gateState),
      });
      expect(result).not.toBeNull();
      expect(result.stage).toBe('Stage 3 of 4');
      expect(result.nextStep).toBe(
        'Objective unlocked: Manufacture a Hull Patch Kit at the Fabrication Lab (requires 1 iron).',
      );
    });

    it('should return Stage 4 of 4 when fourth step is active', () => {
      const { component } = setup({
        socketService,
        sessionService,
        navigationState: {
          playerName: 'Pioneer',
          joinCharacter: { id: 'c-1', characterName: 'Nova' },
        },
      });
      const gateState = {
        missionId: 'first-target',
        characterId: 'c-1',
        activeObjectiveText: 'Objective unlocked: Repair the Scavenger Pod at the Repair & Retrofit station.',
        updatedAt: '2026-04-04T10:00:00Z',
        steps: [
          { key: 'identify_iron_asteroid', status: 'completed' as const },
          { key: 'neutralize_identified_asteroid', status: 'completed' as const },
          { key: 'manufacture_hull_patch_kit', status: 'completed' as const },
          { key: 'repair_scavenger_pod', status: 'active' as const },
        ],
      };
      const result = component.getMissionStageInfo({
        missionId: 'first-target',
        status: 'active',
        statusDetail: serializeMissionGateState(gateState),
      });
      expect(result).not.toBeNull();
      expect(result.stage).toBe('Stage 4 of 4');
      expect(result.nextStep).toBe('Objective unlocked: Repair the Scavenger Pod at the Repair & Retrofit station.');
    });

    it('should return Stage 4 of 4 — Complete when all steps are complete', () => {
      const { component } = setup({
        socketService,
        sessionService,
        navigationState: {
          playerName: 'Pioneer',
          joinCharacter: { id: 'c-1', characterName: 'Nova' },
        },
      });
      const gateState = {
        missionId: 'first-target',
        characterId: 'c-1',
        activeObjectiveText: 'Mission objectives complete. Await further directives.',
        updatedAt: '2026-04-05T10:00:00Z',
        steps: [
          { key: 'identify_iron_asteroid', status: 'completed' as const },
          { key: 'neutralize_identified_asteroid', status: 'completed' as const },
          { key: 'manufacture_hull_patch_kit', status: 'completed' as const },
          { key: 'repair_scavenger_pod', status: 'completed' as const },
        ],
      };
      const result = component.getMissionStageInfo({
        missionId: 'first-target',
        status: 'completed',
        statusDetail: serializeMissionGateState(gateState),
      });
      expect(result).not.toBeNull();
      expect(result.stage).toBe('Stage 4 of 4 — Complete');
      expect(result.nextStep).toBe('Mission objectives complete. Await further directives.');
    });
  });

  describe('DOM smoke tests', () => {
    it('should render the page container without error', () => {
      const { fixture } = setup({ socketService, sessionService });
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.ops-page-container')).toBeTruthy();
    });

    it('should render guarded left menu in left mission board outlet', () => {
      const { fixture } = setup({ socketService, sessionService });
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;

      expect(el.querySelector('app-guarded-left-menu')).not.toBeNull();
    });

    it('should render character and ship badge only in left mission board outlet', () => {
      const { fixture: leftFixture } = setup({ socketService, sessionService, outlet: 'left' });
      leftFixture.detectChanges();
      const leftEl: HTMLElement = leftFixture.nativeElement;
      expect(leftEl.querySelector('app-character-ship-badge')).not.toBeNull();

      const { fixture: rightFixture } = setup({ socketService, sessionService, outlet: 'right' });
      rightFixture.detectChanges();
      const rightEl: HTMLElement = rightFixture.nativeElement;
      expect(rightEl.querySelector('app-character-ship-badge')).toBeNull();
    });

    it('should not render guarded left menu in right mission board outlet', () => {
      const { fixture } = setup({ socketService, sessionService, outlet: 'right' });
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;

      expect(el.querySelector('app-guarded-left-menu')).toBeNull();
    });

    it('should show error message when mission load fails', () => {
      const { fixture, component } = setup({
        socketService,
        sessionService,
        navigationState: {
          playerName: 'Pioneer',
          joinCharacter: { id: 'c-1', characterName: 'Nova' },
        },
        connected: true,
      });
      const requestPayload = socketService.emittedEvents[socketService.emittedEvents.length - 1].data as {
        correlationId?: string;
        requestIdentity?: unknown;
      };

      socketService.triggerEvent(MISSION_LIST_RESPONSE_EVENT, {
        success: false,
        message: 'Load failed',
        correlationId: requestPayload.correlationId!,
        requestIdentity: requestPayload.requestIdentity!,
        missions: [],
      });

      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      const alert = el.querySelector('[role="alert"]');
      expect(alert?.textContent?.trim()).toBe('Load failed');
    });

    it('shows loading state separately from empty and error states', () => {
      const { fixture } = setup({
        socketService,
        sessionService,
        navigationState: {
          playerName: 'Pioneer',
          joinCharacter: { id: 'c-1', characterName: 'Nova' },
        },
        connected: true,
      });

      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;

      expect(el.textContent).toContain('Loading missions...');
      expect(el.querySelector('[role="alert"]')).toBeNull();
      expect(el.textContent).not.toContain('No missions found for this character.');
    });

    it('renders deterministic lane counts matching rendered lane items', () => {
      const { fixture, component } = setup({
        socketService,
        sessionService,
        navigationState: {
          playerName: 'Pioneer',
          joinCharacter: { id: 'c-1', characterName: 'Nova' },
        },
      });

      component['missions'].set([
        { missionId: 'mission-active-1', status: 'active' },
        { missionId: 'mission-available-1', status: 'available' },
        { missionId: 'mission-completed-1', status: 'completed' },
      ] as any);
      spyOn(component, 'getMissionStageInfo').and.returnValue({ stage: 'Stage 1 of 1', nextStep: 'N/A' });

      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;

      const availableCount = Number(el.querySelector('.lane-count[data-lane-count="available"]')?.textContent?.trim());
      const activeCount = Number(el.querySelector('.lane-count[data-lane-count="active"]')?.textContent?.trim());
      const completedCount = Number(el.querySelector('.lane-count[data-lane-count="completed"]')?.textContent?.trim());

      expect(availableCount).toBe(el.querySelectorAll('[data-lane-item="available"]').length);
      expect(activeCount).toBe(el.querySelectorAll('[data-lane-item="active"]').length);
      expect(completedCount).toBe(el.querySelectorAll('[data-lane-item="completed"]').length);
    });

    it('renders filter empty state when selected lane has no missions', () => {
      const { fixture, component } = setup({
        socketService,
        sessionService,
        navigationState: {
          playerName: 'Pioneer',
          joinCharacter: { id: 'c-1', characterName: 'Nova' },
        },
      });

      component['missions'].set([{ missionId: 'mission-active-1', status: 'active' }] as any);
      component.setMissionLaneFilter('completed');
      spyOn(component, 'getMissionStageInfo').and.returnValue({ stage: 'Stage 1 of 1', nextStep: 'N/A' });

      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;

      expect(el.textContent).toContain('No missions match the selected lane filter.');
      expect(el.querySelectorAll('[data-lane-item="completed"]').length).toBe(0);
    });

    it('renders contract violation panel for unknown mission statuses without lane fallback', () => {
      const consoleErrorSpy = spyOn(console, 'error');
      const { fixture, component } = setup({ socketService, sessionService });

      component['missions'].set([{ missionId: 'm-01', status: 'abandoned' } as any]);
      spyOn(component, 'getMissionStageInfo').and.returnValue({ stage: 'Stage 1 of 1', nextStep: 'N/A' });

      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      const violationBadge = el.querySelector('.mission-status[data-status="contract-violation"]');

      expect(violationBadge).toBeNull();
      expect(el.querySelector('.contract-violation')).not.toBeNull();
      expect(el.querySelector('.contract-violation')?.textContent).toContain('abandoned');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[mission-board-contract] Contract violation: unknown mission status in mission board lane mapping.',
        jasmine.objectContaining({ missionId: 'm-01', observedStatus: 'abandoned' }),
      );
    });

    it('renders canonical lane status badges with deterministic counts', () => {
      const { fixture, component } = setup({ socketService, sessionService });

      component['missions'].set([
        { missionId: 'custom-active', status: 'active' },
        { missionId: 'custom-available', status: 'available' },
        { missionId: 'custom-completed', status: 'completed' },
      ] as any);
      spyOn(component, 'getMissionStageInfo').and.returnValue({ stage: 'Stage 1 of 1', nextStep: 'N/A' });

      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;

      expect(el.querySelectorAll('.mission-status[data-status="active"]').length).toBe(1);
      expect(el.querySelectorAll('.mission-status[data-status="available"]').length).toBe(1);
      expect(el.querySelectorAll('.mission-status[data-status="completed"]').length).toBe(1);
      expect(el.querySelectorAll('.mission-status[data-status="contract-violation"]').length).toBe(0);
    });
  });
});
