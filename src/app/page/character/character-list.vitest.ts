import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
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
import { GAME_JOIN_REQUEST_EVENT } from '../../model/game-join';
import { FIRST_TARGET_MISSION_ID } from '../../model/mission.locale';
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

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeMockRouter(playerName = 'Pioneer') {
  return {
    getCurrentNavigation: () => ({ extras: { state: { playerName } } }),
    navigate: vi.fn().mockReturnValue(Promise.resolve(true)),
  };
}

function setup(options: {
  socketService: MockSocketService;
  sessionService: MockSessionService;
  playerName?: string;
  shipService?: { listShipsByOwner: ReturnType<typeof vi.fn> };
}): { component: CharacterListPage; fixture: ComponentFixture<CharacterListPage> } {
  const router = makeMockRouter(options.playerName ?? 'Pioneer');
  const shipService =
    options.shipService ??
    ({
      listShipsByOwner: vi.fn().mockImplementation(
        (req: ShipListByOwnerRequest, cb: (resp: ShipListByOwnerResponse) => void) =>
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
          { id: '1', characterName: 'Nova', level: 5 },
          { id: '2', characterName: 'Atlas', level: 8 },
        ],
      } satisfies CharacterListResponse);

      expect(component['characters']().length).toBe(2);
      expect(component['errorMessage']()).toBeNull();
      expect(component['isLoading']()).toBe(false);
    });

    it('should map alternate backend name fields to characterName', () => {
      socketService.connected = true;
      const { component } = setup({ socketService, sessionService });

      socketService.triggerEvent(CHARACTER_LIST_RESPONSE_EVENT, {
        success: true,
        message: 'ok',
        playerName: 'Pioneer',
        characters: [
          { id: '1', name: 'Nova' },
          { characterId: '2', character: { name: 'Atlas' } },
        ],
      } as any);

      expect(component['characters']()).toEqual([
        { id: '1', characterName: 'Nova', level: undefined, createdAt: undefined },
        { id: '2', characterName: 'Atlas', level: undefined, createdAt: undefined },
      ]);
    });

    it('should preserve mission progress from the character list response', () => {
      socketService.connected = true;
      const { component } = setup({ socketService, sessionService });

      socketService.triggerEvent(CHARACTER_LIST_RESPONSE_EVENT, {
        success: true,
        message: 'ok',
        playerName: 'Pioneer',
        characters: [
          {
            id: '1',
            characterName: 'Nova',
            missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' }],
          },
        ],
      } as any);

      expect(component['characters']()).toEqual([
        {
          id: '1',
          characterName: 'Nova',
          level: undefined,
          createdAt: undefined,
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
        playerName: 'Pioneer',
        characters: [],
      } satisfies CharacterListResponse);

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
        listShipsByOwner: vi.fn().mockImplementation(
          (req: ShipListByOwnerRequest, cb: (resp: ShipListByOwnerResponse) => void) =>
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

    it('should navigate to character-setup with playerName in left outlet', () => {
      const fixture = TestBed.createComponent(CharacterListPage);
      const component = fixture.componentInstance;
      component.navigateToCharacterSetup();

      expect(router.navigate).toHaveBeenCalledWith([{ outlets: { left: ['character-setup'] } }], {
        preserveFragment: true,
        state: { playerName: 'Pioneer', mode: 'create', existingCharacters: [] },
      });
    });

    it('should navigate to character-setup in edit mode with selected character state', () => {
      const fixture = TestBed.createComponent(CharacterListPage);
      const component = fixture.componentInstance;
      const character = { id: '1', characterName: 'Nova', level: 5 };
      component.navigateToCharacterEdit(character as any);

      expect(router.navigate).toHaveBeenCalledWith([{ outlets: { left: ['character-setup'] } }], {
        preserveFragment: true,
        state: { playerName: 'Pioneer', mode: 'edit', editCharacter: character, existingCharacters: [] },
      });
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

      expect(socketService.emittedEvents[socketService.emittedEvents.length - 1]).toEqual({
        event: GAME_JOIN_REQUEST_EVENT,
        data: { playerName: 'Pioneer', characterId: '1', sessionKey: 'test-session-key' },
      });
      expect(router.navigate).toHaveBeenCalledWith(
        [{ outlets: { primary: ['opening-cold-boot'], left: ['opening-cold-boot'] } }],
        {
          preserveFragment: true,
          state: { playerName: 'Pioneer', joinCharacter: character },
        },
      );
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
      await Promise.resolve();
      await Promise.resolve();

      expect(dispatchSpy).toHaveBeenCalled();
      const dispatchedEvent = dispatchSpy.mock.calls.slice(-1)[0][0] as Event;
      expect(dispatchedEvent.type).toBe(START_SCANNING_UI_EVENT);

      expect(socketService.emittedEvents[socketService.emittedEvents.length - 1]).toEqual({
        event: GAME_JOIN_REQUEST_EVENT,
        data: { playerName: 'Pioneer', characterId: '1', sessionKey: 'test-session-key' },
      });
      expect(router.navigate).toHaveBeenCalledWith(
        [{ outlets: { right: ['opening-cold-boot-scan'], left: ['game-main'] } }],
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

      const fixture = TestBed.createComponent(CharacterListPage);
      const component = fixture.componentInstance;
      const character = {
        id: '1',
        characterName: 'Nova',
        level: 5,
        missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'completed' as const }],
      };
      component.navigateToGameJoin(character);

      await Promise.resolve();

      expect(dispatchSpy).not.toHaveBeenCalled();

      expect(socketService.emittedEvents[socketService.emittedEvents.length - 1]).toEqual({
        event: GAME_JOIN_REQUEST_EVENT,
        data: { playerName: 'Pioneer', characterId: '1', sessionKey: 'test-session-key' },
      });
      expect(router.navigate).toHaveBeenCalledWith(
        [{ outlets: { right: ['mission-board'], left: ['game-main'] } }],
        {
          preserveFragment: true,
          state: {
            playerName: 'Pioneer',
            joinCharacter: character,
          },
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
              listShipsByOwner: vi.fn().mockImplementation(
                (req: ShipListByOwnerRequest, cb: (resp: ShipListByOwnerResponse) => void) =>
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

    it('should clear session and navigate to login on invalid-session event', () => {
      TestBed.createComponent(CharacterListPage);

      expect(sessionService.hasSession()).toBe(true);

      socketService.triggerEvent(INVALID_SESSION_EVENT, { message: 'Session expired.' });

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

  // -------------------------------------------------------------------------
  // Null-coalesce / fallback branch coverage
  // -------------------------------------------------------------------------

  describe('normalizeCharacters() fallback branches', () => {
    it('uses empty string characterName when all name fields are absent', () => {
      socketService.connected = true;
      const { component } = setup({ socketService, sessionService });

      // Passes a character with no id, characterId, characterName, name, or character.name.
      socketService.triggerEvent(CHARACTER_LIST_RESPONSE_EVENT, {
        success: true,
        message: 'ok',
        playerName: 'Pioneer',
        characters: [{ level: 3 }],
      } as any);

      const chars = component['characters']();
      expect(chars[0].characterName).toBe('');
      // id falls back to `char-0` when neither id nor characterId is present.
      expect(chars[0].id).toBe('char-0');
    });

    it('uses null item as empty object (raw ?? {})', () => {
      socketService.connected = true;
      const { component } = setup({ socketService, sessionService });

      socketService.triggerEvent(CHARACTER_LIST_RESPONSE_EVENT, {
        success: true,
        message: 'ok',
        playerName: 'Pioneer',
        characters: [null, { id: 'char-2', characterName: 'Vex' }],
      } as any);

      const chars = component['characters']();
      // First entry is null, normalizes to '' name and 'char-0' id fallback.
      expect(chars[0].characterName).toBe('');
      expect(chars[1].characterName).toBe('Vex');
    });

    it('omits createdAt when it is not a string', () => {
      socketService.connected = true;
      const { component } = setup({ socketService, sessionService });

      socketService.triggerEvent(CHARACTER_LIST_RESPONSE_EVENT, {
        success: true,
        message: 'ok',
        playerName: 'Pioneer',
        characters: [{ id: 'c1', characterName: 'Aero', createdAt: 99999 }],
      } as any);

      expect(component['characters']()[0].createdAt).toBeUndefined();
    });

    it('normalizes missions with null entries via rawMission ?? {}', () => {
      socketService.connected = true;
      const { component } = setup({ socketService, sessionService });

      socketService.triggerEvent(CHARACTER_LIST_RESPONSE_EVENT, {
        success: true,
        message: 'ok',
        playerName: 'Pioneer',
        characters: [
          {
            id: 'c1',
            characterName: 'Aero',
            missions: [null, { missionId: FIRST_TARGET_MISSION_ID, status: 'active' }],
          },
        ],
      } as any);

      const missions = component['characters']()[0].missions ?? [];
      // The null entry normalizes to an empty mission object; the second entry lands correctly.
      expect(missions.some((m) => m.missionId === FIRST_TARGET_MISSION_ID)).toBe(true);
    });

    it('preserves createdAt when it is a string', () => {
      socketService.connected = true;
      const { component } = setup({ socketService, sessionService });

      socketService.triggerEvent(CHARACTER_LIST_RESPONSE_EVENT, {
        success: true,
        message: 'ok',
        playerName: 'Pioneer',
        characters: [{ id: 'c1', characterName: 'Aero', createdAt: '2026-01-01T00:00:00Z' }],
      } as any);

      expect(component['characters']()[0].createdAt).toBe('2026-01-01T00:00:00Z');
    });

    it('returns undefined missions when normalized missions list is empty', () => {
      socketService.connected = true;
      const { component } = setup({ socketService, sessionService });

      socketService.triggerEvent(CHARACTER_LIST_RESPONSE_EVENT, {
        success: true,
        message: 'ok',
        playerName: 'Pioneer',
        characters: [{ id: 'c1', characterName: 'Aero', missions: [] }],
      } as any);

      // Empty array normalizes to undefined rather than [].
      expect(component['characters']()[0].missions).toBeUndefined();
    });

    it('returns null status when character has no first-target mission', () => {
      socketService.connected = true;
      const { component } = setup({ socketService, sessionService });

      socketService.triggerEvent(CHARACTER_LIST_RESPONSE_EVENT, {
        success: true,
        message: 'ok',
        playerName: 'Pioneer',
        characters: [{ id: 'c1', characterName: 'Aero' }],
      } as any);

      const char = component['characters']()[0];
      const status = component['getFirstTargetStatus'](char);
      expect(status).toBeNull();
    });

    it('uses joinLabel when character is not in-progress', () => {
      socketService.connected = true;
      const { component } = setup({ socketService, sessionService });

      socketService.triggerEvent(CHARACTER_LIST_RESPONSE_EVENT, {
        success: true,
        message: 'ok',
        playerName: 'Pioneer',
        characters: [{ id: 'c1', characterName: 'Aero' }],
      } as any);

      const char = component['characters']()[0];
      const label = component['getJoinGameLabel'](char);
      expect(typeof label).toBe('string');
    });
  });
});
