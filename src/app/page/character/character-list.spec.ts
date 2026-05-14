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
  type CharacterDeleteResponse,
} from '../../model/character-delete';
import {
  CHARACTER_LIST_REQUEST_EVENT,
  CHARACTER_LIST_RESPONSE_EVENT,
  type CharacterListResponse,
} from '../../model/character-list';
import { GAME_JOIN_REQUEST_EVENT } from '../../model/game-join';
import { FIRST_TARGET_MISSION_ID } from '../../model/mission.locale';
import { INVALID_SESSION_EVENT } from '../../model/session';
import type { ShipListRequest, ShipListResponse, ShipSummary } from '../../model/ship-list';
import { SessionService } from '../../services/session.service';
import { ShipService } from '../../services/ship.service';
import { SocketService } from '../../services/socket.service';
import CharacterListPage from './character-list';

const START_SCANNING_UI_EVENT = 'cold-boot:start-scanning';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeMockRouter(playerName = 'Pioneer') {
  return {
    getCurrentNavigation: () => ({ extras: { state: { playerName } } }),
    navigate: jasmine.createSpy('navigate').and.returnValue(Promise.resolve(true)),
  };
}

function setup(options: {
  socketService: MockSocketService;
  sessionService: MockSessionService;
  playerName?: string;
  shipService?: { listShips: jasmine.Spy };
}): { component: CharacterListPage; fixture: ComponentFixture<CharacterListPage> } {
  const router = makeMockRouter(options.playerName ?? 'Pioneer');
  const shipService =
    options.shipService ??
    ({
      listShips: jasmine.createSpy('listShips').and.callFake(
        (req: ShipListRequest, cb: (resp: ShipListResponse) => void) =>
          cb({
            success: true,
            message: 'ok',
            playerName: req.playerName,
            characterId: req.characterId,
            ships: [],
          }),
      ),
    } as { listShips: jasmine.Spy });

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
      expect(socketService.emittedEvents[0].data).toEqual({
        playerName: 'Pioneer',
        sessionKey: 'test-session-key',
      });
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

      socketService.triggerEvent(CHARACTER_LIST_RESPONSE_EVENT, {
        success: true,
        message: 'ok',
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
            missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'started' }],
          },
        ],
      } as any);

      expect(component['characters']()).toEqual([
        {
          id: '1',
          characterName: 'Nova',
          level: undefined,
          createdAt: undefined,
          missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'started' }],
        },
      ]);
    });

    it('should set error and clear list on failure response', () => {
      socketService.connected = true;
      const { component } = setup({ socketService, sessionService });

      socketService.triggerEvent(CHARACTER_LIST_RESPONSE_EVENT, {
        success: false,
        message: 'Player not found.',
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
    let shipServiceStub: { listShips: jasmine.Spy };

    beforeEach(() => {
      router = makeMockRouter('Pioneer');
      shipServiceStub = {
        listShips: jasmine.createSpy('listShips').and.callFake(
          (req: ShipListRequest, cb: (resp: ShipListResponse) => void) =>
            cb({
              success: true,
              message: 'ok',
              playerName: req.playerName,
              characterId: req.characterId,
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
        state: { playerName: 'Pioneer', mode: 'create' },
      });
    });

    it('should navigate to character-setup in edit mode with selected character state', () => {
      const fixture = TestBed.createComponent(CharacterListPage);
      const component = fixture.componentInstance;
      const character = { id: '1', characterName: 'Nova', level: 5 };
      component.navigateToCharacterEdit(character as any);

      expect(router.navigate).toHaveBeenCalledWith([{ outlets: { left: ['character-setup'] } }], {
        preserveFragment: true,
        state: { playerName: 'Pioneer', mode: 'edit', editCharacter: character },
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

    it('should show the in-progress join label when first-target is started', () => {
      const fixture = TestBed.createComponent(CharacterListPage);
      const component = fixture.componentInstance;
      const character = {
        id: '1',
        characterName: 'Nova',
        missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'started' as const }],
      };

      expect(component['getJoinGameLabel'](character)).toBe('Join Game in Progress');
    });

    it('should keep the standard join label when first-target is completed', () => {
      const fixture = TestBed.createComponent(CharacterListPage);
      const component = fixture.componentInstance;
      const character = {
        id: '1',
        characterName: 'Nova',
        missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'completed' as const }],
      };

      expect(component['getJoinGameLabel'](character)).toBe('Join Game');
    });

    it('should navigate directly to game-main and cold-boot-scan when first-target is already started', () => {
      const dispatchSpy = spyOn(window, 'dispatchEvent').and.callThrough();
      const realShip: ShipSummary = {
        id: 'real-ship-1',
        name: 'Nomad',
        model: 'Scavenger Pod',
        tier: 1,
        status: 'ACTIVE',
        spatial: {
          solarSystemId: 'sol',
          frame: 'barycentric',
          positionKm: { x: 3.5e8, y: 0, z: 1e7 },
          epochMs: 1700000000000,
        },
      };
      shipServiceStub.listShips.and.callFake(
        (req: ShipListRequest, cb: (resp: ShipListResponse) => void) => {
          expect(req).toEqual({
            playerName: 'Pioneer',
            characterId: '1',
            sessionKey: 'test-session-key',
          });
          cb({
            success: true,
            message: 'ok',
            playerName: req.playerName,
            characterId: req.characterId,
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
        missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'started' as const }],
      };
      component.navigateToGameJoin(character);

      expect(shipServiceStub.listShips).toHaveBeenCalled();
      expect(sessionService.activeShip()).toBe(realShip);

      expect(dispatchSpy).toHaveBeenCalled();
      const dispatchedEvent = dispatchSpy.calls.mostRecent().args[0] as Event;
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
            missionContext: {
              missionId: FIRST_TARGET_MISSION_ID,
              missionStatusHint: 'started',
              seedPolicy: 'auto',
              shipDamagePreset: 'cold-boot-starter-damaged',
            },
            firstTargetMissionStatus: 'started',
          },
        },
      );
    });

    it('should navigate to game-main and mission-board when first-target is completed', () => {
      const dispatchSpy = spyOn(window, 'dispatchEvent').and.callThrough();
      const fixture = TestBed.createComponent(CharacterListPage);
      const component = fixture.componentInstance;
      const character = {
        id: '1',
        characterName: 'Nova',
        level: 5,
        missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'completed' as const }],
      };
      component.navigateToGameJoin(character);

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
      expect(socketService.emittedEvents[socketService.emittedEvents.length - 1].data).toEqual({
        playerName: 'Pioneer',
        characterId: '1',
        characterName: 'Nova',
        sessionKey: 'test-session-key',
      });
      expect(component['isDeleting']()).toBe(true);
    });

    it('should remove character and close dialog on successful delete response', () => {
      component.requestDeleteCharacter({ id: '1', characterName: 'Nova' } as any);
      component.confirmDeleteCharacter();
      socketService.triggerEvent(CHARACTER_DELETE_RESPONSE_EVENT, {
        success: true,
        message: 'Character deleted.',
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
      socketService.triggerEvent(CHARACTER_DELETE_RESPONSE_EVENT, {
        success: false,
        message: 'Character cannot be deleted.',
        playerName: 'Pioneer',
      } satisfies CharacterDeleteResponse);

      expect(component['errorMessage']()).toBe('Character cannot be deleted.');
      expect(component['pendingDeleteCharacter']()).toEqual({ id: '1', characterName: 'Nova' });
      expect(component['isDeleting']()).toBe(false);
    });

    it('should allow cancel after failed delete response', () => {
      component.requestDeleteCharacter({ id: '1', characterName: 'Nova' } as any);
      component.confirmDeleteCharacter();
      socketService.triggerEvent(CHARACTER_DELETE_RESPONSE_EVENT, {
        success: false,
        message: 'Character cannot be deleted.',
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
              listShips: jasmine.createSpy('listShips').and.callFake(
                (req: ShipListRequest, cb: (resp: ShipListResponse) => void) =>
                  cb({
                    success: true,
                    message: 'ok',
                    playerName: req.playerName,
                    characterId: req.characterId,
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
});
