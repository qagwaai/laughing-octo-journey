import { fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import {
  SHIP_LIST_BY_OWNER_REQUEST_EVENT,
  SHIP_LIST_BY_OWNER_RESPONSE_EVENT,
  type ShipListByOwnerRequest,
  type ShipListByOwnerResponse,
} from '../model/ship-list-by-owner';
import { ShipExteriorSocketService } from './ship-exterior-socket.service';
import { ShipService } from './ship.service';
import { SocketService } from './socket.service';

type Listener<T = unknown> = (payload: T) => void;

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

describe('ship-list correlation integration', () => {
  let socketService: MockSocketService;
  let shipService: ShipService;
  let shipExteriorSocketService: ShipExteriorSocketService;

  beforeEach(() => {
    socketService = new MockSocketService();
    TestBed.configureTestingModule({
      providers: [ShipService, ShipExteriorSocketService, { provide: SocketService, useValue: socketService }],
    });

    shipService = TestBed.inject(ShipService);
    shipExteriorSocketService = TestBed.inject(ShipExteriorSocketService);
  });

  it('routes concurrent ship-list responses to the correct wrappers', fakeAsync(() => {
    const shipServiceCallback = jasmine.createSpy('shipServiceCallback');
    shipService.listShipsByOwner(
      {
        playerName: 'Pioneer',
        sessionKey: 'session-1',
        owner: { ownerType: 'player-character', characterId: 'char-a' },
      },
      shipServiceCallback,
    );

    const shipExteriorCallback = jasmine.createSpy('shipExteriorCallback');
    shipExteriorSocketService.listShipsByOwner(
      {
        playerName: 'Pioneer',
        sessionKey: 'session-1',
        owner: { ownerType: 'player-character', characterId: 'char-b' },
      },
      shipExteriorCallback,
    );

    expect(socketService.emittedEvents.length).toBe(2);
    expect(socketService.listenerCount(SHIP_LIST_BY_OWNER_RESPONSE_EVENT)).toBe(2);

    const shipServiceRequest = socketService.emittedEvents.find(
      (entry) =>
        entry.event === SHIP_LIST_BY_OWNER_REQUEST_EVENT &&
        (entry.data as ShipListByOwnerRequest).correlationSource === 'ship-service.listShipsByOwner',
    )?.data as ShipListByOwnerRequest;

    const shipExteriorRequest = socketService.emittedEvents.find(
      (entry) =>
        entry.event === SHIP_LIST_BY_OWNER_REQUEST_EVENT &&
        (entry.data as ShipListByOwnerRequest).correlationSource === 'ship-exterior-socket.listShipsByOwner',
    )?.data as ShipListByOwnerRequest;

    expect(shipServiceRequest.correlationId).toEqual(jasmine.any(String));
    expect(shipExteriorRequest.correlationId).toEqual(jasmine.any(String));

    const exteriorResponse: ShipListByOwnerResponse = {
      success: true,
      message: 'ship-exterior',
      correlationId: shipExteriorRequest.correlationId!,
      requestIdentity: shipExteriorRequest.requestIdentity!,
      owner: {
        ownerType: 'player-character',
        playerId: null,
        characterId: 'char-b',
        npcId: null,
        factionId: null,
      },
      ships: [
        {
          id: 'ship-b',
          name: 'Exterior Ship',
          model: 'Scavenger Pod',
          tier: 1,
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: { x: 0, y: 0, z: 0 },
            epochMs: 1,
          },
        },
      ],
    };

    const shipServiceResponse: ShipListByOwnerResponse = {
      success: true,
      message: 'ship-service',
      correlationId: shipServiceRequest.correlationId!,
      requestIdentity: shipServiceRequest.requestIdentity!,
      owner: {
        ownerType: 'player-character',
        playerId: null,
        characterId: 'char-a',
        npcId: null,
        factionId: null,
      },
      ships: [
        {
          id: 'ship-a',
          name: 'Main Ship',
          model: 'Scavenger Pod',
          tier: 1,
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: { x: 10, y: 0, z: 0 },
            epochMs: 1,
          },
        },
      ],
    };

    socketService.trigger(SHIP_LIST_BY_OWNER_RESPONSE_EVENT, exteriorResponse);
    flushMicrotasks();

    expect(shipExteriorCallback).toHaveBeenCalledTimes(1);
    expect(shipExteriorCallback).toHaveBeenCalledWith(exteriorResponse);
    expect(shipServiceCallback).not.toHaveBeenCalled();

    socketService.trigger(SHIP_LIST_BY_OWNER_RESPONSE_EVENT, shipServiceResponse);
    flushMicrotasks();

    expect(shipServiceCallback).toHaveBeenCalledTimes(1);
    expect(shipServiceCallback).toHaveBeenCalledWith(shipServiceResponse);
  }));

  it('keeps ship-exterior strict when responses omit correlation metadata', fakeAsync(() => {
    const shipServiceCallback = jasmine.createSpy('shipServiceCallback');
    shipService.listShipsByOwner(
      {
        playerName: 'Pioneer',
        sessionKey: 'session-1',
        owner: { ownerType: 'player-character', characterId: 'char-a' },
      },
      shipServiceCallback,
    );

    const shipExteriorCallback = jasmine.createSpy('shipExteriorCallback');
    shipExteriorSocketService.listShipsByOwner(
      {
        playerName: 'Pioneer',
        sessionKey: 'session-1',
        owner: { ownerType: 'player-character', characterId: 'char-b' },
      },
      shipExteriorCallback,
    );

    socketService.trigger(SHIP_LIST_BY_OWNER_RESPONSE_EVENT, {
      success: true,
      message: 'legacy-char-b',
      owner: {
        ownerType: 'player-character',
        characterId: 'char-b',
      } as any,
      ships: [
        {
          id: 'ship-b',
          name: 'Exterior Ship',
          model: 'Scavenger Pod',
          tier: 1,
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: { x: 0, y: 0, z: 0 },
            epochMs: 1,
          },
        },
      ],
    } as ShipListByOwnerResponse);
    flushMicrotasks();

    expect(shipExteriorCallback).not.toHaveBeenCalled();
    expect(shipServiceCallback).not.toHaveBeenCalled();

    socketService.trigger(SHIP_LIST_BY_OWNER_RESPONSE_EVENT, {
      success: true,
      message: 'legacy-char-a',
      owner: {
        ownerType: 'player-character',
        characterId: 'char-a',
      } as any,
      ships: [
        {
          id: 'ship-a',
          name: 'Main Ship',
          model: 'Scavenger Pod',
          tier: 1,
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: { x: 10, y: 0, z: 0 },
            epochMs: 1,
          },
        },
      ],
    } as ShipListByOwnerResponse);
    flushMicrotasks();

    expect(shipExteriorCallback).not.toHaveBeenCalled();
    expect(shipServiceCallback).toHaveBeenCalledTimes(1);
  }));

  it('dispatches socket-correlation-warning when dropping mismatched ship-list response', fakeAsync(() => {
    const shipServiceCallback = jasmine.createSpy('shipServiceCallback');
    const warningSpy = jasmine.createSpy('warningSpy');
    const listener = (event: Event): void => {
      warningSpy(event);
    };

    window.addEventListener('socket-correlation-warning', listener);
    try {
      shipService.listShipsByOwner(
        {
          playerName: 'Pioneer',
          sessionKey: 'session-1',
          owner: { ownerType: 'player-character', characterId: 'char-a' },
        },
        shipServiceCallback,
      );

      const requestPayload = socketService.emittedEvents[0].data as ShipListByOwnerRequest;
      const mismatchedRequestIdentity = {
        ...(requestPayload.requestIdentity ?? {}),
        containerId: 'player-character:char-b',
      };

      socketService.trigger(SHIP_LIST_BY_OWNER_RESPONSE_EVENT, {
        success: true,
        message: 'wrong-response',
        correlationId: requestPayload.correlationId!,
        requestIdentity: mismatchedRequestIdentity as any,
        owner: {
          ownerType: 'player-character',
          characterId: 'char-b',
        } as any,
        ships: [],
      } as ShipListByOwnerResponse);
      flushMicrotasks();

      expect(shipServiceCallback).not.toHaveBeenCalled();
      expect(warningSpy).toHaveBeenCalled();

      const customEvent = warningSpy.calls.mostRecent().args[0] as CustomEvent;
      expect(customEvent.detail.operation).toBe('ship-list-by-owner');
      expect(customEvent.detail.responseCorrelationId).toBe(requestPayload.correlationId);
      expect(customEvent.detail.expectedCorrelationId).toBe(requestPayload.correlationId);
    } finally {
      window.removeEventListener('socket-correlation-warning', listener);
    }
  }));
});
