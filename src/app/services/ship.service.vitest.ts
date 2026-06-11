import { TestBed } from '@angular/core/testing';
import {
  SHIP_LIST_BY_OWNER_REQUEST_EVENT,
  SHIP_LIST_BY_OWNER_RESPONSE_EVENT,
  type ShipListByOwnerRequest,
  type ShipListByOwnerResponse,
} from '../model/ship-list-by-owner';
import {
  SHIP_TRANSFER_REQUEST_EVENT,
  SHIP_TRANSFER_RESPONSE_EVENT,
  type ShipTransferRequest,
  type ShipTransferResponse,
} from '../model/ship-transfer';
import { SocketService } from './socket.service';
import { ShipService } from './ship.service';

type Listener<T = unknown> = (payload: T) => void;

class MockSocketService {
  public readonly events = new Map<string, Set<Listener>>();
  public readonly onceEvents = new Map<string, Set<Listener>>();
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

  once(eventName: string, callback: Listener): void {
    const listeners = this.onceEvents.get(eventName) ?? new Set<Listener>();
    listeners.add(callback);
    this.onceEvents.set(eventName, listeners);
  }

  emit(eventName: string, payload: unknown): void {
    this.emittedEvents.push({ eventName, payload });
  }

  trigger<T>(eventName: string, payload: T): void {
    const listeners = Array.from(this.events.get(eventName) ?? []);
    for (const listener of listeners) {
      listener(payload);
    }

    const onceListeners = Array.from(this.onceEvents.get(eventName) ?? []);
    this.onceEvents.delete(eventName);
    for (const listener of onceListeners) {
      listener(payload);
    }
  }

  listenerCount(eventName: string): number {
    return (this.events.get(eventName)?.size ?? 0) + (this.onceEvents.get(eventName)?.size ?? 0);
  }
}

describe('ShipService', () => {
  let socketService: MockSocketService;
  let service: ShipService;

  beforeEach(() => {
    socketService = new MockSocketService();
    TestBed.configureTestingModule({
      providers: [{ provide: SocketService, useValue: socketService }],
    });
    service = TestBed.inject(ShipService);
  });

  it('emits ship-list-by-owner and resolves only matching responses', () => {
    const request: ShipListByOwnerRequest = {
      playerName: 'Pioneer',
      sessionKey: 'session-1',
      owner: { ownerType: 'player-character', characterId: 'char-1' },
    };
    let received: ShipListByOwnerResponse | undefined;

    service.listShipsByOwner(request, (response) => {
      received = response;
    });

    expect(socketService.emittedEvents).toEqual([
      {
        eventName: SHIP_LIST_BY_OWNER_REQUEST_EVENT,
        payload: expect.objectContaining({
          ...request,
          correlationId: expect.any(String),
          correlationSource: 'ship-service.listShipsByOwner',
          requestIdentity: {
            operation: 'ship-list-by-owner',
            entityType: 'ship',
            containerId: 'player-character:char-1',
          },
        }),
      },
    ]);
    expect(socketService.listenerCount(SHIP_LIST_BY_OWNER_RESPONSE_EVENT)).toBe(1);

    const requestPayload = socketService.emittedEvents[0]?.payload as ShipListByOwnerRequest;
    const correlationId = requestPayload.correlationId!;
    const requestIdentity = requestPayload.requestIdentity!;

    const mismatchResponse: ShipListByOwnerResponse = {
      success: true,
      message: 'wrong response',
      correlationId: 'wrong-correlation-id',
      requestIdentity,
      owner: {
        ownerType: 'player-character',
        playerId: 'player-1',
        characterId: 'char-2',
        npcId: null,
        factionId: null,
      },
      ships: [],
    };

    socketService.trigger(SHIP_LIST_BY_OWNER_RESPONSE_EVENT, mismatchResponse);
    expect(received).toBeUndefined();
    expect(socketService.listenerCount(SHIP_LIST_BY_OWNER_RESPONSE_EVENT)).toBe(1);

    const response: ShipListByOwnerResponse = {
      success: true,
      message: 'ok',
      correlationId,
      requestIdentity,
      owner: {
        ownerType: 'player-character',
        playerId: 'player-1',
        characterId: 'char-1',
        npcId: null,
        factionId: null,
      },
      ships: [],
    };

    socketService.trigger(SHIP_LIST_BY_OWNER_RESPONSE_EVENT, response);

    expect(received).toEqual(response);
    expect(socketService.listenerCount(SHIP_LIST_BY_OWNER_RESPONSE_EVENT)).toBe(0);
  });

  it('emits ship-transfer and resolves only matching responses', () => {
    const request: ShipTransferRequest = {
      playerName: 'Pioneer',
      sessionKey: 'session-1',
      shipId: 'ship-1',
      toOwner: {
        ownerType: 'player-character',
        playerId: 'player-2',
        characterId: 'char-2',
        npcId: null,
        factionId: null,
      },
    };
    let received: ShipTransferResponse | undefined;

    service.transferShip(request, (response) => {
      received = response;
    });

    expect(socketService.emittedEvents).toEqual([
      {
        eventName: SHIP_TRANSFER_REQUEST_EVENT,
        payload: expect.objectContaining({
          ...request,
          correlationId: expect.any(String),
          correlationSource: 'ship-service.transferShip',
          requestIdentity: {
            operation: 'ship-transfer',
            entityType: 'ship',
            containerId: 'ship-1',
          },
        }),
      },
    ]);
    expect(socketService.listenerCount(SHIP_TRANSFER_RESPONSE_EVENT)).toBe(1);

    const requestPayload = socketService.emittedEvents[0]?.payload as ShipTransferRequest;
    const correlationId = requestPayload.correlationId!;
    const requestIdentity = requestPayload.requestIdentity!;

    const mismatchResponse: ShipTransferResponse = {
      success: true,
      message: 'wrong response',
      correlationId: 'wrong-correlation-id',
      requestIdentity,
      shipId: 'ship-2',
      toOwner: {
        ownerType: 'player-character',
        playerId: 'player-2',
        characterId: 'char-2',
        npcId: null,
        factionId: null,
      },
    };

    socketService.trigger(SHIP_TRANSFER_RESPONSE_EVENT, mismatchResponse);
    expect(received).toBeUndefined();
    expect(socketService.listenerCount(SHIP_TRANSFER_RESPONSE_EVENT)).toBe(1);

    const response: ShipTransferResponse = {
      success: true,
      message: 'ok',
      correlationId,
      requestIdentity,
      shipId: 'ship-1',
      toOwner: {
        ownerType: 'player-character',
        playerId: 'player-2',
        characterId: 'char-2',
        npcId: null,
        factionId: null,
      },
    };

    socketService.trigger(SHIP_TRANSFER_RESPONSE_EVENT, response);

    expect(received).toEqual(response);
    expect(socketService.listenerCount(SHIP_TRANSFER_RESPONSE_EVENT)).toBe(0);
  });
});
