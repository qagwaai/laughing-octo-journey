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
import { SHIP_LIST_BY_OWNER_REQUEST_EVENT, SHIP_LIST_BY_OWNER_RESPONSE_EVENT } from '../../model/ship-list-by-owner';
import GameJoinPage from './game-join';

function setup(options: {
  socketService: MockSocketService;
  sessionService: MockSessionService;
  navigationState?: Record<string, unknown>;
  connected?: boolean;
}) {
  const mockRouter = {
    getCurrentNavigation: () => (options.navigationState ? { extras: { state: options.navigationState } } : null),
    navigate: vi.fn(),
  };

  options.socketService.connected = options.connected ?? false;

  TestBed.configureTestingModule({
    imports: [GameJoinPage],
    providers: [
      { provide: SocketService, useValue: options.socketService },
      { provide: SessionService, useValue: options.sessionService },
      { provide: Router, useValue: mockRouter },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const fixture = TestBed.createComponent(GameJoinPage);
  fixture.detectChanges();
  return { component: fixture.componentInstance, fixture, mockRouter };
}

describe('GameJoinPage', () => {
  let socketService: MockSocketService;
  let sessionService: MockSessionService;

  beforeEach(() => {
    socketService = createMockSocketService();
    sessionService = createMockSessionService('test-session-key');
  });

  it('should initialize character name from navigation state', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova-Prime', level: 7 },
      },
      connected: true,
    });

    expect(component['playerName']()).toBe('Pioneer');
    expect(component['joinCharacter']()).toEqual({ id: 'c-1', characterName: 'Nova-Prime', level: 7 });
    expect(component['characterName']()).toBe('Nova-Prime');
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

  it('should fall back to Unknown Character when no character is provided', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: { playerName: 'Pioneer' },
      connected: true,
    });

    expect(component['playerName']()).toBe('Pioneer');
    expect(component['joinCharacter']()).toBeNull();
    expect(component['characterName']()).toBe('Unknown Character');
    expect(component['shipListError']()).toBe('Character id is required to load ships.');
    expect(socketService.emittedEvents.length).toBe(0);
  });

  it('should request ships when connect event fires for initially disconnected socket', () => {
    setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
      },
      connected: false,
    });

    expect(socketService.emittedEvents.length).toBe(0);
    socketService.triggerOnceEvent('connect');
    expect(socketService.emittedEvents[0].event).toBe(SHIP_LIST_BY_OWNER_REQUEST_EVENT);
  });

  it('should populate ships on successful response', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
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
        { id: 'd-1', name: 'Surveyor' },
        { id: 'd-2', name: 'Guardian', status: 'ACTIVE' },
      ],
    });

    expect(component['isLoadingShips']()).toBe(false);
    expect(component['shipListError']()).toBeNull();
    expect(component['ships']().length).toBe(2);
    expect(component['ships']()[0].name).toBe('Surveyor');
    expect(component['ships']()[1].name).toBe('Guardian');
    expect(component['ships']()[1].status).toBe('ACTIVE');
  });

  it('should recover ship names from alternate payload fields', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
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
      ships: [{ id: 'd-1', shipName: 'Surveyor' } as any, { id: 'd-2', name: '   ', displayName: 'Guardian' } as any],
    });

    expect(component['ships']()[0].name).toBe('Surveyor');
    expect(component['ships']()[1].name).toBe('Guardian');
  });

  it('should preserve canonical spatial and motion payload fields', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
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
        {
          id: 'd-1',
          name: 'Surveyor',
          spatial: {
            frame: 'barycentric',
            solarSystemId: 'sol',
            positionKm: { x: 10, y: 20, z: 30 },
            epochMs: Date.now(),
          },
          motion: {
            velocityKmPerSec: { x: 3, y: 4, z: 0 },
          },
        } as any,
      ],
    });

    const ship = component['ships']()[0];
    expect(component['getShipKinematicsSummary'](ship)).toBe(
      'barycentric, position (10, 20, 30) km, speed 5.000 km/s, heading (0.600, 0.800, 0.000)',
    );
  });

  it('should set error and clear ships on failed response', () => {
    const { component } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
      },
      connected: true,
    });

    const shipListRequest = socketService.emittedEvents[0].data as {
      correlationId?: string;
      requestIdentity?: unknown;
    };

    socketService.triggerEvent(SHIP_LIST_BY_OWNER_RESPONSE_EVENT, {
      success: false,
      message: 'Character ships unavailable.',
      correlationId: shipListRequest.correlationId!,
      requestIdentity: shipListRequest.requestIdentity!,
      owner: { ownerType: 'player-character', playerId: 'p-1', characterId: 'c-1', npcId: null, factionId: null },
      ships: [],
    });

    expect(component['isLoadingShips']()).toBe(false);
    expect(component['ships']()).toEqual([]);
    expect(component['shipListError']()).toBe('Character ships unavailable.');
  });

  it('should navigate to item-view-specs by changing right outlet and preserving left game-join', () => {
    const { component, mockRouter } = setup({
      socketService,
      sessionService,
      navigationState: {
        playerName: 'Pioneer',
        joinCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
      },
      connected: true,
    });

    const ship = { id: 'd-1', name: 'Surveyor', status: 'ACTIVE' };
    component.navigateToShipSpecs(ship as any);

    expect(mockRouter.navigate).toHaveBeenCalledWith(
      [{ outlets: { right: ['item-view-specs'], left: ['game-join'] } }],
      {
        preserveFragment: true,
        queryParams: { specsNav: expect.any(Number) },
        state: {
          playerName: 'Pioneer',
          joinCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
          itemType: 'Scavenger Pod',
          item: ship,
        },
      },
    );
  });

  it('should return a fallback display name for blank ship names', () => {
    const { component } = setup({ socketService, sessionService });

    expect(component['getShipDisplayName']({ id: 'd-1', name: '   ' } as any)).toBe('Unnamed Ship');
  });

  it('should summarize ship kinematics for the list', () => {
    const { component } = setup({ socketService, sessionService });

    expect(
      component['getShipKinematicsSummary']({
        id: 'd-1',
        name: 'S',
        spatial: {
          frame: 'barycentric',
          solarSystemId: 'sol',
          positionKm: { x: 10, y: 20, z: 30 },
          epochMs: 0,
        },
        motion: {
          velocityKmPerSec: { x: 3, y: 4, z: 0 },
        },
        model: 'Scavenger Pod',
        tier: 1,
      } as any),
    ).toBe('barycentric, position (10, 20, 30) km, speed 5.000 km/s, heading (0.600, 0.800, 0.000)');
  });

  it('should return an explicit fallback when kinematics are missing', () => {
    const { component } = setup({ socketService, sessionService });

    expect(
      component['getShipKinematicsSummary']({
        id: 'd-1',
        name: 'S',
        model: 'Scavenger Pod',
        tier: 1,
        spatial: null,
      } as any),
    ).toBe('Kinematics unavailable');
  });

  describe('DOM smoke tests', () => {
    it('should render without error', () => {
      const { fixture } = setup({ socketService, sessionService });
      fixture.detectChanges();
      expect(fixture.nativeElement).toBeTruthy();
    });
  });
});
