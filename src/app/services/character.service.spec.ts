import { TestBed } from '@angular/core/testing';
import {
  CHARACTER_ADD_REQUEST_EVENT,
  CHARACTER_ADD_RESPONSE_EVENT,
  type CharacterAddRequest,
  type CharacterAddResponse,
} from '../model/character-add';
import {
  CHARACTER_DELETE_REQUEST_EVENT,
  CHARACTER_DELETE_RESPONSE_EVENT,
  type CharacterDeleteRequest,
  type CharacterDeleteResponse,
} from '../model/character-delete';
import {
  CHARACTER_EDIT_REQUEST_EVENT,
  CHARACTER_EDIT_RESPONSE_EVENT,
  type CharacterEditRequest,
  type CharacterEditResponse,
} from '../model/character-edit';
import {
  CHARACTER_LIST_REQUEST_EVENT,
  CHARACTER_LIST_RESPONSE_EVENT,
  type CharacterListRequest,
  type CharacterListResponse,
} from '../model/character-list';
import { CharacterService } from './character.service';
import { SocketService } from './socket.service';

type Listener = (payload: unknown) => void;

class MockSocketService {
  emittedEvents: Array<{ event: string; data: unknown }> = [];
  private listeners = new Map<string, Set<Listener>>();

  emit(eventName: string, data?: unknown): void {
    this.emittedEvents.push({ event: eventName, data });
  }

  on(eventName: string, callback: Listener): () => void {
    const set = this.listeners.get(eventName) ?? new Set<Listener>();
    set.add(callback);
    this.listeners.set(eventName, set);
    return () => {
      const next = this.listeners.get(eventName);
      if (!next) {
        return;
      }
      next.delete(callback);
      if (next.size === 0) {
        this.listeners.delete(eventName);
      }
    };
  }

  trigger(eventName: string, payload: unknown): void {
    const listeners = Array.from(this.listeners.get(eventName) ?? []);
    for (const listener of listeners) {
      listener(payload);
    }
  }

  listenerCount(eventName: string): number {
    return this.listeners.get(eventName)?.size ?? 0;
  }
}

describe('CharacterService', () => {
  let socketService: MockSocketService;
  let service: CharacterService;

  beforeEach(() => {
    socketService = new MockSocketService();
    TestBed.configureTestingModule({
      providers: [CharacterService, { provide: SocketService, useValue: socketService }],
    });
    service = TestBed.inject(CharacterService);
  });

  it('emits character-add requests with correlation metadata and ignores mismatched responses', () => {
    let received: CharacterAddResponse | undefined;
    const request: CharacterAddRequest = {
      playerName: 'Pioneer',
      characterName: 'Nyx',
      sessionKey: 'session-1',
    };

    service.addCharacter(request, (response) => {
      received = response;
    });

    expect(socketService.emittedEvents[0]).toEqual({
      event: CHARACTER_ADD_REQUEST_EVENT,
      data: jasmine.objectContaining({
        ...request,
        correlationId: jasmine.any(String),
        correlationSource: 'character-service.addCharacter',
        requestIdentity: {
          operation: 'character-add',
          entityType: 'character',
          containerId: 'player-pioneer',
        },
      }),
    });

    const requestPayload = socketService.emittedEvents[0].data as CharacterAddRequest;

    socketService.trigger(CHARACTER_ADD_RESPONSE_EVENT, {
      success: true,
      message: 'wrong',
      correlationId: 'wrong-correlation-id',
      requestIdentity: requestPayload.requestIdentity,
      playerName: 'Pioneer',
      characterName: 'Nyx',
      characterId: 'char-2',
    } satisfies CharacterAddResponse);

    expect(received).toBeUndefined();
    expect(socketService.listenerCount(CHARACTER_ADD_RESPONSE_EVENT)).toBe(1);

    const response: CharacterAddResponse = {
      success: true,
      message: 'ok',
      correlationId: requestPayload.correlationId,
      requestIdentity: requestPayload.requestIdentity,
      playerName: 'Pioneer',
      characterName: 'Nyx',
      characterId: 'char-1',
    };

    socketService.trigger(CHARACTER_ADD_RESPONSE_EVENT, response);

    expect(received).toEqual(response);
    expect(socketService.listenerCount(CHARACTER_ADD_RESPONSE_EVENT)).toBe(0);
  });

  it('isolates concurrent character-add requests under out-of-order responses', () => {
    const received: Record<string, CharacterAddResponse | undefined> = {};

    service.addCharacter(
      { playerName: 'Pioneer', characterName: 'Nyx', sessionKey: 'session-1' },
      (response) => {
        received['nyx'] = response;
      },
    );
    service.addCharacter(
      { playerName: 'Pioneer', characterName: 'Orin', sessionKey: 'session-1' },
      (response) => {
        received['orin'] = response;
      },
    );

    const nyxPayload = socketService.emittedEvents[0].data as CharacterAddRequest;
    const orinPayload = socketService.emittedEvents[1].data as CharacterAddRequest;

    const orinResponse: CharacterAddResponse = {
      success: true,
      message: 'orin',
      correlationId: orinPayload.correlationId,
      requestIdentity: orinPayload.requestIdentity,
      playerName: 'Pioneer',
      characterName: 'Orin',
      characterId: 'char-orin',
    };
    const nyxResponse: CharacterAddResponse = {
      success: true,
      message: 'nyx',
      correlationId: nyxPayload.correlationId,
      requestIdentity: nyxPayload.requestIdentity,
      playerName: 'Pioneer',
      characterName: 'Nyx',
      characterId: 'char-nyx',
    };

    socketService.trigger(CHARACTER_ADD_RESPONSE_EVENT, orinResponse);
    expect(received['orin']).toEqual(orinResponse);
    expect(received['nyx']).toBeUndefined();

    socketService.trigger(CHARACTER_ADD_RESPONSE_EVENT, nyxResponse);
    expect(received['nyx']).toEqual(nyxResponse);
    expect(socketService.listenerCount(CHARACTER_ADD_RESPONSE_EVENT)).toBe(0);
  });

  it('emits character-edit requests with correlation metadata and ignores mismatched responses', () => {
    let received: CharacterEditResponse | undefined;
    const request: CharacterEditRequest = {
      playerName: 'Pioneer',
      characterId: 'char-1',
      characterName: 'Nyx Prime',
      sessionKey: 'session-1',
    };

    service.editCharacter(request, (response) => {
      received = response;
    });

    expect(socketService.emittedEvents[0]).toEqual({
      event: CHARACTER_EDIT_REQUEST_EVENT,
      data: jasmine.objectContaining({
        ...request,
        correlationId: jasmine.any(String),
        correlationSource: 'character-service.editCharacter',
        requestIdentity: {
          operation: 'character-edit',
          entityType: 'character',
          containerId: 'char-1',
        },
      }),
    });

    const requestPayload = socketService.emittedEvents[0].data as CharacterEditRequest;

    socketService.trigger(CHARACTER_EDIT_RESPONSE_EVENT, {
      success: true,
      message: 'wrong',
      correlationId: 'wrong-correlation-id',
      requestIdentity: requestPayload.requestIdentity,
      playerName: 'Pioneer',
      characterId: 'char-1',
      characterName: 'Nyx Prime',
    } satisfies CharacterEditResponse);

    expect(received).toBeUndefined();

    const response: CharacterEditResponse = {
      success: true,
      message: 'ok',
      correlationId: requestPayload.correlationId,
      requestIdentity: requestPayload.requestIdentity,
      playerName: 'Pioneer',
      characterId: 'char-1',
      characterName: 'Nyx Prime',
    };

    socketService.trigger(CHARACTER_EDIT_RESPONSE_EVENT, response);

    expect(received).toEqual(response);
    expect(socketService.listenerCount(CHARACTER_EDIT_RESPONSE_EVENT)).toBe(0);
  });

  it('emits character-list requests with correlation metadata and ignores mismatched responses', () => {
    let received: CharacterListResponse | undefined;
    const request: CharacterListRequest = {
      playerName: 'Pioneer',
      sessionKey: 'session-1',
    };

    service.listCharacters(request, (response) => {
      received = response;
    });

    expect(socketService.emittedEvents[0]).toEqual({
      event: CHARACTER_LIST_REQUEST_EVENT,
      data: jasmine.objectContaining({
        ...request,
        correlationId: jasmine.any(String),
        correlationSource: 'character-service.listCharacters',
        requestIdentity: {
          operation: 'character-list',
          entityType: 'character',
          containerId: 'player-pioneer',
        },
      }),
    });

    const requestPayload = socketService.emittedEvents[0].data as CharacterListRequest;

    socketService.trigger(CHARACTER_LIST_RESPONSE_EVENT, {
      success: true,
      message: 'wrong',
      correlationId: 'wrong-correlation-id',
      requestIdentity: requestPayload.requestIdentity,
      playerName: 'Pioneer',
      characters: [],
    } satisfies CharacterListResponse);

    expect(received).toBeUndefined();

    const response: CharacterListResponse = {
      success: true,
      message: 'ok',
      correlationId: requestPayload.correlationId,
      requestIdentity: requestPayload.requestIdentity,
      playerName: 'Pioneer',
      characters: [{ id: 'char-1', characterName: 'Nyx' }],
    };

    socketService.trigger(CHARACTER_LIST_RESPONSE_EVENT, response);

    expect(received).toEqual(response);
    expect(socketService.listenerCount(CHARACTER_LIST_RESPONSE_EVENT)).toBe(0);
  });

  it('emits character-delete requests with correlation metadata and ignores mismatched responses', () => {
    let received: CharacterDeleteResponse | undefined;
    const request: CharacterDeleteRequest = {
      playerName: 'Pioneer',
      characterId: 'char-1',
      characterName: 'Nyx',
      sessionKey: 'session-1',
    };

    service.deleteCharacter(request, (response) => {
      received = response;
    });

    expect(socketService.emittedEvents[0]).toEqual({
      event: CHARACTER_DELETE_REQUEST_EVENT,
      data: jasmine.objectContaining({
        ...request,
        correlationId: jasmine.any(String),
        correlationSource: 'character-service.deleteCharacter',
        requestIdentity: {
          operation: 'character-delete',
          entityType: 'character',
          containerId: 'char-1',
        },
      }),
    });

    const requestPayload = socketService.emittedEvents[0].data as CharacterDeleteRequest;

    socketService.trigger(CHARACTER_DELETE_RESPONSE_EVENT, {
      success: true,
      message: 'wrong',
      correlationId: 'wrong-correlation-id',
      requestIdentity: requestPayload.requestIdentity,
      playerName: 'Pioneer',
      characterId: 'char-9',
    } satisfies CharacterDeleteResponse);

    expect(received).toBeUndefined();

    const response: CharacterDeleteResponse = {
      success: true,
      message: 'ok',
      correlationId: requestPayload.correlationId,
      requestIdentity: requestPayload.requestIdentity,
      playerName: 'Pioneer',
      characterId: 'char-1',
    };

    socketService.trigger(CHARACTER_DELETE_RESPONSE_EVENT, response);

    expect(received).toEqual(response);
    expect(socketService.listenerCount(CHARACTER_DELETE_RESPONSE_EVENT)).toBe(0);
  });
});