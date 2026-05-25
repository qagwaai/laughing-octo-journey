import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import {
  createMockSessionService,
  createMockSocketService,
  type MockSessionService,
  type MockSocketService,
} from '../../../testing';
import {
  CHARACTER_ADD_REQUEST_EVENT,
  CHARACTER_ADD_RESPONSE_EVENT,
  type CharacterAddRequest,
  type CharacterAddResponse,
} from '../../model/character-add';
import {
  CHARACTER_EDIT_REQUEST_EVENT,
  CHARACTER_EDIT_RESPONSE_EVENT,
  type CharacterEditResponse,
} from '../../model/character-edit';
import { CHARACTER_NAME_SUGGESTIONS } from '../../model/character-name-suggestions';
import { INVALID_SESSION_EVENT } from '../../model/session';
import {
  SHIP_LIST_BY_OWNER_REQUEST_EVENT,
  SHIP_LIST_BY_OWNER_RESPONSE_EVENT,
  type ShipListByOwnerResponse,
} from '../../model/ship-list-by-owner';
import { SHIP_UPSERT_REQUEST_EVENT, SHIP_UPSERT_RESPONSE_EVENT } from '../../model/ship-upsert';
import { SessionService } from '../../services/session.service';
import { SocketService } from '../../services/socket.service';
import CharacterSetupPage from './character-setup';

type MockSocketServiceWithUpsert = MockSocketService & {
  upsertShip(request: any, onResponse?: (r: any) => void): void;
};

function createExtendedMockSocketService(): MockSocketServiceWithUpsert {
  const base = createMockSocketService();
  return Object.assign(base, {
    upsertShip(request: any, onResponse?: (r: any) => void) {
      if (onResponse) {
        base.once(SHIP_UPSERT_RESPONSE_EVENT, onResponse);
      }
      base.emit(SHIP_UPSERT_REQUEST_EVENT, request);
    },
  });
}

interface SetupState {
  playerName?: string;
  mode?: 'create' | 'edit';
  editCharacter?: { id: string; characterName: string; level?: number };
  existingCharacters?: { id: string; characterName: string }[];
}

function createShipListResponse(params?: {
  success?: boolean;
  ships?: ShipListByOwnerResponse['ships'];
  message?: string;
  correlationId?: string;
  requestIdentity?: ShipListByOwnerResponse['requestIdentity'];
}): ShipListByOwnerResponse {
  return {
    success: params?.success ?? true,
    message: params?.message ?? 'ok',
    correlationId: params?.correlationId,
    requestIdentity: params?.requestIdentity,
    owner: {
      ownerType: 'player-character',
      playerId: 'p-1',
      characterId: 'c-1',
      npcId: null,
      factionId: null,
    },
    ships: params?.ships ?? [
      {
        id: 'ship-1',
        model: 'Scavenger Pod',
        tier: 1,
        name: "Pioneer's Ship",
        spatial: {
          solarSystemId: 'sol',
          frame: 'barycentric',
          positionKm: { x: 0, y: 0, z: 0 },
          epochMs: 1,
        },
      },
    ],
  };
}

function setup(options: {
  socketService: MockSocketServiceWithUpsert;
  sessionService: MockSessionService;
  setupState?: SetupState;
}) {
  const navigationState: SetupState = options.setupState ?? { playerName: 'Pioneer' };

  const mockRouter = {
    getCurrentNavigation: () => ({ extras: { state: navigationState } }),
    navigate: jasmine.createSpy('navigate'),
  };

  TestBed.configureTestingModule({
    imports: [CharacterSetupPage],
    providers: [
      { provide: SocketService, useValue: options.socketService },
      { provide: SessionService, useValue: options.sessionService },
      { provide: Router, useValue: mockRouter },
    ],
    schemas: [CUSTOM_ELEMENTS_SCHEMA],
  });

  const fixture = TestBed.createComponent(CharacterSetupPage);
  fixture.detectChanges();
  return { component: fixture.componentInstance, fixture, mockRouter };
}

describe('CharacterSetupPage', () => {
  let socketService: MockSocketServiceWithUpsert;
  let sessionService: MockSessionService;

  beforeEach(() => {
    socketService = createExtendedMockSocketService();
    sessionService = createMockSessionService('test-session-key');
    window.localStorage.removeItem('character.setup.lastSuggestedName');
  });

  it('should create', () => {
    const { component } = setup({ socketService, sessionService });
    expect(component).toBeTruthy();
  });

  it('should initialize with a playerName value', () => {
    const { component } = setup({ socketService, sessionService, setupState: { playerName: 'Pioneer' } });
    expect(component['playerName']()).toBe('Pioneer');
  });

  it('should auto-fill create mode with a suggested full name', () => {
    spyOn(Math, 'random').and.returnValue(0);
    const { component } = setup({
      socketService,
      sessionService,
      setupState: { playerName: 'Pioneer', mode: 'create', existingCharacters: [] },
    });

    expect(component['characterForm'].value.characterName).toBe(CHARACTER_NAME_SUGGESTIONS[0]);
  });

  it('should not reuse the previous localStorage suggestion on next load', () => {
    window.localStorage.setItem('character.setup.lastSuggestedName', CHARACTER_NAME_SUGGESTIONS[0]);
    spyOn(Math, 'random').and.returnValue(0);

    const { component } = setup({
      socketService,
      sessionService,
      setupState: { playerName: 'Pioneer', mode: 'create', existingCharacters: [] },
    });

    expect(component['characterForm'].value.characterName).toBe(CHARACTER_NAME_SUGGESTIONS[1]);
  });

  it('should shuffle suggested name and persist latest suggestion', () => {
    const randomSpy = spyOn(Math, 'random').and.returnValues(0, 0.5);
    const { component } = setup({
      socketService,
      sessionService,
      setupState: { playerName: 'Pioneer', mode: 'create', existingCharacters: [] },
    });

    const firstName = component['characterForm'].value.characterName!;
    component['shuffleSuggestedName']();
    const nextName = component['characterForm'].value.characterName!;

    expect(randomSpy).toHaveBeenCalled();
    expect(nextName).not.toBe(firstName);
    expect(window.localStorage.getItem('character.setup.lastSuggestedName')).toBe(nextName);
  });

  it('should initialize form in edit mode using selected character name', () => {
    const { component } = setup({
      socketService,
      sessionService,
      setupState: {
        playerName: 'Pioneer',
        mode: 'edit',
        editCharacter: { id: 'c-1', characterName: 'Nova-Prime' },
      },
    });

    expect(component['isEditMode']()).toBe(true);
    expect(component['characterForm'].value.characterName).toBe('Nova-Prime');
    expect(component['playerName']()).toBe('Pioneer');
  });

  it('should initialize with unsaved and idle state', () => {
    const { component } = setup({ socketService, sessionService });
    expect(component['isSaved']()).toBe(false);
    expect(component['successMessage']()).toBeNull();
    expect(component['errorMessage']()).toBeNull();
    expect(component['isSubmitting']()).toBe(false);
  });

  describe('saveCharacter()', () => {
    it('should mark form touched and not emit when invalid', () => {
      const { component } = setup({ socketService, sessionService });
      component['characterForm'].patchValue({ characterName: '' });

      component.saveCharacter();

      expect(component['characterForm'].touched).toBe(true);
      expect(component['isSaved']()).toBe(false);
      expect(component['successMessage']()).toBeNull();
      expect(socketService.emittedEvents.length).toBe(0);
    });

    it('should set error when playerName is missing', () => {
      const { component } = setup({ socketService, sessionService });
      component['playerName'].set('');
      component['characterForm'].patchValue({ characterName: 'Nova' });

      component.saveCharacter();

      expect(component['errorMessage']()).toBe('Player name is required to save a character.');
      expect(component['isSaved']()).toBe(false);
      expect(socketService.emittedEvents.length).toBe(0);
    });

    it('should emit save request in edit mode with updated character name', () => {
      const { component } = setup({
        socketService,
        sessionService,
        setupState: {
          playerName: 'Pioneer',
          mode: 'edit',
          editCharacter: { id: 'c-1', characterName: 'Nova' },
        },
      });
      component['characterForm'].patchValue({ characterName: 'Nova-Prime' });
      component.saveCharacter();

      expect(component['isEditMode']()).toBe(true);
      expect(socketService.emittedEvents[socketService.emittedEvents.length - 1]).toEqual(
        jasmine.objectContaining({
          event: CHARACTER_EDIT_REQUEST_EVENT,
          data: jasmine.objectContaining({
            characterId: 'c-1',
            playerName: 'Pioneer',
            characterName: 'Nova-Prime',
            sessionKey: 'test-session-key',
          }),
        }),
      );
    });

    it('should handle successful character-edit response in edit mode', () => {
      const { component, mockRouter } = setup({
        socketService,
        sessionService,
        setupState: {
          playerName: 'Pioneer',
          mode: 'edit',
          editCharacter: { id: 'c-1', characterName: 'Nova' },
        },
      });

      component['characterForm'].patchValue({ characterName: 'Nova-Prime' });
      component.saveCharacter();

      socketService.triggerEvent(CHARACTER_EDIT_RESPONSE_EVENT, {
        success: true,
        message: "Character 'Nova-Prime' updated.",
        playerName: 'Pioneer',
        characterId: 'c-1',
        characterName: 'Nova-Prime',
      } satisfies CharacterEditResponse);

      expect(component['isSubmitting']()).toBe(false);
      expect(component['isSaved']()).toBe(true);
      expect(component['successMessage']()).toBe("Character 'Nova-Prime' updated.");
      expect(component['errorMessage']()).toBeNull();
      expect(mockRouter.navigate).toHaveBeenCalledWith([{ outlets: { left: ['character-list'] } }], {
        preserveFragment: true,
        state: { playerName: 'Pioneer' },
      });
    });

    it('should emit character-add request when valid', () => {
      const { component } = setup({ socketService, sessionService });
      component['characterForm'].patchValue({ characterName: 'Nova-Prime' });
      component.saveCharacter();

      expect(socketService.emittedEvents.length).toBe(1);
      expect(socketService.emittedEvents[0].event).toBe(CHARACTER_ADD_REQUEST_EVENT);
      expect(socketService.emittedEvents[0].data).toEqual(
        jasmine.objectContaining({
          playerName: 'Pioneer',
          characterName: 'Nova-Prime',
          sessionKey: 'test-session-key',
        } satisfies CharacterAddRequest),
      );
      expect(component['isSubmitting']()).toBe(true);
    });

    it('should block create when normalized name duplicates an existing character', () => {
      const { component } = setup({
        socketService,
        sessionService,
        setupState: {
          playerName: 'Pioneer',
          mode: 'create',
          existingCharacters: [{ id: 'c-10', characterName: '  Nova   Prime  ' }],
        },
      });

      component['characterForm'].patchValue({ characterName: 'nova prime' });
      component['characterForm'].get('characterName')?.markAsTouched();
      component.saveCharacter();

      expect(component['isDuplicateNameBlockingSubmit']()).toBe(true);
      expect(component['duplicateNameError']()).toBe('Character name already exists. Choose a unique name.');
      expect(component['errorMessage']()).toBe('Character name already exists. Choose a unique name.');
      expect(socketService.emittedEvents.length).toBe(0);
    });

    it('should allow edit when name matches the same character id', () => {
      const { component } = setup({
        socketService,
        sessionService,
        setupState: {
          playerName: 'Pioneer',
          mode: 'edit',
          editCharacter: { id: 'c-1', characterName: 'Nova Prime' },
          existingCharacters: [
            { id: 'c-1', characterName: 'Nova Prime' },
            { id: 'c-2', characterName: 'Atlas' },
          ],
        },
      });

      component['characterForm'].patchValue({ characterName: '  nova   prime ' });
      component.saveCharacter();

      expect(component['isDuplicateNameBlockingSubmit']()).toBe(false);
      expect(socketService.emittedEvents[socketService.emittedEvents.length - 1]).toEqual(
        jasmine.objectContaining({
          event: CHARACTER_EDIT_REQUEST_EVENT,
          data: jasmine.objectContaining({
            characterId: 'c-1',
            playerName: 'Pioneer',
            characterName: '  nova   prime ',
            sessionKey: 'test-session-key',
          }),
        }),
      );
    });

    it('should block edit when name duplicates another character', () => {
      const { component } = setup({
        socketService,
        sessionService,
        setupState: {
          playerName: 'Pioneer',
          mode: 'edit',
          editCharacter: { id: 'c-1', characterName: 'Nova Prime' },
          existingCharacters: [
            { id: 'c-1', characterName: 'Nova Prime' },
            { id: 'c-2', characterName: 'Atlas Commander' },
          ],
        },
      });

      component['characterForm'].patchValue({ characterName: ' atlas   commander ' });
      component.saveCharacter();

      expect(component['isDuplicateNameBlockingSubmit']()).toBe(true);
      expect(component['errorMessage']()).toBe('Character name already exists. Choose a unique name.');
      expect(socketService.emittedEvents.length).toBe(0);
    });

    it('should handle successful character-add response', async () => {
      const { component, mockRouter } = setup({ socketService, sessionService });
      component['characterForm'].patchValue({ characterName: 'Nova-Prime' });
      component.saveCharacter();

      socketService.triggerEvent(CHARACTER_ADD_RESPONSE_EVENT, {
        success: true,
        message: "Character 'Nova-Prime' created.",
        playerName: 'Pioneer',
        characterName: 'Nova-Prime',
        characterId: 'c-1',
      } satisfies CharacterAddResponse);

      const shipListRequest = socketService.emittedEvents.find((e) => e.event === SHIP_LIST_BY_OWNER_REQUEST_EVENT)?.data as
        | { correlationId?: string; requestIdentity?: ShipListByOwnerResponse['requestIdentity'] }
        | undefined;

      expect(mockRouter.navigate).not.toHaveBeenCalled();

      socketService.triggerEvent(
        SHIP_LIST_BY_OWNER_RESPONSE_EVENT,
        createShipListResponse({
          correlationId: shipListRequest?.correlationId,
          requestIdentity: shipListRequest?.requestIdentity,
        }),
      );
      socketService.triggerOnce(SHIP_UPSERT_RESPONSE_EVENT, {
        success: true,
        message: 'ok',
        playerName: 'Pioneer',
      });
      await Promise.resolve();

      expect(component['isSubmitting']()).toBe(false);
      expect(component['isSaved']()).toBe(true);
      expect(component['successMessage']()).toBe("Character 'Nova-Prime' created.");
      expect(component['errorMessage']()).toBeNull();
      expect(mockRouter.navigate).toHaveBeenCalledWith([{ outlets: { left: ['character-list'] } }], {
        preserveFragment: true,
        state: { playerName: 'Pioneer' },
      });
    });

    it('should handle failed character-add response', () => {
      const { component, mockRouter } = setup({ socketService, sessionService });
      component['characterForm'].patchValue({ characterName: 'Nova-Prime' });
      component.saveCharacter();

      socketService.triggerEvent(CHARACTER_ADD_RESPONSE_EVENT, {
        success: false,
        message: 'Character name already exists.',
        playerName: 'Pioneer',
      } satisfies CharacterAddResponse);

      expect(component['isSubmitting']()).toBe(false);
      expect(component['isSaved']()).toBe(false);
      expect(component['successMessage']()).toBeNull();
      expect(component['errorMessage']()).toBe('Character name already exists.');
      expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should clear previous messages before a new request', () => {
      const { component } = setup({ socketService, sessionService });
      component['errorMessage'].set('Old error');
      component['successMessage'].set('Old success');
      component['characterForm'].patchValue({ characterName: 'Atlas' });
      component.saveCharacter();

      expect(component['errorMessage']()).toBeNull();
      expect(component['successMessage']()).toBeNull();
    });
  });

  describe('navigateToCharacterList()', () => {
    it('should navigate to character-list with playerName from login context', () => {
      const { component, mockRouter } = setup({ socketService, sessionService });
      component['playerName'].set('Pioneer');
      component.navigateToCharacterList();

      expect(mockRouter.navigate).toHaveBeenCalledWith([{ outlets: { left: ['character-list'] } }], {
        preserveFragment: true,
        state: { playerName: 'Pioneer' },
      });
    });

    it('should fallback to character name when playerName is empty', () => {
      const { component, mockRouter } = setup({ socketService, sessionService });
      component['playerName'].set('');
      component['characterForm'].patchValue({ characterName: 'Nova' });
      component.navigateToCharacterList();

      expect(mockRouter.navigate).toHaveBeenCalledWith([{ outlets: { left: ['character-list'] } }], {
        preserveFragment: true,
        state: { playerName: 'Nova' },
      });
    });
  });

  describe('ngOnDestroy()', () => {
    it('should unsubscribe add-response listener on destroy', () => {
      const { component } = setup({ socketService, sessionService });
      component['characterForm'].patchValue({ characterName: 'Nova' });
      component.saveCharacter();
      expect(socketService.registeredListeners.has(CHARACTER_ADD_RESPONSE_EVENT)).toBe(true);

      component.ngOnDestroy();
      expect(socketService.registeredListeners.has(CHARACTER_ADD_RESPONSE_EVENT)).toBe(false);
    });

    it('should unsubscribe invalid-session listener on destroy', () => {
      const { component } = setup({ socketService, sessionService });
      expect(socketService.registeredListeners.has(INVALID_SESSION_EVENT)).toBe(true);

      component.ngOnDestroy();
      expect(socketService.registeredListeners.has(INVALID_SESSION_EVENT)).toBe(false);
    });
  });

  describe('invalid session handling', () => {
    it('should clear session and navigate to login on invalid-session event', () => {
      const { mockRouter } = setup({ socketService, sessionService });
      expect(sessionService.hasSession()).toBe(true);

      socketService.triggerEvent(INVALID_SESSION_EVENT, { message: 'Session expired.' });

      expect(sessionService.hasSession()).toBe(false);
      expect(mockRouter.navigate).toHaveBeenCalledWith([{ outlets: { left: ['login'] } }], { preserveFragment: true });
    });
  });

  describe('createStarterShipForCharacter() — cold-boot item provisioning', () => {
    function triggerSuccessfulCharacterAdd(component: CharacterSetupPage, characterId = 'c-1') {
      component['characterForm'].patchValue({ characterName: 'Nova' });
      component.saveCharacter();
      socketService.triggerEvent(CHARACTER_ADD_RESPONSE_EVENT, {
        success: true,
        message: "Character 'Nova' created.",
        playerName: 'Pioneer',
        characterName: 'Nova',
        characterId,
      } satisfies CharacterAddResponse);
    }

    it('should emit owner-scoped ship list after successful character-add', () => {
      const { component } = setup({ socketService, sessionService });
      triggerSuccessfulCharacterAdd(component, 'c-1');

      const shipListEmit = socketService.emittedEvents.find((e) => e.event === SHIP_LIST_BY_OWNER_REQUEST_EVENT);
      expect(shipListEmit).toBeDefined();
      expect(shipListEmit!.data).toEqual(
        jasmine.objectContaining({
          playerName: 'Pioneer',
          sessionKey: 'test-session-key',
          owner: {
            ownerType: 'player-character',
            characterId: 'c-1',
          },
        }),
      );
    });

    it('should set warningMessage when ship-list-response fails', () => {
      const { component } = setup({ socketService, sessionService });
      triggerSuccessfulCharacterAdd(component, 'c-1');

      const shipListRequest = socketService.emittedEvents.find((e) => e.event === SHIP_LIST_BY_OWNER_REQUEST_EVENT)?.data as
        | { correlationId?: string; requestIdentity?: ShipListByOwnerResponse['requestIdentity'] }
        | undefined;

      socketService.triggerEvent(
        SHIP_LIST_BY_OWNER_RESPONSE_EVENT,
        createShipListResponse({
          success: false,
          ships: [],
          message: 'No ships found.',
          correlationId: shipListRequest?.correlationId,
          requestIdentity: shipListRequest?.requestIdentity,
        }),
      );

      expect(component['warningMessage']()).toBe('Character created, but starter ship could not be resolved yet.');
    });

    it('should set warningMessage when ship-list-response has no ships', () => {
      const { component } = setup({ socketService, sessionService });
      triggerSuccessfulCharacterAdd(component, 'c-1');

      const shipListRequest = socketService.emittedEvents.find((e) => e.event === SHIP_LIST_BY_OWNER_REQUEST_EVENT)?.data as
        | { correlationId?: string; requestIdentity?: ShipListByOwnerResponse['requestIdentity'] }
        | undefined;

      socketService.triggerEvent(
        SHIP_LIST_BY_OWNER_RESPONSE_EVENT,
        createShipListResponse({
          ships: [],
          correlationId: shipListRequest?.correlationId,
          requestIdentity: shipListRequest?.requestIdentity,
        }),
      );

      expect(component['warningMessage']()).toBe('Character created, but no starter ship record was returned.');
    });

    it('should emit ship-upsert-request when ship-list-response succeeds with a ship', () => {
      const { component } = setup({ socketService, sessionService });
      triggerSuccessfulCharacterAdd(component, 'c-1');

      const shipListRequest = socketService.emittedEvents.find((e) => e.event === SHIP_LIST_BY_OWNER_REQUEST_EVENT)?.data as
        | { correlationId?: string; requestIdentity?: ShipListByOwnerResponse['requestIdentity'] }
        | undefined;

      socketService.triggerEvent(
        SHIP_LIST_BY_OWNER_RESPONSE_EVENT,
        createShipListResponse({
          correlationId: shipListRequest?.correlationId,
          requestIdentity: shipListRequest?.requestIdentity,
        }),
      );

      const shipUpsertEmit = socketService.emittedEvents.find((e) => e.event === SHIP_UPSERT_REQUEST_EVENT);
      expect(shipUpsertEmit).toBeDefined();
      expect(shipUpsertEmit!.data.playerName).toBe('Pioneer');
      expect(shipUpsertEmit!.data.characterId).toBe('c-1');
      expect(shipUpsertEmit!.data.ship.id).toBe('ship-1');
      expect(shipUpsertEmit!.data.ship.inventory.map((item: { itemType: string }) => item.itemType)).toEqual([
        'expendable-dart-drone',
        'sensor-array',
        'ship-tractor-beam',
      ]);
    });

    it('should defer navigation until starter ship provisioning settles', async () => {
      const { component, mockRouter } = setup({ socketService, sessionService });
      triggerSuccessfulCharacterAdd(component, 'c-1');

      const shipListRequest = socketService.emittedEvents.find((e) => e.event === SHIP_LIST_BY_OWNER_REQUEST_EVENT)?.data as
        | { correlationId?: string; requestIdentity?: ShipListByOwnerResponse['requestIdentity'] }
        | undefined;

      expect(mockRouter.navigate).not.toHaveBeenCalled();

      socketService.triggerEvent(
        SHIP_LIST_BY_OWNER_RESPONSE_EVENT,
        createShipListResponse({
          correlationId: shipListRequest?.correlationId,
          requestIdentity: shipListRequest?.requestIdentity,
        }),
      );
      expect(mockRouter.navigate).not.toHaveBeenCalled();

      socketService.triggerOnce(SHIP_UPSERT_RESPONSE_EVENT, {
        success: true,
        message: 'ok',
        playerName: 'Pioneer',
      });
      await Promise.resolve();

      expect(mockRouter.navigate).toHaveBeenCalledWith([{ outlets: { left: ['character-list'] } }], {
        preserveFragment: true,
        state: { playerName: 'Pioneer' },
      });
    });

    it('should set warningMessage when ship-upsert-response fails', () => {
      const { component } = setup({ socketService, sessionService });
      triggerSuccessfulCharacterAdd(component, 'c-1');

      const shipListRequest = socketService.emittedEvents.find((e) => e.event === SHIP_LIST_BY_OWNER_REQUEST_EVENT)?.data as
        | { correlationId?: string; requestIdentity?: ShipListByOwnerResponse['requestIdentity'] }
        | undefined;

      socketService.triggerEvent(
        SHIP_LIST_BY_OWNER_RESPONSE_EVENT,
        createShipListResponse({
          correlationId: shipListRequest?.correlationId,
          requestIdentity: shipListRequest?.requestIdentity,
        }),
      );
      socketService.triggerOnce(SHIP_UPSERT_RESPONSE_EVENT, {
        success: false,
        message: 'Ship upsert failed.',
        playerName: 'Pioneer',
      });

      expect(component['warningMessage']()).toBe('Character created, but starter ship position update failed.');
    });

    it('should clear warningMessage after successful ship upsert', () => {
      const { component } = setup({ socketService, sessionService });
      component['warningMessage'].set('Previous warning');
      triggerSuccessfulCharacterAdd(component, 'c-1');

      const shipListRequest = socketService.emittedEvents.find((e) => e.event === SHIP_LIST_BY_OWNER_REQUEST_EVENT)?.data as
        | { correlationId?: string; requestIdentity?: ShipListByOwnerResponse['requestIdentity'] }
        | undefined;

      socketService.triggerEvent(
        SHIP_LIST_BY_OWNER_RESPONSE_EVENT,
        createShipListResponse({
          correlationId: shipListRequest?.correlationId,
          requestIdentity: shipListRequest?.requestIdentity,
        }),
      );
      socketService.triggerOnce(SHIP_UPSERT_RESPONSE_EVENT, {
        success: true,
        message: 'ok',
        playerName: 'Pioneer',
      });

      expect(component['warningMessage']()).toBeNull();
      expect(socketService.emittedEvents.some((e) => e.event === 'item-upsert-request')).toBeFalse();
    });

    it('should not trigger ship provisioning on character-edit success', () => {
      const { component } = setup({
        socketService,
        sessionService,
        setupState: {
          playerName: 'Pioneer',
          mode: 'edit',
          editCharacter: { id: 'c-1', characterName: 'Nova' },
        },
      });

      component['characterForm'].patchValue({ characterName: 'Nova-Prime' });
      component.saveCharacter();

      socketService.triggerEvent(CHARACTER_EDIT_RESPONSE_EVENT, {
        success: true,
        message: "Character 'Nova-Prime' updated.",
        playerName: 'Pioneer',
        characterId: 'c-1',
        characterName: 'Nova-Prime',
      } satisfies CharacterEditResponse);

      const shipListEmit = socketService.emittedEvents.find((e) => e.event === SHIP_LIST_BY_OWNER_REQUEST_EVENT);
      expect(shipListEmit).toBeUndefined();
    });
  });

  describe('DOM smoke tests', () => {
    it('should render without error', () => {
      const { fixture } = setup({ socketService, sessionService });
      fixture.detectChanges();
      expect(fixture.nativeElement).toBeTruthy();
    });
  });
});
