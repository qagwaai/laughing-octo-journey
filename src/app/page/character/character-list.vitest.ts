import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createMockSessionService,
  createMockSocketService,
  type MockSessionService,
  type MockSocketService,
} from '../../../testing';
import {
  CHARACTER_DELETE_REQUEST_EVENT,
  CHARACTER_DELETE_RESPONSE_EVENT,
  type CharacterDeleteRequest,
  type CharacterDeleteResponse,
} from '../../model/character-delete';
import {
  CHARACTER_LIST_REQUEST_EVENT,
  CHARACTER_LIST_RESPONSE_EVENT,
  type CharacterListRequest,
  type CharacterListResponse,
} from '../../model/character-list';
import { GAME_JOIN_REQUEST_EVENT, GAME_JOIN_RESPONSE_EVENT } from '../../model/game-join';
import { FIRST_TARGET_MISSION_ID } from '../../model/mission.locale';
import { GENERIC_EXPLORATION_MISSION_ID } from '../../mission/generic-exploration-ship-exterior-mission';
import { INVALID_SESSION_EVENT } from '../../model/session';
import type { ShipSummary } from '../../model/ship-list';
import type { ShipListByOwnerRequest, ShipListByOwnerResponse } from '../../model/ship-list-by-owner';
import { SessionService } from '../../services/session.service';
import { ShipService } from '../../services/ship.service';
import { SocketService } from '../../services/socket.service';
import CharacterListPage from './character-list';

const START_SCANNING_UI_EVENT = 'cold-boot:start-scanning';
const TEST_CORRELATION_ID = '00000000-0000-4000-8000-000000000001';
const TEST_REQUEST_IDENTITY = {
  operation: 'test-op',
  entityType: 'test-entity',
  containerId: 'test-container',
};

function replyToGameJoin(socket: MockSocketService, success = true): void {
  const request = [...socket.emittedEvents].reverse().find((event) => event.event === GAME_JOIN_REQUEST_EVENT)?.data as {
    playerName: string;
    characterId: string;
    correlationId: string;
    requestIdentity: { operation: string; entityType: string; containerId: string };
  };
  socket.triggerEvent(GAME_JOIN_RESPONSE_EVENT, {
    playerName: request.playerName,
    characterId: request.characterId,
    correlationId: request.correlationId,
    requestIdentity: request.requestIdentity,
    success,
    message: success ? 'Joined' : 'Game unavailable',
    ...(!success ? { availability: 'unavailable', reason: 'startup_not_verified' } : {}),
  });
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeMockRouter(state: Record<string, unknown> | string | null = { playerName: 'Pioneer' }) {
  const resolvedState = typeof state === 'string' ? { playerName: state } : state;
  return {
    getCurrentNavigation: () => (resolvedState === null ? null : { extras: { state: resolvedState } }),
    navigate: vi.fn().mockReturnValue(Promise.resolve(true)),
  };
}

function setup(options: {
  socketService: MockSocketService;
  sessionService: MockSessionService;
  playerName?: string;
  navigationState?: Record<string, unknown> | null;
  shipService?: { listShipsByOwner: ReturnType<typeof vi.fn> };
}): { component: CharacterListPage; fixture: ComponentFixture<CharacterListPage> } {
  const routerState =
    options.navigationState === undefined
      ? options.playerName
        ? { playerName: options.playerName }
        : { playerName: 'Pioneer' }
      : options.navigationState;
  const router = makeMockRouter(routerState);
  const shipService =
    options.shipService ??
    ({
      listShipsByOwner: vi
        .fn()
        .mockImplementation((req: ShipListByOwnerRequest, cb: (resp: ShipListByOwnerResponse) => void) =>
          cb({
            success: true,
            message: 'ok',
            correlationId: TEST_CORRELATION_ID,
            requestIdentity: TEST_REQUEST_IDENTITY,
            owner: {
              ownerType: 'player-character',
              playerId: null,
              characterId: req.owner.characterId ?? null,
              npcId: null,
              factionId: null,
            },
            ships: [],
          }),
        ),
    } as { listShipsByOwner: ReturnType<typeof vi.fn> });

  TestBed.configureTestingModule({
    imports: [CharacterListPage],
    providers: [
      { provide: SocketService, useValue: options.socketService },
      { provide: SessionService, useValue: options.sessionService },
      { provide: ShipService, useValue: shipService },
      { provide: Router, useValue: router },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const fixture = TestBed.createComponent(CharacterListPage);
  fixture.detectChanges();
  return { component: fixture.componentInstance, fixture };
}

// ---------------------------------------------------------------------------
// Spec
// ---------------------------------------------------------------------------

describe('CharacterListPage', () => {
  let socketService: MockSocketService;
  let sessionService: MockSessionService;

  beforeEach(() => {
    socketService = createMockSocketService();
    sessionService = createMockSessionService('test-session-key');
  });

  it('should create', () => {
    const { component } = setup({ socketService, sessionService });
    expect(component).toBeTruthy();
  });

  it('should initialize with empty list and no error', () => {
    const { component } = setup({ socketService, sessionService });
    expect(component['characters']()).toEqual([]);
    expect(component['errorMessage']()).toBeNull();
    expect(component['isLoading']()).toBe(false);
  });

  it('should hydrate playerName from the persisted session when router state is missing', () => {
    sessionService.setPlayerName('Persisted Pioneer');
    socketService.connected = true;

    const { component } = setup({ socketService, sessionService, navigationState: null });

    expect(component['playerName']()).toBe('Persisted Pioneer');
    expect(socketService.emittedEvents[0]).toEqual(
      expect.objectContaining({
        event: CHARACTER_LIST_REQUEST_EVENT,
        data: expect.objectContaining({
          playerName: 'Persisted Pioneer',
          sessionKey: 'test-session-key',
        }),
      }),
    );
  });

  // -------------------------------------------------------------------------
  // Constructor auto-load behaviour
  // -------------------------------------------------------------------------

  describe('constructor auto-load behavior', () => {
    it('should load characters immediately when socket is already connected', () => {
      const connectedSocket = createMockSocketService();
      connectedSocket.connected = true;

      const { component } = setup({ socketService: connectedSocket, sessionService });

      expect(component['isLoading']()).toBe(true);
      expect(connectedSocket.emittedEvents[0].event).toBe(CHARACTER_LIST_REQUEST_EVENT);
    });

    it('should load characters when connect event fires if initially disconnected', () => {
      const disconnectedSocket = createMockSocketService();
      disconnectedSocket.connected = false;

      setup({ socketService: disconnectedSocket, sessionService });

      expect(disconnectedSocket.emittedEvents.length).toBe(0);
      disconnectedSocket.triggerOnceEvent('connect');
      expect(disconnectedSocket.emittedEvents[0].event).toBe(CHARACTER_LIST_REQUEST_EVENT);
    });
  });

  // -------------------------------------------------------------------------
  // loadCharacters()
  // -------------------------------------------------------------------------

  describe('loadCharacters()', () => {
    it('should emit character list request with playerName', () => {
      socketService.connected = true;
      const { component } = setup({ socketService, sessionService });
      // Clear auto-load events, then call explicitly
      socketService.emittedEvents.length = 0;
      component['playerName'].set('Pioneer');
      component.loadCharacters();

      expect(socketService.emittedEvents.length).toBe(1);
      expect(socketService.emittedEvents[0].event).toBe(CHARACTER_LIST_REQUEST_EVENT);
      expect(socketService.emittedEvents[0].data).toEqual(
        expect.objectContaining({
          playerName: 'Pioneer',
          sessionKey: 'test-session-key',
        }),
      );
    });

    it('should show validation error when playerName is empty', () => {
      const { component } = setup({ socketService, sessionService });
      component['playerName'].set('   ');
      component.loadCharacters();

      expect(component['errorMessage']()).toBe('Player name is required to load characters.');
      expect(socketService.emittedEvents.length).toBe(0);
    });

    it('should populate characters on successful response', () => {
      socketService.connected = true;
      const { component } = setup({ socketService, sessionService });
      const listRequest = socketService.emittedEvents[socketService.emittedEvents.length - 1].data as {
        correlationId: string;
        requestIdentity: CharacterListRequest['requestIdentity'];
      };

      socketService.triggerEvent(CHARACTER_LIST_RESPONSE_EVENT, {
        success: true,
        message: 'ok',
        correlationId: listRequest.correlationId,
        requestIdentity: listRequest.requestIdentity!,
        playerName: 'Pioneer',
        characters: [
          { id: '1', characterName: 'Nova', level: 5, credits: 0, creditLedger: [], missions: [] },
          { id: '2', characterName: 'Atlas', level: 8, credits: 0, creditLedger: [], missions: [] },
        ],
      } satisfies CharacterListResponse);

      expect(component['characters']().length).toBe(2);
      expect(component['errorMessage']()).toBeNull();
      expect(component['isLoading']()).toBe(false);
    });

    it('should reject alternate backend name fields instead of manufacturing identity', () => {
      socketService.connected = true;
      const { component } = setup({ socketService, sessionService });
      const request = socketService.emittedEvents.at(-1)?.data as CharacterListRequest;

      socketService.triggerEvent(CHARACTER_LIST_RESPONSE_EVENT, {
        success: true,
        message: 'ok',
        correlationId: request.correlationId,
        requestIdentity: request.requestIdentity,
        playerName: 'Pioneer',
        characters: [
          { id: '1', name: 'Nova' },
          { characterId: '2', character: { name: 'Atlas' } },
        ],
      });

      expect(component['characters']()).toEqual([]);
      expect(component['errorMessage']()).toBe('The server returned invalid character selection data.');
    });

    it('should preserve mission progress from the character list response', () => {
      socketService.connected = true;
      const { component } = setup({ socketService, sessionService });
      const request = socketService.emittedEvents.at(-1)?.data as CharacterListRequest;

      socketService.triggerEvent(CHARACTER_LIST_RESPONSE_EVENT, {
        success: true,
        message: 'ok',
        correlationId: request.correlationId,
        requestIdentity: request.requestIdentity,
        playerName: 'Pioneer',
        characters: [
          {
            id: '1',
            characterName: 'Nova',
            credits: 0,
            creditLedger: [],
            missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' }],
          },
        ],
      });

      expect(component['characters']()).toEqual([
        {
          id: '1',
          characterName: 'Nova',
          credits: 0,
          creditLedger: [],
          missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' }],
        },
      ]);
    });

    it('should set error and clear list on failure response', () => {
      socketService.connected = true;
      const { component } = setup({ socketService, sessionService });
      const listRequest = socketService.emittedEvents[socketService.emittedEvents.length - 1].data as {
        correlationId: string;
        requestIdentity: CharacterListRequest['requestIdentity'];
      };

      socketService.triggerEvent(CHARACTER_LIST_RESPONSE_EVENT, {
        success: false,
        message: 'Player not found.',
        correlationId: listRequest.correlationId,
        requestIdentity: listRequest.requestIdentity!,
        reason: 'player_not_registered',
        playerName: 'Pioneer',
        characters: [],
      });

      expect(component['characters']()).toEqual([]);
      expect(component['errorMessage']()).toBe('Player not found.');
      expect(component['isLoading']()).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Navigation methods
  // -------------------------------------------------------------------------

  describe('navigateToCharacterSetup()', () => {
    let router: ReturnType<typeof makeMockRouter>;
    let shipServiceStub: { listShipsByOwner: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      router = makeMockRouter('Pioneer');
      shipServiceStub = {
        listShipsByOwner: vi
          .fn()
          .mockImplementation((req: ShipListByOwnerRequest, cb: (resp: ShipListByOwnerResponse) => void) =>
            cb({
              success: true,
              message: 'ok',
              correlationId: TEST_CORRELATION_ID,
              requestIdentity: TEST_REQUEST_IDENTITY,
              owner: {
                ownerType: 'player-character',
                playerId: null,
                characterId: req.owner.characterId ?? null,
                npcId: null,
                factionId: null,
              },
              ships: [],
            }),
          ),
      };
      TestBed.configureTestingModule({
        imports: [CharacterListPage],
        providers: [
          { provide: SocketService, useValue: socketService },
          { provide: SessionService, useValue: sessionService },
          { provide: ShipService, useValue: shipServiceStub },
          { provide: Router, useValue: router },
        ],
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
      });
    });

    it('should navigate to character-setup and bust preview with playerName', () => {
      const fixture = TestBed.createComponent(CharacterListPage);
      const component = fixture.componentInstance;
      component.navigateToCharacterSetup();

      expect(router.navigate).toHaveBeenCalledWith(
        [{ outlets: { left: ['character-setup'], right: ['character-bust-preview'] } }],
        {
          preserveFragment: true,
          state: { playerName: 'Pioneer', mode: 'create', existingCharacters: [] },
        },
      );
    });

    it('should navigate to character-setup in edit mode with selected character state', () => {
      const fixture = TestBed.createComponent(CharacterListPage);
      const component = fixture.componentInstance;
      const character = { id: '1', characterName: 'Nova', level: 5 };
      component.navigateToCharacterEdit(character as any);

      expect(router.navigate).toHaveBeenCalledWith(
        [{ outlets: { left: ['character-setup'], right: ['character-bust-preview'] } }],
        {
          preserveFragment: true,
          state: { playerName: 'Pioneer', mode: 'edit', editCharacter: character, existingCharacters: [] },
        },
      );
    });

    it('should navigate to opening-cold-boot in primary and left outlets with selected character state', () => {
      const fixture = TestBed.createComponent(CharacterListPage);
      const component = fixture.componentInstance;
      const character = {
        id: '1',
        characterName: 'Nova',
        level: 5,
        missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'available' as const }],
      };
      component.navigateToGameJoin(character);

      expect(router.navigate).not.toHaveBeenCalled();
      expect(component['isJoining']()).toBe(true);
      expect(socketService.emittedEvents[socketService.emittedEvents.length - 1]).toEqual({
        event: GAME_JOIN_REQUEST_EVENT,
        data: expect.objectContaining({ playerName: 'Pioneer', characterId: '1', sessionKey: 'test-session-key' }),
      });
      replyToGameJoin(socketService);
      expect(router.navigate).toHaveBeenCalledWith(
        [{ outlets: { primary: ['opening-cold-boot'], left: ['opening-cold-boot'] } }],
        {
          preserveFragment: true,
          state: { playerName: 'Pioneer', joinCharacter: character },
        },
      );
    });

    it('keeps gameplay closed on rejected join and suppresses duplicate submits', () => {
      const component = TestBed.createComponent(CharacterListPage).componentInstance;
      const character = {
        id: '1',
        characterName: 'Nova',
        missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' as const }],
      };
      component.navigateToGameJoin(character);
      component.navigateToGameJoin(character);
      expect(socketService.emittedEvents.filter((event) => event.event === GAME_JOIN_REQUEST_EVENT)).toHaveLength(1);
      replyToGameJoin(socketService, false);
      expect(component['isJoining']()).toBe(false);
      expect(component['errorMessage']()).toBe('Game unavailable');
      expect(router.navigate).not.toHaveBeenCalled();
      expect(shipServiceStub.listShipsByOwner).not.toHaveBeenCalled();
    });

    it('allows an explicit retry after a rejected join', () => {
      const fixture = TestBed.createComponent(CharacterListPage);
      const component = fixture.componentInstance;
      const character = { id: '1', characterName: 'Nova', missions: [] };
      component['characters'].set([character]);
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('.join-link') as HTMLButtonElement;
      button.click();
      replyToGameJoin(socketService, false);
      fixture.detectChanges();
      expect(button.disabled).toBe(false);
      expect(component['errorMessage']()).toBe('Game unavailable');
      expect(socketService.emittedEvents.filter((event) => event.event === GAME_JOIN_REQUEST_EVENT)).toHaveLength(1);

      button.click();
      expect(socketService.emittedEvents.filter((event) => event.event === GAME_JOIN_REQUEST_EVENT)).toHaveLength(2);
      expect(component['errorMessage']()).toBeNull();
      expect(component['isJoining']()).toBe(true);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it('does not open a resumed mission when no authoritative ship can be hydrated', async () => {
      const component = TestBed.createComponent(CharacterListPage).componentInstance;
      component.navigateToGameJoin({
        id: '1',
        characterName: 'Nova',
        missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' }],
      });
      replyToGameJoin(socketService);
      await Promise.resolve();
      await Promise.resolve();
      expect(router.navigate).not.toHaveBeenCalled();
      expect(component['errorMessage']()).toBe('The active ship could not be loaded. Gameplay has not been opened.');
    });

    it('should show the in-progress join label when first-target is ACTIVE', () => {
      const fixture = TestBed.createComponent(CharacterListPage);
      const component = fixture.componentInstance;
      const character = {
        id: '1',
        characterName: 'Nova',
        missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' as const }],
      };

      expect(component['getJoinGameLabel'](character)).toBe('Join Game in Progress');
    });

    it('should keep the in-progress join label when first-target is COMPLETED', () => {
      const fixture = TestBed.createComponent(CharacterListPage);
      const component = fixture.componentInstance;
      const character = {
        id: '1',
        characterName: 'Nova',
        missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'completed' as const }],
      };

      expect(component['getJoinGameLabel'](character)).toBe('Join Game in Progress');
    });

    it('should keep the in-progress join label for equivalent ACTIVE lane fixtures', () => {
      const fixture = TestBed.createComponent(CharacterListPage);
      const component = fixture.componentInstance;
      const character = {
        id: '1',
        characterName: 'Nova',
        missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' as const }],
      };

      expect(component['getJoinGameLabel'](character)).toBe('Join Game in Progress');
    });

    it('should keep the in-progress join label across duplicate ACTIVE lane fixtures', () => {
      const fixture = TestBed.createComponent(CharacterListPage);
      const component = fixture.componentInstance;
      const character = {
        id: '1',
        characterName: 'Nova',
        missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' as const }],
      };

      expect(component['getJoinGameLabel'](character)).toBe('Join Game in Progress');
    });

    it('should navigate directly to game-main and cold-boot-scan when first-target is already ACTIVE', async () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      const realShip: ShipSummary = {
        id: 'real-ship-1',
        name: 'Nomad',
        model: 'Scavenger Pod',
        tier: 1,
        status: 'active',
        spatial: {
          solarSystemId: 'sol',
          frame: 'barycentric',
          positionKm: { x: 3.5e8, y: 0, z: 1e7 },
          epochMs: 1700000000000,
        },
      };
      shipServiceStub.listShipsByOwner.mockImplementation(
        (req: ShipListByOwnerRequest, cb: (resp: ShipListByOwnerResponse) => void) => {
          expect(req).toEqual({
            playerName: 'Pioneer',
            sessionKey: 'test-session-key',
            owner: {
              ownerType: 'player-character',
              characterId: '1',
            },
          });
          cb({
            success: true,
            message: 'ok',
            correlationId: TEST_CORRELATION_ID,
            requestIdentity: TEST_REQUEST_IDENTITY,
            owner: {
              ownerType: 'player-character',
              playerId: 'player-1',
              characterId: '1',
              npcId: null,
              factionId: null,
            },
            ships: [realShip],
          });
        },
      );
      const fixture = TestBed.createComponent(CharacterListPage);
      const component = fixture.componentInstance;
      const character = {
        id: '1',
        characterName: 'Nova',
        level: 5,
        missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' as const }],
      };
      component.navigateToGameJoin(character);
      expect(shipServiceStub.listShipsByOwner).not.toHaveBeenCalled();
      replyToGameJoin(socketService);
      await Promise.resolve();
      await Promise.resolve();

      expect(dispatchSpy).toHaveBeenCalled();
      const dispatchedEvent = dispatchSpy.mock.calls.slice(-1)[0][0] as Event;
      expect(dispatchedEvent.type).toBe(START_SCANNING_UI_EVENT);

      expect(socketService.emittedEvents[socketService.emittedEvents.length - 1]).toEqual({
        event: GAME_JOIN_REQUEST_EVENT,
        data: expect.objectContaining({ playerName: 'Pioneer', characterId: '1', sessionKey: 'test-session-key' }),
      });
      expect(router.navigate).toHaveBeenCalledWith(
        [{ outlets: { primary: ['ship-exterior-view'], right: ['opening-cold-boot-scan'], left: ['game-main'] } }],
        {
          preserveFragment: true,
          state: {
            playerName: 'Pioneer',
            joinCharacter: character,
            joinShip: realShip,
            missionContext: expect.objectContaining({
              missionId: FIRST_TARGET_MISSION_ID,
              missionStatusHint: 'active',
              seedPolicy: 'auto',
            }),
            firstTargetMissionStatus: 'active',
          },
        },
      );
    });

    it('should navigate to game-main and mission-board when first-target is COMPLETED', async () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      // Flush any pending microtasks from prior tests before this assertion path.
      await Promise.resolve();
      await Promise.resolve();
      dispatchSpy.mockClear();

      const completedShip: ShipSummary = {
        id: 'ship-completed',
        name: 'Jax',
        model: 'Scavenger Pod',
        tier: 1,
        spatial: {
          solarSystemId: 'sol',
          frame: 'barycentric',
          positionKm: { x: 1.2e8, y: 0, z: 4e6 },
          epochMs: 1700000000000,
        },
      };
      shipServiceStub.listShipsByOwner.mockImplementation(
        (_req: ShipListByOwnerRequest, cb: (resp: ShipListByOwnerResponse) => void) => {
          cb({
            success: true,
            message: 'ok',
            correlationId: TEST_CORRELATION_ID,
            requestIdentity: TEST_REQUEST_IDENTITY,
            owner: {
              ownerType: 'player-character',
              playerId: 'player-1',
              characterId: '1',
              npcId: null,
              factionId: null,
            },
            ships: [completedShip],
          });
        },
      );

      const fixture = TestBed.createComponent(CharacterListPage);
      const component = fixture.componentInstance;
      const character = {
        id: '1',
        characterName: 'Nova',
        level: 5,
        missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'completed' as const }],
      };
      component.navigateToGameJoin(character);
      replyToGameJoin(socketService);

      await Promise.resolve();
      await Promise.resolve();

      expect(dispatchSpy).not.toHaveBeenCalled();

      expect(socketService.emittedEvents[socketService.emittedEvents.length - 1]).toEqual({
        event: GAME_JOIN_REQUEST_EVENT,
        data: expect.objectContaining({ playerName: 'Pioneer', characterId: '1', sessionKey: 'test-session-key' }),
      });
      expect(router.navigate).toHaveBeenCalledWith(
        [{ outlets: { primary: ['ship-exterior-view'], right: ['mission-board'], left: ['game-main'] } }],
        {
          preserveFragment: true,
          state: expect.objectContaining({
            playerName: 'Pioneer',
            joinCharacter: character,
            joinShip: completedShip,
            missionContext: expect.objectContaining({ missionId: GENERIC_EXPLORATION_MISSION_ID }),
          }),
        },
      );
    });

    it('should set error and not navigate when playerName is empty for game join', () => {
      TestBed.overrideProvider(Router, {
        useValue: {
          getCurrentNavigation: () => ({ extras: { state: { playerName: '' } } }),
          navigate: router.navigate,
        },
      });
      const fixture = TestBed.createComponent(CharacterListPage);
      const component = fixture.componentInstance;
      component['playerName'].set('   ');
      component.navigateToGameJoin({ id: '1', characterName: 'Nova', level: 5 });

      expect(component['errorMessage']()).toBe('Player name is required to join a game.');
      expect(router.navigate).not.toHaveBeenCalled();
      expect(socketService.emittedEvents.length).toBe(0);
    });

    it('should set error and not navigate when character id is missing for game join', () => {
      const fixture = TestBed.createComponent(CharacterListPage);
      const component = fixture.componentInstance;
      component.navigateToGameJoin({ characterName: 'Nova' } as any);

      expect(component['errorMessage']()).toBe('Character id is required to join a game.');
      expect(router.navigate).not.toHaveBeenCalled();
      expect(socketService.emittedEvents.length).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Delete character workflow
  // -------------------------------------------------------------------------

  describe('delete character workflow', () => {
    let component: CharacterListPage;

    beforeEach(() => {
      socketService.connected = true;
      ({ component } = setup({ socketService, sessionService }));
      component['characters'].set([
        { id: '1', characterName: 'Nova', level: 5 },
        { id: '2', characterName: 'Atlas', level: 8 },
      ] as any);
    });

    it('should open confirmation dialog when delete is requested', () => {
      component.requestDeleteCharacter({ id: '1', characterName: 'Nova' } as any);

      expect(component['pendingDeleteCharacter']()).toEqual({ id: '1', characterName: 'Nova' });
    });

    it('should cancel delete and clear pending character', () => {
      component.requestDeleteCharacter({ id: '1', characterName: 'Nova' } as any);
      component.cancelDeleteCharacter();

      expect(component['pendingDeleteCharacter']()).toBeNull();
    });

    it('should emit character delete request on confirm', () => {
      component.requestDeleteCharacter({ id: '1', characterName: 'Nova' } as any);
      component.confirmDeleteCharacter();

      expect(socketService.emittedEvents[socketService.emittedEvents.length - 1].event).toBe(
        CHARACTER_DELETE_REQUEST_EVENT,
      );
      expect(socketService.emittedEvents[socketService.emittedEvents.length - 1].data).toEqual(
        expect.objectContaining({
          playerName: 'Pioneer',
          characterId: '1',
          characterName: 'Nova',
          sessionKey: 'test-session-key',
        }),
      );
      expect(component['isDeleting']()).toBe(true);
    });

    it('should remove character and close dialog on successful delete response', () => {
      component.requestDeleteCharacter({ id: '1', characterName: 'Nova' } as any);
      component.confirmDeleteCharacter();
      const deleteRequest = socketService.emittedEvents[socketService.emittedEvents.length - 1].data as {
        correlationId: string;
        requestIdentity: CharacterDeleteRequest['requestIdentity'];
      };
      socketService.triggerEvent(CHARACTER_DELETE_RESPONSE_EVENT, {
        success: true,
        message: 'Character deleted.',
        correlationId: deleteRequest.correlationId,
        requestIdentity: deleteRequest.requestIdentity!,
        playerName: 'Pioneer',
        characterId: '1',
      } satisfies CharacterDeleteResponse);

      expect(component['characters']()).toEqual([{ id: '2', characterName: 'Atlas', level: 8 }]);
      expect(component['pendingDeleteCharacter']()).toBeNull();
      expect(component['isDeleting']()).toBe(false);
    });

    it('should keep dialog open and show error on failed delete response', () => {
      component.requestDeleteCharacter({ id: '1', characterName: 'Nova' } as any);
      component.confirmDeleteCharacter();
      const deleteRequest = socketService.emittedEvents[socketService.emittedEvents.length - 1].data as {
        correlationId: string;
        requestIdentity: CharacterDeleteRequest['requestIdentity'];
      };
      socketService.triggerEvent(CHARACTER_DELETE_RESPONSE_EVENT, {
        success: false,
        message: 'Character cannot be deleted.',
        correlationId: deleteRequest.correlationId,
        requestIdentity: deleteRequest.requestIdentity!,
        playerName: 'Pioneer',
      } satisfies CharacterDeleteResponse);

      expect(component['errorMessage']()).toBe('Character cannot be deleted.');
      expect(component['pendingDeleteCharacter']()).toEqual({ id: '1', characterName: 'Nova' });
      expect(component['isDeleting']()).toBe(false);
    });

    it('should allow cancel after failed delete response', () => {
      component.requestDeleteCharacter({ id: '1', characterName: 'Nova' } as any);
      component.confirmDeleteCharacter();
      const deleteRequest = socketService.emittedEvents[socketService.emittedEvents.length - 1].data as {
        correlationId: string;
        requestIdentity: CharacterDeleteRequest['requestIdentity'];
      };
      socketService.triggerEvent(CHARACTER_DELETE_RESPONSE_EVENT, {
        success: false,
        message: 'Character cannot be deleted.',
        correlationId: deleteRequest.correlationId,
        requestIdentity: deleteRequest.requestIdentity!,
        playerName: 'Pioneer',
      } satisfies CharacterDeleteResponse);
      component.cancelDeleteCharacter();

      expect(component['pendingDeleteCharacter']()).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Invalid session handling
  // -------------------------------------------------------------------------

  describe('invalid session handling', () => {
    let router: ReturnType<typeof makeMockRouter>;

    beforeEach(() => {
      router = makeMockRouter('Pioneer');
      TestBed.configureTestingModule({
        imports: [CharacterListPage],
        providers: [
          { provide: SocketService, useValue: socketService },
          { provide: SessionService, useValue: sessionService },
          {
            provide: ShipService,
            useValue: {
              listShipsByOwner: vi
                .fn()
                .mockImplementation((req: ShipListByOwnerRequest, cb: (resp: ShipListByOwnerResponse) => void) =>
                  cb({
                    success: true,
                    message: 'ok',
                    correlationId: TEST_CORRELATION_ID,
                    requestIdentity: TEST_REQUEST_IDENTITY,
                    owner: {
                      ownerType: 'player-character',
                      playerId: null,
                      characterId: req.owner.characterId ?? null,
                      npcId: null,
                      factionId: null,
                    },
                    ships: [],
                  }),
                ),
            },
          },
          { provide: Router, useValue: router },
        ],
        schemas: [CUSTOM_ELEMENTS_SCHEMA],
      });
    });

    it('should verify an unattributed notice before clearing the current session', () => {
      const component = TestBed.createComponent(CharacterListPage).componentInstance;

      expect(sessionService.hasSession()).toBe(true);

      // Simulate socket connect → triggers loadCharacters → registers the response listener
      socketService.triggerOnceEvent('connect');
      const listRequest = socketService.emittedEvents[socketService.emittedEvents.length - 1].data as CharacterListRequest;

      // Deliver a successful character-list response to arm the invalid-session listener
      socketService.triggerEvent(CHARACTER_LIST_RESPONSE_EVENT, {
        success: true,
        message: '',
        correlationId: listRequest.correlationId!,
        requestIdentity: listRequest.requestIdentity!,
        playerName: 'Pioneer',
        characters: [],
      } satisfies CharacterListResponse);

      component.navigateToGameJoin({ id: '1', characterName: 'Nova', missions: [] });
      expect(component['isJoining']()).toBe(true);
      socketService.triggerEvent(INVALID_SESSION_EVENT, { message: 'Session expired.' });
      expect(component['isJoining']()).toBe(false);
      replyToGameJoin(socketService);

      expect(sessionService.hasSession()).toBe(true);
      expect(router.navigate).not.toHaveBeenCalled();
      const verification = socketService.emittedEvents.at(-1)?.data as CharacterListRequest;
      socketService.triggerEvent(CHARACTER_LIST_RESPONSE_EVENT, {
        success: false,
        message: 'Invalid session',
        reason: 'invalid_session',
        correlationId: verification.correlationId,
        requestIdentity: verification.requestIdentity,
        playerName: 'Pioneer',
        characters: [],
      });
      expect(sessionService.hasSession()).toBe(false);
      expect(router.navigate).toHaveBeenCalledWith([{ outlets: { left: ['login'] } }], { preserveFragment: true });
    });
  });

  // -------------------------------------------------------------------------
  // ngOnDestroy
  // -------------------------------------------------------------------------

  describe('ngOnDestroy()', () => {
    it('should unsubscribe all listeners on destroy', () => {
      const { component } = setup({ socketService, sessionService });

      // Simulate socket connect + successful load to arm the invalid-session listener
      socketService.triggerOnceEvent('connect');
      const listRequest = socketService.emittedEvents[socketService.emittedEvents.length - 1].data as CharacterListRequest;
      socketService.triggerEvent(CHARACTER_LIST_RESPONSE_EVENT, {
        success: true,
        message: '',
        correlationId: listRequest.correlationId!,
        requestIdentity: listRequest.requestIdentity!,
        playerName: 'Pioneer',
        characters: [],
      } satisfies CharacterListResponse);

      expect(socketService.registeredListeners.has(INVALID_SESSION_EVENT)).toBe(true);

      component.ngOnDestroy();

      expect(socketService.registeredListeners.has(INVALID_SESSION_EVENT)).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // DOM smoke tests
  // -------------------------------------------------------------------------

  describe('DOM smoke tests', () => {
    it('should render the host element', () => {
      const { fixture } = setup({ socketService, sessionService });
      expect(fixture.nativeElement).toBeTruthy();
    });

    it('should show validation error in template when playerName is empty', () => {
      const { component, fixture } = setup({ socketService, sessionService });
      component['playerName'].set('   ');
      component.loadCharacters();
      fixture.detectChanges();

      const text: string = fixture.nativeElement.textContent ?? '';
      expect(text).toContain('Player name is required');
    });
  });

  describe('strict selection data', () => {
    it.each([
      null,
      { level: 3 },
      { id: 'c', characterName: 'Name', credits: 0, creditLedger: [] },
      { id: 'c', characterName: 'Name', credits: 0, creditLedger: [], missions: [null] },
    ])('rejects malformed character data without fabricating defaults: %j', (character) => {
      socketService.connected = true;
      const { component } = setup({ socketService, sessionService });
      const request = socketService.emittedEvents.at(-1)?.data as CharacterListRequest;
      socketService.triggerEvent(CHARACTER_LIST_RESPONSE_EVENT, {
        success: true,
        message: 'ok',
        correlationId: request.correlationId,
        requestIdentity: request.requestIdentity,
        playerName: 'Pioneer',
        characters: [character],
      });
      expect(component['characters']()).toEqual([]);
      expect(component['errorMessage']()).toBe('The server returned invalid character selection data.');
      expect(component['isLoading']()).toBe(false);
    });

    it('preserves authoritative empty missions', () => {
      socketService.connected = true;
      const { component } = setup({ socketService, sessionService });
      const request = socketService.emittedEvents.at(-1)?.data as CharacterListRequest;
      socketService.triggerEvent(CHARACTER_LIST_RESPONSE_EVENT, {
        success: true, message: 'ok', playerName: 'Pioneer',
        correlationId: request.correlationId, requestIdentity: request.requestIdentity,
        characters: [{ id: 'c', characterName: 'Name', credits: 0, creditLedger: [], missions: [] }],
      });
      const character = component['characters']()[0];
      expect(character.missions).toEqual([]);
      expect(component['getFirstTargetStatus'](character)).toBeNull();
    });
  });
});
