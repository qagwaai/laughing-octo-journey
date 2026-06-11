import { TestBed } from '@angular/core/testing';
import {
  CHARACTER_BUST_CREATE_REQUEST_EVENT,
  CHARACTER_BUST_CREATE_RESPONSE_EVENT,
  CHARACTER_BUST_READ_REQUEST_EVENT,
  CHARACTER_BUST_READ_RESPONSE_EVENT,
  CHARACTER_BUST_UPDATE_REQUEST_EVENT,
  CHARACTER_BUST_UPDATE_RESPONSE_EVENT,
  NPC_BUST_CREATE_REQUEST_EVENT,
  NPC_BUST_CREATE_RESPONSE_EVENT,
  NPC_BUST_READ_REQUEST_EVENT,
  NPC_BUST_READ_RESPONSE_EVENT,
  NPC_BUST_UPDATE_REQUEST_EVENT,
  NPC_BUST_UPDATE_RESPONSE_EVENT,
  type CharacterBustCreateTerminalResponse,
  type BustValidationErrorResponse,
  type CharacterBustCreateRequest,
  type CharacterBustReadRequest,
  type CharacterBustReadResponse,
  type CharacterBustUpdateRequest,
  type CharacterBustUpdateTerminalResponse,
  type NpcBustCreateRequest,
  type NpcBustCreateTerminalResponse,
  type NpcBustReadRequest,
  type NpcBustReadResponse,
  type NpcBustUpdateRequest,
  type NpcBustUpdateTerminalResponse,
} from '../model/bust-descriptor';
import { SocketService } from './socket.service';
import { BustDescriptorAdapterService } from './bust-descriptor-adapter.service';

const DEFAULT_BUST_DESCRIPTOR_INPUT = {
  presetVersion: 'v1',
  faceShape: 'oval' as const,
  skinTone: 'medium' as const,
  hairStyle: 'short-crop' as const,
  hairColor: 'brown' as const,
  eyeStyle: 'almond' as const,
  eyeColor: 'green' as const,
  expressionPreset: 'neutral' as const,
  apparelAccent: 'none' as const,
  facialHair: 'none' as const,
  scar: 'none' as const,
  tattoo: 'none' as const,
};

const DEFAULT_BUST_DESCRIPTOR = {
  schemaVersion: 'sw-15-m1-v1' as const,
  ...DEFAULT_BUST_DESCRIPTOR_INPUT,
};

type Listener<T = unknown> = (payload: T) => void;

class MockSocketService {
  public readonly events = new Map<string, Set<Listener>>();
  public readonly emittedEvents: Array<{ eventName: string; payload: unknown }> = [];

  on(eventName: string, callback: Listener): () => void {
    const listeners = this.events.get(eventName) ?? new Set<Listener>();
    listeners.add(callback);
    this.events.set(eventName, listeners);

    return () => {
      const next = this.events.get(eventName);
      if (!next) {
        return;
      }

      next.delete(callback);
      if (next.size === 0) {
        this.events.delete(eventName);
      }
    };
  }

  emit(eventName: string, payload: unknown): void {
    this.emittedEvents.push({ eventName, payload });
  }

  trigger<T>(eventName: string, payload: T): void {
    const listeners = Array.from(this.events.get(eventName) ?? []);
    for (const listener of listeners) {
      listener(payload);
    }
  }

  listenerCount(eventName: string): number {
    return this.events.get(eventName)?.size ?? 0;
  }
}

describe('BustDescriptorAdapterService', () => {
  let socketService: MockSocketService;
  let service: BustDescriptorAdapterService;

  beforeEach(() => {
    socketService = new MockSocketService();
    TestBed.configureTestingModule({
      providers: [BustDescriptorAdapterService, { provide: SocketService, useValue: socketService }],
    });

    service = TestBed.inject(BustDescriptorAdapterService);
  });

  it('creates character busts and preserves hard-reject validation error shape', () => {
    const request: CharacterBustCreateRequest = {
      playerName: 'PilotOne',
      sessionKey: 'session-123',
      characterId: 'character-1',
      descriptor: DEFAULT_BUST_DESCRIPTOR_INPUT,
    };
    let received: CharacterBustCreateTerminalResponse | undefined;

    service.createCharacterBust(request).subscribe((response) => {
      received = response;
    });

    expect(socketService.emittedEvents[0]).toEqual({
      eventName: CHARACTER_BUST_CREATE_REQUEST_EVENT,
      payload: expect.objectContaining({
        ...request,
        correlationId: expect.any(String),
        correlationSource: 'bust-descriptor-adapter.createCharacterBust',
        requestIdentity: {
          operation: 'character-bust-create',
          entityType: 'character-bust',
          containerId: 'character-1',
        },
      }),
    });

    const requestPayload = socketService.emittedEvents[0].payload as CharacterBustCreateRequest;
    const hardRejectResponse: BustValidationErrorResponse = {
      success: false,
      message: 'Bust descriptor validation failed',
      correlationId: requestPayload.correlationId!,
      requestIdentity: requestPayload.requestIdentity!,
      validationErrors: [
        {
          field: 'descriptor.faceShape',
          reason: 'not a valid enum value',
          rejectedValue: 'triangle',
        },
      ],
    };

    socketService.trigger(CHARACTER_BUST_CREATE_RESPONSE_EVENT, hardRejectResponse);

    expect(received).toEqual(hardRejectResponse);
    expect(socketService.listenerCount(CHARACTER_BUST_CREATE_RESPONSE_EVENT)).toBe(0);
  });

  it('reads character busts and ignores mismatched correlated responses', () => {
    const request: CharacterBustReadRequest = {
      playerName: 'PilotOne',
      sessionKey: 'session-123',
      characterId: 'character-1',
    };
    let received: CharacterBustReadResponse | undefined;

    service.readCharacterBust(request).subscribe((response) => {
      received = response;
    });

    expect(socketService.emittedEvents[0].eventName).toBe(CHARACTER_BUST_READ_REQUEST_EVENT);

    const requestPayload = socketService.emittedEvents[0].payload as CharacterBustReadRequest;
    socketService.trigger(CHARACTER_BUST_READ_RESPONSE_EVENT, {
      success: true,
      message: 'wrong',
      correlationId: 'wrong-correlation-id',
      requestIdentity: requestPayload.requestIdentity!,
      playerName: 'PilotOne',
      characterId: 'character-1',
      descriptor: {
        ...DEFAULT_BUST_DESCRIPTOR,
      },
    } satisfies CharacterBustReadResponse);

    expect(received).toBeUndefined();

    const response: CharacterBustReadResponse = {
      success: true,
      message: 'ok',
      correlationId: requestPayload.correlationId!,
      requestIdentity: requestPayload.requestIdentity!,
      playerName: 'PilotOne',
      characterId: 'character-1',
      descriptor: DEFAULT_BUST_DESCRIPTOR,
    };

    socketService.trigger(CHARACTER_BUST_READ_RESPONSE_EVENT, response);

    expect(received).toEqual(response);
    expect(socketService.listenerCount(CHARACTER_BUST_READ_RESPONSE_EVENT)).toBe(0);
  });

  it('reads character bust when backend omits requestIdentity but correlationId matches', () => {
    const request: CharacterBustReadRequest = {
      playerName: 'PilotOne',
      sessionKey: 'session-123',
      characterId: 'character-1',
    };
    let received: CharacterBustReadResponse | undefined;

    service.readCharacterBust(request).subscribe((response) => {
      received = response;
    });

    const requestPayload = socketService.emittedEvents[0].payload as CharacterBustReadRequest;
    const response = {
      success: true,
      message: 'ok',
      correlationId: requestPayload.correlationId!,
      playerName: 'PilotOne',
      characterId: 'character-1',
      descriptor: DEFAULT_BUST_DESCRIPTOR,
    } as CharacterBustReadResponse;

    socketService.trigger(CHARACTER_BUST_READ_RESPONSE_EVENT, response);

    expect(received).toEqual(response);
    expect(socketService.listenerCount(CHARACTER_BUST_READ_RESPONSE_EVENT)).toBe(0);
  });

  it('updates character busts with correct request identity and response routing', () => {
    const request: CharacterBustUpdateRequest = {
      playerName: 'PilotOne',
      sessionKey: 'session-123',
      characterId: 'character-1',
      descriptor: {
        ...DEFAULT_BUST_DESCRIPTOR_INPUT,
        faceShape: 'square',
        skinTone: 'tan',
        hairStyle: 'mid-fade',
        hairColor: 'black',
        eyeStyle: 'narrow',
        eyeColor: 'brown',
        expressionPreset: 'stern',
        apparelAccent: 'collar',
      },
    };
    let received: CharacterBustUpdateTerminalResponse | undefined;

    service.updateCharacterBust(request).subscribe((response) => {
      received = response;
    });

    const requestPayload = socketService.emittedEvents[0].payload as CharacterBustUpdateRequest;
    expect(requestPayload.requestIdentity).toEqual({
      operation: 'character-bust-update',
      entityType: 'character-bust',
      containerId: 'character-1',
    });

    const response: CharacterBustUpdateTerminalResponse = {
      success: true,
      message: 'updated',
      correlationId: requestPayload.correlationId!,
      requestIdentity: requestPayload.requestIdentity!,
      playerName: 'PilotOne',
      characterId: 'character-1',
      descriptor: {
        ...DEFAULT_BUST_DESCRIPTOR,
        faceShape: 'square',
        skinTone: 'tan',
        hairStyle: 'mid-fade',
        hairColor: 'black',
        eyeStyle: 'narrow',
        eyeColor: 'brown',
        expressionPreset: 'stern',
        apparelAccent: 'collar',
      },
    };

    socketService.trigger(CHARACTER_BUST_UPDATE_RESPONSE_EVENT, response);

    expect(received).toEqual(response);
    expect(socketService.listenerCount(CHARACTER_BUST_UPDATE_RESPONSE_EVENT)).toBe(0);
  });

  it('creates NPC busts and keeps deterministic seed contract fields intact', () => {
    const request: NpcBustCreateRequest = {
      playerName: 'AdminUser',
      sessionKey: 'session-admin-1',
      npcId: 'npc-merchant-001',
      deterministicSeed: 'faction:trade|role:merchant|id:001',
    };
    let received: NpcBustCreateTerminalResponse | undefined;

    service.createNpcBust(request).subscribe((response) => {
      received = response;
    });

    expect(socketService.emittedEvents[0].eventName).toBe(NPC_BUST_CREATE_REQUEST_EVENT);
    const requestPayload = socketService.emittedEvents[0].payload as NpcBustCreateRequest;

    const response: NpcBustCreateTerminalResponse = {
      success: true,
      message: 'ok',
      correlationId: requestPayload.correlationId!,
      requestIdentity: requestPayload.requestIdentity!,
      npcId: 'npc-merchant-001',
      deterministicSeed: 'faction:trade|role:merchant|id:001',
      descriptor: {
        ...DEFAULT_BUST_DESCRIPTOR,
        faceShape: 'round',
        skinTone: 'light',
        hairStyle: 'slicked',
        hairColor: 'auburn',
        eyeStyle: 'wide',
        eyeColor: 'hazel',
        expressionPreset: 'warm',
        apparelAccent: 'collar',
      },
      appliedOverrides: [],
    };

    socketService.trigger(NPC_BUST_CREATE_RESPONSE_EVENT, response);
    expect(received).toEqual(response);
  });

  it('reads NPC busts with deterministic seed and unsubscribe behavior', () => {
    const request: NpcBustReadRequest = {
      playerName: 'AdminUser',
      sessionKey: 'session-admin-1',
      npcId: 'npc-merchant-001',
    };
    let received: NpcBustReadResponse | undefined;

    service.readNpcBust(request).subscribe((response) => {
      received = response;
    });

    const requestPayload = socketService.emittedEvents[0].payload as NpcBustReadRequest;
    const response: NpcBustReadResponse = {
      success: true,
      message: 'ok',
      correlationId: requestPayload.correlationId!,
      requestIdentity: requestPayload.requestIdentity!,
      npcId: 'npc-merchant-001',
      deterministicSeed: 'faction:trade|role:merchant|id:001',
      descriptor: {
        ...DEFAULT_BUST_DESCRIPTOR,
        faceShape: 'round',
        skinTone: 'light',
        hairStyle: 'slicked',
        hairColor: 'auburn',
        eyeStyle: 'wide',
        eyeColor: 'hazel',
        expressionPreset: 'warm',
        apparelAccent: 'collar',
      },
      appliedOverrides: [],
    };

    socketService.trigger(NPC_BUST_READ_RESPONSE_EVENT, response);

    expect(received).toEqual(response);
    expect(socketService.listenerCount(NPC_BUST_READ_RESPONSE_EVENT)).toBe(0);
  });

  it('updates NPC busts and routes hard-reject validation errors with full mapping fidelity', () => {
    const request: NpcBustUpdateRequest = {
      playerName: 'AdminUser',
      sessionKey: 'session-admin-1',
      npcId: 'npc-merchant-001',
      deterministicSeed: 'faction:trade|role:merchant|id:001',
      overrides: {
        expressionPreset: 'stern',
      },
    };
    let received: NpcBustUpdateTerminalResponse | undefined;

    service.updateNpcBust(request).subscribe((response) => {
      received = response;
    });

    const requestPayload = socketService.emittedEvents[0].payload as NpcBustUpdateRequest;
    const validationResponse: BustValidationErrorResponse = {
      success: false,
      message: 'Bust descriptor validation failed',
      correlationId: requestPayload.correlationId!,
      requestIdentity: requestPayload.requestIdentity!,
      validationErrors: [
        {
          field: 'overrides.expressionPreset',
          reason: 'not a valid enum value',
          rejectedValue: 'angry-smile',
        },
      ],
    };

    socketService.trigger(NPC_BUST_UPDATE_RESPONSE_EVENT, validationResponse);

    expect(received).toEqual(validationResponse);
    expect(received && 'validationErrors' in received ? received.validationErrors[0] : null).toEqual({
      field: 'overrides.expressionPreset',
      reason: 'not a valid enum value',
      rejectedValue: 'angry-smile',
    });
    expect(socketService.listenerCount(NPC_BUST_UPDATE_RESPONSE_EVENT)).toBe(0);
  });

  it('isolates concurrent NPC update requests under out-of-order responses', () => {
    const received: Record<string, NpcBustUpdateTerminalResponse | undefined> = {};

    service
      .updateNpcBust({
        playerName: 'AdminUser',
        sessionKey: 'session-admin-1',
        npcId: 'npc-merchant-001',
        deterministicSeed: 'seed-1',
      })
      .subscribe((response) => {
        received['first'] = response;
      });

    service
      .updateNpcBust({
        playerName: 'AdminUser',
        sessionKey: 'session-admin-1',
        npcId: 'npc-merchant-002',
        deterministicSeed: 'seed-2',
      })
      .subscribe((response) => {
        received['second'] = response;
      });

    const firstPayload = socketService.emittedEvents[0].payload as NpcBustUpdateRequest;
    const secondPayload = socketService.emittedEvents[1].payload as NpcBustUpdateRequest;

    const secondResponse: NpcBustUpdateTerminalResponse = {
      success: true,
      message: 'second',
      correlationId: secondPayload.correlationId!,
      requestIdentity: secondPayload.requestIdentity!,
      npcId: 'npc-merchant-002',
      deterministicSeed: 'seed-2',
      descriptor: {
        ...DEFAULT_BUST_DESCRIPTOR,
        faceShape: 'round',
        skinTone: 'light',
        hairStyle: 'slicked',
        hairColor: 'auburn',
        eyeStyle: 'wide',
        eyeColor: 'hazel',
        expressionPreset: 'warm',
        apparelAccent: 'collar',
      },
      appliedOverrides: [],
    };
    const firstResponse: NpcBustUpdateTerminalResponse = {
      success: true,
      message: 'first',
      correlationId: firstPayload.correlationId!,
      requestIdentity: firstPayload.requestIdentity!,
      npcId: 'npc-merchant-001',
      deterministicSeed: 'seed-1',
      descriptor: {
        ...DEFAULT_BUST_DESCRIPTOR,
      },
      appliedOverrides: [],
    };

    socketService.trigger(NPC_BUST_UPDATE_RESPONSE_EVENT, secondResponse);
    expect(received['first']).toBeUndefined();
    expect(received['second']).toEqual(secondResponse);

    socketService.trigger(NPC_BUST_UPDATE_RESPONSE_EVENT, firstResponse);
    expect(received['first']).toEqual(firstResponse);
    expect(socketService.listenerCount(NPC_BUST_UPDATE_RESPONSE_EVENT)).toBe(0);
  });
});