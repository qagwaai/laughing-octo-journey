import { beforeEach, describe, expect, it, vi } from 'vitest';
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
import { MarketService } from '../../services/market.service';
import { MissionService } from '../../services/mission.service';
import { MissionNavigationService } from '../../services/mission-navigation';
import { ShipService } from '../../services/ship.service';
import { SHIP_LIST_BY_OWNER_REQUEST_EVENT, SHIP_LIST_BY_OWNER_RESPONSE_EVENT } from '../../model/ship-list-by-owner';
import { getSw13AppTestReadinessSnapshot } from '../../services/sw13-app-test-readiness-contract';
import ShipHangarPage from './ship-hangar';
const FIRST_TARGET_MISSION_ID = 'first-target';

type ControllableShipService = {
  pendingResponses: Array<(response: any) => void>;
  listShipsByOwner: ReturnType<typeof vi.fn>;
};

function createControllableShipService(): ControllableShipService {
  const pendingResponses: Array<(response: any) => void> = [];

  return {
    pendingResponses,
    listShipsByOwner: vi.fn((_request, onResponse: (response: any) => void) => {
      pendingResponses.push(onResponse);
    }),
  };
}

function createShip(id: string, name = id) {
  return {
    id,
    name,
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 1, y: 2, z: 3 },
      epochMs: 1,
    },
  };
}

function setup(options: {
  socketService: MockSocketService;
  sessionService: MockSessionService;
  navigationState?: Record<string, unknown>;
  connected?: boolean;
  shipService?: Pick<ControllableShipService, 'listShipsByOwner'>;
}) {
  const marketService = {
    listMarketsByLocation: vi.fn(),
    buyMarket: vi.fn(),
  };
  
  const mockRouter = {
    getCurrentNavigation: () => (options.navigationState ? { extras: { state: options.navigationState } } : null),
    navigate: vi.fn(),
  };

  options.socketService.connected = options.connected ?? false;

  const missionService = {
    isMissionInProgress: vi.fn().mockImplementation(
      (status: string | undefined | null) => status === 'ACTIVE' || status === 'ACTIVE' || status === 'ACTIVE',
    ),
    getMissionDamagePreset: vi.fn().mockReturnValue('cold-boot-starter-damaged'),
  };

  const missionNavigationService = {
    prepareNavigation: vi.fn().mockImplementation(async (context: any) => ({
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
      ...(options.shipService ? [{ provide: ShipService, useValue: options.shipService }] : []),
      { provide: SessionService, useValue: options.sessionService },
      { provide: MarketService, useValue: marketService },
      { provide: MissionService, useValue: missionService },
      { provide: MissionNavigationService, useValue: missionNavigationService },
      { provide: Router, useValue: mockRouter },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const fixture = TestBed.createComponent(ShipHangarPage);
  fixture.detectChanges();
  const component = fixture.componentInstance;

  return { component, fixture, mockRouter, marketService };
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
      expect.objectContaining({
        event: SHIP_LIST_BY_OWNER_REQUEST_EVENT,
        data: expect.objectContaining({
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
    expect(getSw13AppTestReadinessSnapshot().hangar).toEqual(
      expect.objectContaining({
        state: 'error',
        requestGeneration: 1,
        shipCount: 0,
        error: 'Player name is required to load ships.',
        routeContext: {
          playerName: null,
          characterId: 'c-1',
          shipId: null,
        },
      }),
    );
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
    expect(getSw13AppTestReadinessSnapshot().hangar).toEqual(
      expect.objectContaining({
        state: 'error',
        requestGeneration: 1,
        shipCount: 0,
        error: 'Character id is required to load ships.',
        routeContext: {
          playerName: 'Pioneer',
          characterId: null,
          shipId: null,
        },
      }),
    );
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
    expect(getSw13AppTestReadinessSnapshot().hangar).toEqual(
      expect.objectContaining({
        state: 'error',
        requestGeneration: 1,
        shipCount: 0,
        error: 'Session key is required to load ships.',
        routeContext: {
          playerName: 'Pioneer',
          characterId: 'c-1',
          shipId: null,
        },
      }),
    );
  });

  it('should increment readiness requestGeneration across repeated validation failures without emitting ship-list requests', () => {
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
    expect(getSw13AppTestReadinessSnapshot().hangar).toEqual(
      expect.objectContaining({
        state: 'error',
        requestGeneration: 1,
        shipCount: 0,
        error: 'Player name is required to load ships.',
      }),
    );
    expect(socketService.emittedEvents.length).toBe(0);

    component.loadShipsForCharacter();

    expect(component['shipListError']()).toBe('Player name is required to load ships.');
    expect(getSw13AppTestReadinessSnapshot().hangar).toEqual(
      expect.objectContaining({
        state: 'error',
        requestGeneration: 2,
        shipCount: 0,
        error: 'Player name is required to load ships.',
      }),
    );
    expect(socketService.emittedEvents.length).toBe(0);
  });

  it('should preserve last successful load metadata when a later validation failure occurs before request emit', () => {
    const controllableShipService = createControllableShipService();
    const { component } = setup({
      socketService,
      sessionService,
      shipService: controllableShipService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
      connected: true,
    });

    controllableShipService.pendingResponses[0]({
      success: true,
      message: 'initial ok',
      ships: [createShip('initial-ship', 'Initial Ship')],
    });

    const firstSuccessSnapshot = getSw13AppTestReadinessSnapshot().hangar;
    expect(firstSuccessSnapshot).toEqual(
      expect.objectContaining({
        state: 'loaded',
        requestGeneration: 1,
        shipCount: 1,
        lastSuccessfulLoad: expect.objectContaining({
          requestGeneration: 1,
          shipCount: 1,
        }),
      }),
    );

    sessionService.setSessionKey('');
    component.loadShipsForCharacter();

    expect(component['hangarLoadState']()).toBe('error');
    expect(component['shipListError']()).toBe('Session key is required to load ships.');
    expect(component['ships']()).toEqual([]);
    expect(controllableShipService.pendingResponses).toHaveLength(1);
    expect(getSw13AppTestReadinessSnapshot().hangar).toEqual(
      expect.objectContaining({
        state: 'error',
        requestGeneration: 2,
        shipCount: 0,
        error: 'Session key is required to load ships.',
        routeContext: {
          playerName: 'Pioneer',
          characterId: 'c-1',
          shipId: 'initial-ship',
        },
        lastSuccessfulLoad: expect.objectContaining({
          requestGeneration: 1,
          shipCount: 1,
          loadedAtEpochMs: firstSuccessSnapshot.lastSuccessfulLoad?.loadedAtEpochMs,
        }),
      }),
    );
  });

  it('should publish deterministic readiness errors across multiple validation-failure reasons with incrementing generations', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: '   ',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
      connected: true,
    });

    expect(getSw13AppTestReadinessSnapshot().hangar).toEqual(
      expect.objectContaining({
        state: 'error',
        requestGeneration: 1,
        shipCount: 0,
        error: 'Player name is required to load ships.',
        routeContext: {
          playerName: null,
          characterId: 'c-1',
          shipId: null,
        },
      }),
    );
    expect(socketService.emittedEvents.length).toBe(0);

    component['playerName'].set('Pioneer');
    component['joinCharacter'].set({ id: '', characterName: 'Nova' } as any);
    component.loadShipsForCharacter();

    expect(getSw13AppTestReadinessSnapshot().hangar).toEqual(
      expect.objectContaining({
        state: 'error',
        requestGeneration: 2,
        shipCount: 0,
        error: 'Character id is required to load ships.',
        routeContext: {
          playerName: 'Pioneer',
          characterId: null,
          shipId: null,
        },
      }),
    );
    expect(socketService.emittedEvents.length).toBe(0);

    component['joinCharacter'].set({ id: 'c-1', characterName: 'Nova' } as any);
    sessionService.setSessionKey('');
    component.loadShipsForCharacter();

    expect(getSw13AppTestReadinessSnapshot().hangar).toEqual(
      expect.objectContaining({
        state: 'error',
        requestGeneration: 3,
        shipCount: 0,
        error: 'Session key is required to load ships.',
        routeContext: {
          playerName: 'Pioneer',
          characterId: 'c-1',
          shipId: null,
        },
      }),
    );
    expect(socketService.emittedEvents.length).toBe(0);
  });

  it('should recover from validation failure into deterministic loading and loaded readiness states', () => {
    const controllableShipService = createControllableShipService();
    const recoverySessionService = createMockSessionService(null);
    const { component } = setup({
      socketService,
      sessionService: recoverySessionService,
      shipService: controllableShipService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
      connected: true,
    });

    expect(component['shipListError']()).toBe('Session key is required to load ships.');
    expect(controllableShipService.pendingResponses).toHaveLength(0);
    expect(getSw13AppTestReadinessSnapshot().hangar).toEqual(
      expect.objectContaining({
        state: 'error',
        requestGeneration: 1,
        shipCount: 0,
        error: 'Session key is required to load ships.',
      }),
    );

    recoverySessionService.setSessionKey('restored-session-key');
    component.loadShipsForCharacter();

    expect(component['hangarLoadState']()).toBe('loading');
    expect(controllableShipService.pendingResponses).toHaveLength(1);
    expect(getSw13AppTestReadinessSnapshot().hangar).toEqual(
      expect.objectContaining({
        state: 'loading',
        requestGeneration: 2,
        shipCount: 0,
        error: null,
        routeContext: {
          playerName: 'Pioneer',
          characterId: 'c-1',
          shipId: null,
        },
      }),
    );

    controllableShipService.pendingResponses[0]({
      success: true,
      message: 'ok',
      ships: [createShip('recovered-ship', 'Recovered Ship')],
    });

    expect(component['hangarLoadState']()).toBe('loaded');
    expect(component['shipListError']()).toBeNull();
    expect(component['ships']()).toEqual([expect.objectContaining({ id: 'recovered-ship', name: 'Recovered Ship' })]);
    expect(getSw13AppTestReadinessSnapshot().hangar).toEqual(
      expect.objectContaining({
        state: 'loaded',
        requestGeneration: 2,
        shipCount: 1,
        error: null,
        routeContext: {
          playerName: 'Pioneer',
          characterId: 'c-1',
          shipId: 'recovered-ship',
        },
        lastSuccessfulLoad: expect.objectContaining({
          requestGeneration: 2,
          shipCount: 1,
        }),
      }),
    );
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

  it('should publish loading and loaded readiness states for a successful ship load', () => {
    const controllableShipService = createControllableShipService();
    const { component } = setup({
      socketService,
      sessionService,
      shipService: controllableShipService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
      connected: true,
    });

    expect(component['hangarLoadState']()).toBe('loading');
    expect(getSw13AppTestReadinessSnapshot().hangar).toEqual(
      expect.objectContaining({
        state: 'loading',
        requestGeneration: 1,
        shipCount: 0,
        error: null,
        routeContext: {
          playerName: 'Pioneer',
          characterId: 'c-1',
          shipId: null,
        },
      }),
    );

    controllableShipService.pendingResponses[0]({
      success: true,
      message: 'ok',
      ships: [createShip('s-1', 'Courier')],
    });

    expect(component['hangarLoadState']()).toBe('loaded');
    expect(getSw13AppTestReadinessSnapshot().hangar).toEqual(
      expect.objectContaining({
        state: 'loaded',
        requestGeneration: 1,
        shipCount: 1,
        error: null,
        routeContext: {
          playerName: 'Pioneer',
          characterId: 'c-1',
          shipId: 's-1',
        },
        lastSuccessfulLoad: expect.objectContaining({
          requestGeneration: 1,
          shipCount: 1,
        }),
      }),
    );
  });

  it('should publish empty readiness state for a successful empty ship load', () => {
    const controllableShipService = createControllableShipService();
    const { component } = setup({
      socketService,
      sessionService,
      shipService: controllableShipService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
      connected: true,
    });

    controllableShipService.pendingResponses[0]({
      success: true,
      message: 'ok',
      ships: [],
    });

    expect(component['hangarLoadState']()).toBe('empty');
    expect(component['ships']()).toEqual([]);
    expect(getSw13AppTestReadinessSnapshot().hangar).toEqual(
      expect.objectContaining({
        state: 'empty',
        requestGeneration: 1,
        shipCount: 0,
        error: null,
        lastSuccessfulLoad: expect.objectContaining({
          requestGeneration: 1,
          shipCount: 0,
        }),
      }),
    );
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

  it('should ignore stale out-of-order ship-list responses from older generations', () => {
    const controllableShipService = createControllableShipService();
    const { component } = setup({
      socketService,
      sessionService,
      shipService: controllableShipService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
      connected: true,
    });

    component.loadShipsForCharacter();

    expect(controllableShipService.pendingResponses).toHaveLength(2);
    expect(getSw13AppTestReadinessSnapshot().hangar).toEqual(
      expect.objectContaining({
        state: 'loading',
        requestGeneration: 2,
      }),
    );

    controllableShipService.pendingResponses[0]({
      success: true,
      message: 'stale ok',
      ships: [createShip('stale-ship', 'Stale Ship')],
    });

    expect(component['hangarLoadState']()).toBe('loading');
    expect(component['ships']()).toEqual([]);
    expect(getSw13AppTestReadinessSnapshot().hangar).toEqual(
      expect.objectContaining({
        state: 'loading',
        requestGeneration: 2,
        shipCount: 0,
        lastSuccessfulLoad: null,
      }),
    );

    controllableShipService.pendingResponses[1]({
      success: true,
      message: 'latest ok',
      ships: [createShip('latest-ship', 'Latest Ship')],
    });

    expect(component['hangarLoadState']()).toBe('loaded');
    expect(component['ships']()).toEqual([expect.objectContaining({ id: 'latest-ship', name: 'Latest Ship' })]);
    expect(getSw13AppTestReadinessSnapshot().hangar).toEqual(
      expect.objectContaining({
        state: 'loaded',
        requestGeneration: 2,
        shipCount: 1,
        routeContext: {
          playerName: 'Pioneer',
          characterId: 'c-1',
          shipId: 'latest-ship',
        },
        lastSuccessfulLoad: expect.objectContaining({
          requestGeneration: 2,
          shipCount: 1,
        }),
      }),
    );
  });

  it('should ignore stale failure responses once the latest generation has loaded successfully', () => {
    const controllableShipService = createControllableShipService();
    const { component } = setup({
      socketService,
      sessionService,
      shipService: controllableShipService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
      connected: true,
    });

    component.loadShipsForCharacter();

    expect(controllableShipService.pendingResponses).toHaveLength(2);

    controllableShipService.pendingResponses[1]({
      success: true,
      message: 'latest ok',
      ships: [createShip('latest-ship', 'Latest Ship')],
    });

    expect(component['hangarLoadState']()).toBe('loaded');
    expect(component['shipListError']()).toBeNull();
    expect(component['ships']()).toEqual([expect.objectContaining({ id: 'latest-ship', name: 'Latest Ship' })]);

    controllableShipService.pendingResponses[0]({
      success: false,
      message: 'stale failure',
      ships: [],
    });

    expect(component['hangarLoadState']()).toBe('loaded');
    expect(component['shipListError']()).toBeNull();
    expect(component['ships']()).toEqual([expect.objectContaining({ id: 'latest-ship', name: 'Latest Ship' })]);
    expect(getSw13AppTestReadinessSnapshot().hangar).toEqual(
      expect.objectContaining({
        state: 'loaded',
        requestGeneration: 2,
        shipCount: 1,
        routeContext: {
          playerName: 'Pioneer',
          characterId: 'c-1',
          shipId: 'latest-ship',
        },
        lastSuccessfulLoad: expect.objectContaining({
          requestGeneration: 2,
          shipCount: 1,
        }),
      }),
    );
  });

  it('should preserve last successful load metadata when the latest generation fails', () => {
    const controllableShipService = createControllableShipService();
    const { component } = setup({
      socketService,
      sessionService,
      shipService: controllableShipService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
      connected: true,
    });

    expect(controllableShipService.pendingResponses).toHaveLength(1);

    controllableShipService.pendingResponses[0]({
      success: true,
      message: 'initial ok',
      ships: [createShip('initial-ship', 'Initial Ship')],
    });

    const firstSuccessSnapshot = getSw13AppTestReadinessSnapshot().hangar;
    expect(firstSuccessSnapshot).toEqual(
      expect.objectContaining({
        state: 'loaded',
        requestGeneration: 1,
        shipCount: 1,
        lastSuccessfulLoad: expect.objectContaining({
          requestGeneration: 1,
          shipCount: 1,
        }),
      }),
    );

    component.loadShipsForCharacter();
    expect(controllableShipService.pendingResponses).toHaveLength(2);

    controllableShipService.pendingResponses[1]({
      success: false,
      message: 'latest failed',
      ships: [],
    });

    expect(component['hangarLoadState']()).toBe('error');
    expect(component['shipListError']()).toBe('latest failed');
    expect(component['ships']()).toEqual([]);
    expect(getSw13AppTestReadinessSnapshot().hangar).toEqual(
      expect.objectContaining({
        state: 'error',
        requestGeneration: 2,
        shipCount: 0,
        error: 'latest failed',
        routeContext: {
          playerName: 'Pioneer',
          characterId: 'c-1',
          shipId: 'initial-ship',
        },
        lastSuccessfulLoad: expect.objectContaining({
          requestGeneration: 1,
          shipCount: 1,
          loadedAtEpochMs: firstSuccessSnapshot.lastSuccessfulLoad?.loadedAtEpochMs,
        }),
      }),
    );
  });

  it('should ignore stale success responses when the latest generation has already failed', () => {
    const controllableShipService = createControllableShipService();
    const { component } = setup({
      socketService,
      sessionService,
      shipService: controllableShipService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
      connected: true,
    });

    component.loadShipsForCharacter();
    expect(controllableShipService.pendingResponses).toHaveLength(2);

    controllableShipService.pendingResponses[1]({
      success: false,
      message: 'latest failed',
      ships: [],
    });

    expect(component['hangarLoadState']()).toBe('error');
    expect(component['shipListError']()).toBe('latest failed');
    expect(component['ships']()).toEqual([]);
    expect(getSw13AppTestReadinessSnapshot().hangar).toEqual(
      expect.objectContaining({
        state: 'error',
        requestGeneration: 2,
        shipCount: 0,
        error: 'latest failed',
      }),
    );

    controllableShipService.pendingResponses[0]({
      success: true,
      message: 'stale success',
      ships: [createShip('stale-ship', 'Stale Ship')],
    });

    expect(component['hangarLoadState']()).toBe('error');
    expect(component['shipListError']()).toBe('latest failed');
    expect(component['ships']()).toEqual([]);
    expect(getSw13AppTestReadinessSnapshot().hangar).toEqual(
      expect.objectContaining({
        state: 'error',
        requestGeneration: 2,
        shipCount: 0,
        error: 'latest failed',
      }),
    );
  });

  it('should fail ship load when no returned ship has usable spatial data', () => {
    const controllableShipService = createControllableShipService();
    const { component } = setup({
      socketService,
      sessionService,
      shipService: controllableShipService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
      connected: true,
    });

    controllableShipService.pendingResponses[0]({
      success: true,
      message: 'ok-but-unusable',
      ships: [
        {
          id: 'origin-ship',
          name: 'Origin Ship',
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: { x: 0, y: 0, z: 0 },
            epochMs: 1,
          },
        },
      ],
    });

    expect(component['hangarLoadState']()).toBe('error');
    expect(component['shipListError']()).toBe('No ship with usable spatial data is available.');
    expect(component['ships']()).toEqual([expect.objectContaining({ id: 'origin-ship' })]);
    expect(component['lastSuccessfulShipLoad']()).toBeNull();
    expect(getSw13AppTestReadinessSnapshot().hangar).toEqual(
      expect.objectContaining({
        state: 'error',
        requestGeneration: 1,
        shipCount: 1,
        error: 'No ship with usable spatial data is available.',
        routeContext: {
          playerName: 'Pioneer',
          characterId: 'c-1',
          shipId: null,
        },
        lastSuccessfulLoad: null,
      }),
    );
  });

  it('should preserve last successful load metadata when a later response has only unusable spatial ships', () => {
    const controllableShipService = createControllableShipService();
    const { component } = setup({
      socketService,
      sessionService,
      shipService: controllableShipService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova' },
      },
      connected: true,
    });

    controllableShipService.pendingResponses[0]({
      success: true,
      message: 'initial ok',
      ships: [createShip('initial-ship', 'Initial Ship')],
    });

    const firstSuccessSnapshot = getSw13AppTestReadinessSnapshot().hangar;
    expect(firstSuccessSnapshot.lastSuccessfulLoad).toEqual(
      expect.objectContaining({
        requestGeneration: 1,
        shipCount: 1,
      }),
    );

    component.loadShipsForCharacter();
    expect(controllableShipService.pendingResponses).toHaveLength(2);

    controllableShipService.pendingResponses[1]({
      success: true,
      message: 'unusable latest',
      ships: [
        {
          id: 'origin-ship',
          name: 'Origin Ship',
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: { x: 0, y: 0, z: 0 },
            epochMs: 2,
          },
        },
      ],
    });

    expect(component['hangarLoadState']()).toBe('error');
    expect(component['shipListError']()).toBe('No ship with usable spatial data is available.');
    expect(component['ships']()).toEqual([expect.objectContaining({ id: 'origin-ship' })]);
    expect(getSw13AppTestReadinessSnapshot().hangar).toEqual(
      expect.objectContaining({
        state: 'error',
        requestGeneration: 2,
        shipCount: 1,
        error: 'No ship with usable spatial data is available.',
        routeContext: {
          playerName: 'Pioneer',
          characterId: 'c-1',
          shipId: 'initial-ship',
        },
        lastSuccessfulLoad: expect.objectContaining({
          requestGeneration: 1,
          shipCount: 1,
          loadedAtEpochMs: firstSuccessSnapshot.lastSuccessfulLoad?.loadedAtEpochMs,
        }),
      }),
    );
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
    const setActiveSpy = vi.spyOn(sessionService, 'setActiveShip');
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

    expect(setActiveSpy).toHaveBeenCalledWith(ship as any);

    expect(mockRouter.navigate).toHaveBeenCalledWith(
      [{ outlets: { primary: ['ship-exterior-view'], right: null, left: ['ship-hangar'] } }],
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
      missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'ACTIVE' }],
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
      [{ outlets: { primary: ['ship-exterior-view'], right: null, left: ['ship-hangar'] } }],
      {
        preserveFragment: true,
        state: {
          playerName: 'Pioneer',
          joinCharacter: character,
          joinShip: ship,
          missionContext: {
            missionId: FIRST_TARGET_MISSION_ID,
            seedPolicy: 'resume',
            missionStatusHint: 'ACTIVE',
            shipDamagePreset: 'cold-boot-starter-damaged',
          },
          firstTargetMissionStatus: 'ACTIVE',
        },
      },
    );
  });

  it('should prefer active-session spatial when navigating to exterior for the same ship', async () => {
    const character = { id: 'c-1', characterName: 'Nova' };
    const { component, mockRouter } = setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer', joinCharacter: character },
    });

    sessionService.setActiveShip({
      id: 's-1',
      name: 'Dart Runner',
      model: 'Scavenger Pod',
      tier: 1,
      spatial: {
        solarSystemId: 'sol',
        frame: 'barycentric',
        positionKm: { x: 340090396, y: -132943, z: -214077099 },
        epochMs: 999,
      },
      inventory: [],
    } as any);

    const selectedShip = {
      id: ' s-1 ',
      name: 'Dart Runner',
      model: 'Scavenger Pod',
      spatial: {
        solarSystemId: 'sol',
        frame: 'barycentric',
        positionKm: { x: 1000, y: 0, z: 0 },
        epochMs: 1,
      },
    };

    await component.navigateToExteriorView(selectedShip as any);

    expect(mockRouter.navigate).toHaveBeenCalledWith(
      [{ outlets: { primary: ['ship-exterior-view'], right: null, left: ['ship-hangar'] } }],
      {
        preserveFragment: true,
        state: {
          playerName: 'Pioneer',
          joinCharacter: character,
          joinShip: {
            ...selectedShip,
            spatial: {
              solarSystemId: 'sol',
              frame: 'barycentric',
              positionKm: { x: 340090396, y: -132943, z: -214077099 },
              epochMs: 999,
            },
          },
          missionContext: {
            missionId: FIRST_TARGET_MISSION_ID,
            seedPolicy: 'resume',
          },
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
        queryParams: { specsNav: expect.any(Number) },
        state: {
          playerName: 'Pioneer',
          joinCharacter: character,
          itemType: 'Scavenger Pod',
          item: ship,
        },
      },
    );
  });

  it('should report active ship status by session active ship id', () => {
    const activeShip = { id: 's-1', name: 'Courier' } as any;
    sessionService.setActiveShip(activeShip);
    const { component } = setup({ socketService, sessionService });

    expect(component['isShipActive']({ id: 's-1' } as any)).toBe(true);
    expect(component['isShipActive']({ id: 's-2' } as any)).toBe(false);
  });

  it('should not re-set active ship when selected ship is already active', () => {
    const activeShip = { id: 's-1', name: 'Courier' } as any;
    sessionService.setActiveShip(activeShip);
    const setActiveSpy = vi.spyOn(sessionService, 'setActiveShip');
    const { component } = setup({ socketService, sessionService });

    component.setActiveShip({ id: 's-1', name: 'Courier' } as any);

    expect(setActiveSpy).not.toHaveBeenCalled();
  });

  it('should set active ship when selected ship differs from session active ship', () => {
    const activeShip = { id: 's-1', name: 'Courier' } as any;
    const nextShip = { id: 's-2', name: 'Pathfinder' } as any;
    sessionService.setActiveShip(activeShip);
    const setActiveSpy = vi.spyOn(sessionService, 'setActiveShip');
    const { component } = setup({ socketService, sessionService });

    component.setActiveShip(nextShip);

    expect(setActiveSpy).toHaveBeenCalledOnce();
    expect(setActiveSpy).toHaveBeenCalledWith(nextShip);
  });

  describe('buyScavengerPodFromClosestMarket', () => {
    function setupBuyContext(options: {
      playerName?: string;
      characterId?: string;
      sessionKey?: string | null;
      activeShip?: ReturnType<typeof createShip> | null;
    } = {}) {
      const playerName = options.playerName ?? 'Pioneer';
      const characterId = options.characterId ?? 'c-1';
      const localSessionService = createMockSessionService(options.sessionKey ?? 'test-session-key');

      if (options.activeShip !== undefined) {
        if (options.activeShip !== null) {
          localSessionService.setActiveShip(options.activeShip as any);
        }
      } else {
        localSessionService.setActiveShip(createShip('s-active') as any);
      }

      const { component, marketService } = setup({
        socketService,
        sessionService: localSessionService,
        navigationState: {
          playerName,
          joinCharacter: { id: characterId, characterName: 'Nova' },
        },
        connected: false,
      });

      return { component, marketService };
    }

    it('should set devToolError when player/character/session context is missing', () => {
      const { component } = setupBuyContext({ playerName: '' });

      component.buyScavengerPodFromClosestMarket();

      expect(component['devToolError']()).toBe(
        'Player, character, and session context are required for the dev buy test.',
      );
      expect(component['isBuyingTestShip']()).toBe(false);
    });

    it('should set devToolError when active ship has no spatial data', () => {
      const shipWithoutSpatial = { id: 's-nospatial', name: 'Ghost' } as any;
      const { component } = setupBuyContext({ activeShip: shipWithoutSpatial });

      component.buyScavengerPodFromClosestMarket();

      expect(component['devToolError']()).toBe(
        'Active ship spatial data is required to locate the closest market.',
      );
      expect(component['isBuyingTestShip']()).toBe(false);
    });

    it('should set devToolError when market list request fails', () => {
      const { component, marketService } = setupBuyContext();

      marketService.listMarketsByLocation.mockImplementation((_req: any, cb: (r: any) => void) => {
        cb({ success: false, message: 'Market service unavailable' });
      });

      component.buyScavengerPodFromClosestMarket();

      expect(component['devToolError']()).toBe('Market service unavailable');
      expect(component['isBuyingTestShip']()).toBe(false);
      expect(component['devToolStatus']()).toBeNull();
    });

    it('should set devToolError when market list succeeds but returns no markets', () => {
      const { component, marketService } = setupBuyContext();

      marketService.listMarketsByLocation.mockImplementation((_req: any, cb: (r: any) => void) => {
        cb({ success: true, markets: [] });
      });

      component.buyScavengerPodFromClosestMarket();

      expect(component['devToolError']()).toBe('No market was returned by the closest-market lookup.');
      expect(component['isBuyingTestShip']()).toBe(false);
      expect(component['devToolStatus']()).toBeNull();
    });

    it('should set devToolError when buy request fails', () => {
      const { component, marketService } = setupBuyContext();

      marketService.listMarketsByLocation.mockImplementation((_req: any, cb: (r: any) => void) => {
        cb({
          success: true,
          markets: [{ marketId: 'm-1', solarSystemId: 'sol', marketName: 'Station Alpha' }],
        });
      });
      marketService.buyMarket.mockImplementation((_req: any, cb: (r: any) => void) => {
        cb({ success: false, message: 'Insufficient credits' });
      });

      component.buyScavengerPodFromClosestMarket();

      expect(component['devToolError']()).toBe('Insufficient credits');
      expect(component['isBuyingTestShip']()).toBe(false);
      expect(component['devToolStatus']()).toBeNull();
    });

    it('should set generic success status and trigger reload when buy succeeds without purchasedShip', () => {
      const controllableShipService = createControllableShipService();
      const localSessionService = createMockSessionService('test-session-key');
      localSessionService.setActiveShip(createShip('s-active') as any);

      const { component, marketService } = setup({
        socketService,
        sessionService: localSessionService,
        shipService: controllableShipService,
        navigationState: {
          playerName: 'Pioneer',
          joinCharacter: { id: 'c-1', characterName: 'Nova' },
        },
        connected: false,
      });

      marketService.listMarketsByLocation.mockImplementation((_req: any, cb: (r: any) => void) => {
        cb({
          success: true,
          markets: [{ marketId: 'm-1', solarSystemId: 'sol', marketName: 'Station Alpha' }],
        });
      });
      marketService.buyMarket.mockImplementation((_req: any, cb: (r: any) => void) => {
        cb({ success: true, transaction: {} });
      });

      component.buyScavengerPodFromClosestMarket();

      expect(component['devToolError']()).toBeNull();
      expect(component['devToolStatus']()).toBe('Purchased Scavenger Pod. Refreshing hangar...');
      expect(component['isBuyingTestShip']()).toBe(false);
      // reload triggered: a new ship list request should have been queued
      expect(controllableShipService.pendingResponses.length).toBe(1);
    });

    it('should set named success status with ship name when buy succeeds with purchasedShip', () => {
      const controllableShipService = createControllableShipService();
      const localSessionService = createMockSessionService('test-session-key');
      localSessionService.setActiveShip(createShip('s-active') as any);

      const { component, marketService } = setup({
        socketService,
        sessionService: localSessionService,
        shipService: controllableShipService,
        navigationState: {
          playerName: 'Pioneer',
          joinCharacter: { id: 'c-1', characterName: 'Nova' },
        },
        connected: false,
      });

      marketService.listMarketsByLocation.mockImplementation((_req: any, cb: (r: any) => void) => {
        cb({
          success: true,
          markets: [{ marketId: 'm-1', solarSystemId: 'sol', marketName: 'Station Alpha' }],
        });
      });
      marketService.buyMarket.mockImplementation((_req: any, cb: (r: any) => void) => {
        cb({
          success: true,
          transaction: {
            purchasedShip: { id: 's-new', shipName: 'Scavenger Pod' },
          },
        });
      });

      component.buyScavengerPodFromClosestMarket();

      expect(component['devToolError']()).toBeNull();
      expect(component['devToolStatus']()).toBe('Purchased Scavenger Pod (s-new). Refreshing hangar...');
      expect(component['isBuyingTestShip']()).toBe(false);
      expect(controllableShipService.pendingResponses.length).toBe(1);
    });
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
