import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import {
  createMockSessionService,
  createMockSocketService,
  type MockSessionService,
  type MockSocketService,
} from '../../../testing';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';
import { MissionService } from '../../services/mission.service';
import { MissionNavigationService } from '../../services/mission-navigation';
import { SHIP_LIST_BY_OWNER_REQUEST_EVENT, SHIP_LIST_BY_OWNER_RESPONSE_EVENT } from '../../model/ship-list-by-owner';
import ShipHangarPage from './ship-hangar';
const FIRST_TARGET_MISSION_ID = 'first-target';

function setup(options: {
  socketService: MockSocketService;
  sessionService: MockSessionService;
  navigationState?: Record<string, unknown>;
  connected?: boolean;
}) {
  const mockRouter = {
    getCurrentNavigation: () => (options.navigationState ? { extras: { state: options.navigationState } } : null),
    navigate: jasmine.createSpy('navigate'),
  };

  options.socketService.connected = options.connected ?? false;

  const missionService = {
    isMissionInProgress: jasmine
      .createSpy('isMissionInProgress')
      .and.callFake((status: string | undefined | null) =>
        status === 'started' || status === 'in-progress' || status === 'paused',
      ),
    getMissionDamagePreset: jasmine
      .createSpy('getMissionDamagePreset')
      .and.returnValue('cold-boot-starter-damaged'),
  };

  const missionNavigationService = {
    prepareNavigation: jasmine.createSpy('prepareNavigation').and.callFake(async (context: any) => ({
      playerName: context.playerName,
      joinCharacter: context.joinCharacter,
      missionContext: {
        missionId: FIRST_TARGET_MISSION_ID,
        seedPolicy: 'resume',
        ...(context.missionStatus ? { missionStatusHint: context.missionStatus } : {}),
      },
    })),
  };

  TestBed.configureTestingModule({
    imports: [ShipHangarPage],
    providers: [
      { provide: SocketService, useValue: options.socketService },
      { provide: SessionService, useValue: options.sessionService },
      { provide: MissionService, useValue: missionService },
      { provide: MissionNavigationService, useValue: missionNavigationService },
      { provide: Router, useValue: mockRouter },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const fixture = TestBed.createComponent(ShipHangarPage);
  fixture.detectChanges();
  const component = fixture.componentInstance;

  return { component, fixture, mockRouter };
}

describe('ShipHangarPage', () => {
  let socketService: MockSocketService;
  let sessionService: MockSessionService;

  beforeEach(() => {
    socketService = createMockSocketService();
    sessionService = createMockSessionService('test-session-key');
  });

  it('should initialize from navigation state and request ships when connected', () => {
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
    expect(socketService.emittedEvents[0]).toEqual(
      jasmine.objectContaining({
        event: SHIP_LIST_BY_OWNER_REQUEST_EVENT,
        data: jasmine.objectContaining({
          playerName: 'Pioneer',
          sessionKey: 'test-session-key',
          owner: {
            ownerType: 'player-character',
            characterId: 'c-1',
          },
        }),
      }),
    );
  });

  it('should request ships when connect event fires for initially disconnected socket', () => {
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
    expect(socketService.emittedEvents[0].event).toBe(SHIP_LIST_BY_OWNER_REQUEST_EVENT);
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

    expect(component['shipListError']()).toBe('Player name is required to load ships.');
    expect(component['ships']()).toEqual([]);
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

    expect(component['shipListError']()).toBe('Character id is required to load ships.');
    expect(component['ships']()).toEqual([]);
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

    expect(component['shipListError']()).toBe('Session key is required to load ships.');
    expect(component['ships']()).toEqual([]);
    expect(socketService.emittedEvents.length).toBe(0);
  });

  it('should populate ships on successful response', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
      connected: true,
    });

    const shipListRequest = socketService.emittedEvents[0].data as {
      correlationId?: string;
      requestIdentity?: unknown;
    };

    socketService.triggerEvent(SHIP_LIST_BY_OWNER_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      correlationId: shipListRequest.correlationId!,
      requestIdentity: shipListRequest.requestIdentity!,
      owner: { ownerType: 'player-character', playerId: 'p-1', characterId: 'c-1', npcId: null, factionId: null },
      ships: [
        { id: 's-1', name: 'Courier', spatial: { positionKm: { x: 1, y: 2, z: 3 } } },
        { id: 's-2', name: 'Ranger' },
      ],
    });

    expect(component['isLoadingShips']()).toBe(false);
    expect(component['shipListError']()).toBeNull();
    expect(component['ships']().length).toBe(2);
  });

  it('should set error and clear ships on failed response', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
      connected: true,
    });

    const shipListRequest = socketService.emittedEvents[0].data as {
      correlationId?: string;
      requestIdentity?: unknown;
    };

    socketService.triggerEvent(SHIP_LIST_BY_OWNER_RESPONSE_EVENT, {
      success: false,
      message: 'Character not found',
      correlationId: shipListRequest.correlationId!,
      requestIdentity: shipListRequest.requestIdentity!,
      owner: { ownerType: 'player-character', playerId: 'p-1', characterId: 'c-1', npcId: null, factionId: null },
      ships: [{ id: 's-1', name: 'Courier' }],
    });

    expect(component['isLoadingShips']()).toBe(false);
    expect(component['shipListError']()).toBe('Character not found');
    expect(component['ships']()).toEqual([]);
  });

  it('should return name fallback for blank ship name', () => {
    const { component } = setup({ socketService, sessionService });

    expect(component['getShipDisplayName']({ id: 's-1', name: '   ' } as any)).toBe('s-1');
    expect(component['getShipDisplayName']({ id: 's-2', name: 'Courier' } as any)).toBe('Courier');
  });

  it('should summarize location from location.positionKm first', () => {
    const { component } = setup({ socketService, sessionService });

    const summary = component['getShipLocationSummary']({
      id: 's-1',
      name: 'Courier',
      spatial: { positionKm: { x: 10, y: 20, z: 30 } },
    } as any);

    expect(summary).toBe('(10, 20, 30) km');
  });

  it('should summarize location from spatial.positionKm', () => {
    const { component } = setup({ socketService, sessionService });

    const summary = component['getShipLocationSummary']({
      id: 's-1',
      name: 'Courier',
      spatial: { positionKm: { x: -1, y: 0, z: 4 } },
    } as any);

    expect(summary).toBe('(-1, 0, 4) km');
  });

  it('should return unavailable location text when no position exists', () => {
    const { component } = setup({ socketService, sessionService });

    expect(component['getShipLocationSummary']({ id: 's-1', name: 'Courier' } as any)).toBe('Location unavailable');
  });

  it('should navigate to ship-view-inventory with ship state', () => {
    const character = { id: 'c-1', characterName: 'Nova' };
    const { component, mockRouter } = setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer', joinCharacter: character },
    });
    const ship = {
      id: 's-1',
      name: 'Dart Runner',
      inventory: [
        {
          id: 'drone-1',
          itemType: 'expendable-dart-drone',
          displayName: 'Expendable Dart Drone',
          state: 'contained',
          damageStatus: 'intact',
        },
      ],
    };

    component.navigateToShipInventory(ship as any);

    expect(mockRouter.navigate).toHaveBeenCalledWith([{ outlets: { left: ['ship-view-inventory'] } }], {
      preserveFragment: true,
      state: {
        playerName: 'Pioneer',
        joinCharacter: character,
        joinShip: ship,
      },
    });
  });

  it('should navigate to ship-exterior-view with full ship payload', async () => {
    const character = { id: 'c-1', characterName: 'Nova' };
    const { component, mockRouter } = setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer', joinCharacter: character },
    });
    const ship = {
      id: 's-1',
      name: 'Dart Runner',
      model: 'Scavenger Pod',
      inventory: [
        {
          id: 'drone-1',
          itemType: 'expendable-dart-drone',
          displayName: 'Expendable Dart Drone',
          state: 'contained',
          damageStatus: 'intact',
        },
      ],
    };

    await component.navigateToExteriorView(ship as any);

    expect(mockRouter.navigate).toHaveBeenCalledWith(
      [{ outlets: { right: ['ship-exterior-view'], left: ['ship-hangar'] } }],
      {
        preserveFragment: true,
        state: {
          playerName: 'Pioneer',
          joinCharacter: character,
          joinShip: ship,
          missionContext: {
            missionId: FIRST_TARGET_MISSION_ID,
            seedPolicy: 'resume',
          },
        },
      },
    );
  });

  it('should include cold-boot ship damage preset for in-progress first-target mission', async () => {
    const character = {
      id: 'c-1',
      characterName: 'Nova',
      missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'started' }],
    };
    const { component, mockRouter } = setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer', joinCharacter: character },
    });
    const ship = {
      id: 's-1',
      name: 'Dart Runner',
      model: 'Scavenger Pod',
    };

    await component.navigateToExteriorView(ship as any);

    expect(mockRouter.navigate).toHaveBeenCalledWith(
      [{ outlets: { right: ['ship-exterior-view'], left: ['ship-hangar'] } }],
      {
        preserveFragment: true,
        state: {
          playerName: 'Pioneer',
          joinCharacter: character,
          joinShip: ship,
          missionContext: {
            missionId: FIRST_TARGET_MISSION_ID,
            seedPolicy: 'resume',
            missionStatusHint: 'started',
            shipDamagePreset: 'cold-boot-starter-damaged',
          },
          firstTargetMissionStatus: 'started',
        },
      },
    );
  });

  it('should navigate to item-view-specs with ship model and ship payload', () => {
    const character = { id: 'c-1', characterName: 'Nova' };
    const { component, mockRouter } = setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer', joinCharacter: character },
    });
    const ship = {
      id: 's-1',
      name: 'Dart Runner',
      model: 'Scavenger Pod',
    };

    component.navigateToShipSpecs(ship as any);

    expect(mockRouter.navigate).toHaveBeenCalledWith(
      [{ outlets: { right: ['item-view-specs'], left: ['ship-hangar'] } }],
      {
        preserveFragment: true,
        queryParams: { specsNav: jasmine.any(Number) },
        state: {
          playerName: 'Pioneer',
          joinCharacter: character,
          itemType: 'Scavenger Pod',
          item: ship,
        },
      },
    );
  });

  describe('DOM smoke tests', () => {
    it('should render the page container without error', () => {
      const { fixture } = setup({ socketService, sessionService });
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('.ops-page-container')).toBeTruthy();
    });

    it('should show empty status when no ships loaded', () => {
      const { fixture } = setup({
        socketService,
        sessionService,
        navigationState: {
          playerName: 'Pioneer',
          joinCharacter: { id: 'c-1', characterName: 'Nova' },
        },
        connected: false,
      });
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('[role="alert"]')).toBeNull();
    });
  });
});
