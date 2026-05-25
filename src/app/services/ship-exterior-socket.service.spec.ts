import { TestBed } from '@angular/core/testing';
import {
  CELESTIAL_BODY_LIST_REQUEST_EVENT,
  CELESTIAL_BODY_LIST_RESPONSE_EVENT,
  type CelestialBodyListRequest,
  type CelestialBodyListResponse,
} from '../model/celestial-body-list';
import {
  ITEM_LIST_BY_LOCATION_REQUEST_EVENT,
  ITEM_LIST_BY_LOCATION_RESPONSE_EVENT,
  type ItemListByLocationRequest,
  type ItemListByLocationResponse,
} from '../model/item-list-by-location';
import { LAUNCH_ITEM_RESPONSE_EVENT, type LaunchItemRequest, type LaunchItemResponse } from '../model/launch-item';
import {
  SHIP_LIST_BY_OWNER_REQUEST_EVENT,
  SHIP_LIST_BY_OWNER_RESPONSE_EVENT,
  type ShipListByOwnerRequest,
  type ShipListByOwnerResponse,
} from '../model/ship-list-by-owner';
import { ShipExteriorSocketService } from './ship-exterior-socket.service';
import { SocketService } from './socket.service';

type Listener<T = unknown> = (payload: T) => void;

class MockSocketService {
  public events = new Map<string, Set<Listener>>();
  public emittedEvents: Array<{ eventName: string; payload: unknown }> = [];

  on(eventName: string, callback: Listener): () => void {
    const set = this.events.get(eventName) ?? new Set<Listener>();
    set.add(callback);
    this.events.set(eventName, set);

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

  launchItem(request: any): unknown {
    const requestIdentity =
      request.requestIdentity ??
      ({
        operation: 'launch-item',
        entityType: request.itemType,
        containerId: request.shipId,
        itemId: request.itemId,
        hotkey: request.hotkey,
        targetCelestialBodyId: request.targetCelestialBodyId,
        characterId: request.characterId,
      } as const);
    const requestWithCorrelation = {
      ...request,
      correlationId: request.correlationId ?? 'corr-launch-1',
      correlationSource: request.correlationSource ?? 'socket.launchItem',
      requestIdentity,
    };
    this.emittedEvents.push({ eventName: 'launchItem', payload: requestWithCorrelation });
    return requestWithCorrelation;
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

describe('ShipExteriorSocketService', () => {
  let socketService: MockSocketService;
  let service: ShipExteriorSocketService;

  beforeEach(() => {
    socketService = new MockSocketService();
    TestBed.configureTestingModule({
      providers: [{ provide: SocketService, useValue: socketService }],
    });
    service = TestBed.inject(ShipExteriorSocketService);
  });

  it('should emit owner-scoped ship list and resolve only matching responses', () => {
    let received: ShipListByOwnerResponse | undefined;
    const request: ShipListByOwnerRequest = {
      playerName: 'Pioneer',
      sessionKey: 'session-1',
      owner: { ownerType: 'player-character', characterId: 'char-1' },
    };

    const unsubscribe = service.listShipsByOwner(request, (response) => {
      received = response;
    });

    expect(socketService.emittedEvents[0]).toEqual({
      eventName: SHIP_LIST_BY_OWNER_REQUEST_EVENT,
      payload: jasmine.objectContaining({
        ...request,
        correlationId: jasmine.any(String),
        correlationSource: 'ship-exterior-socket.listShipsByOwner',
        requestIdentity: {
          operation: 'ship-list-by-owner',
          entityType: 'ship',
          containerId: 'player-character:char-1',
        },
      }),
    });
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

    if (!received) {
      fail('Expected ship-list response callback to be invoked');
      return;
    }
    expect(received).toEqual(response);
    expect(socketService.listenerCount(SHIP_LIST_BY_OWNER_RESPONSE_EVENT)).toBe(0);

    unsubscribe();
  });

  it('should isolate N=3 concurrent owner-scoped ship-list requests under out-of-order responses', () => {
    const requestA: ShipListByOwnerRequest = {
      playerName: 'Pioneer',
      sessionKey: 'session-1',
      owner: { ownerType: 'player-character', characterId: 'char-a' },
    };
    const requestB: ShipListByOwnerRequest = {
      playerName: 'Pioneer',
      sessionKey: 'session-1',
      owner: { ownerType: 'player-character', characterId: 'char-b' },
    };
    const requestC: ShipListByOwnerRequest = {
      playerName: 'Pioneer',
      sessionKey: 'session-1',
      owner: { ownerType: 'player-character', characterId: 'char-c' },
    };

    const received: Record<string, ShipListByOwnerResponse | undefined> = {};

    service.listShipsByOwner(requestA, (response) => {
      received['a'] = response;
    });
    service.listShipsByOwner(requestB, (response) => {
      received['b'] = response;
    });
    service.listShipsByOwner(requestC, (response) => {
      received['c'] = response;
    });

    expect(socketService.emittedEvents.length).toBe(3);
    expect(socketService.listenerCount(SHIP_LIST_BY_OWNER_RESPONSE_EVENT)).toBe(3);

    const payloadA = socketService.emittedEvents[0].payload as ShipListByOwnerRequest;
    const payloadB = socketService.emittedEvents[1].payload as ShipListByOwnerRequest;
    const payloadC = socketService.emittedEvents[2].payload as ShipListByOwnerRequest;

    const responseB: ShipListByOwnerResponse = {
      success: true,
      message: 'ok-b',
      correlationId: payloadB.correlationId,
      requestIdentity: payloadB.requestIdentity,
      owner: {
        ownerType: 'player-character',
        playerId: 'player-1',
        characterId: 'char-b',
        npcId: null,
        factionId: null,
      },
      ships: [],
    };
    const responseA: ShipListByOwnerResponse = {
      success: true,
      message: 'ok-a',
      correlationId: payloadA.correlationId,
      requestIdentity: payloadA.requestIdentity,
      owner: {
        ownerType: 'player-character',
        playerId: 'player-1',
        characterId: 'char-a',
        npcId: null,
        factionId: null,
      },
      ships: [],
    };
    const responseC: ShipListByOwnerResponse = {
      success: true,
      message: 'ok-c',
      correlationId: payloadC.correlationId,
      requestIdentity: payloadC.requestIdentity,
      owner: {
        ownerType: 'player-character',
        playerId: 'player-1',
        characterId: 'char-c',
        npcId: null,
        factionId: null,
      },
      ships: [],
    };

    socketService.trigger(SHIP_LIST_BY_OWNER_RESPONSE_EVENT, responseB);
    expect(received['b']).toEqual(responseB);
    expect(received['a']).toBeUndefined();
    expect(received['c']).toBeUndefined();

    socketService.trigger(SHIP_LIST_BY_OWNER_RESPONSE_EVENT, responseA);
    expect(received['a']).toEqual(responseA);
    expect(received['c']).toBeUndefined();

    socketService.trigger(SHIP_LIST_BY_OWNER_RESPONSE_EVENT, responseC);
    expect(received['c']).toEqual(responseC);
    expect(socketService.listenerCount(SHIP_LIST_BY_OWNER_RESPONSE_EVENT)).toBe(0);
  });

  it('should emit celestial-body-list and resolve only matching responses', () => {
    let received: CelestialBodyListResponse | undefined;
    const request: CelestialBodyListRequest = {
      sessionKey: 'session-1',
      playerName: 'Pioneer',
      solarSystemId: 'sol',
      positionKm: { x: 0, y: 0, z: 0 },
      distanceKm: 1000,
    };

    service.listCelestialBodies(request, (response) => {
      received = response;
    });

    expect(socketService.emittedEvents[0]).toEqual({
      eventName: CELESTIAL_BODY_LIST_REQUEST_EVENT,
      payload: jasmine.objectContaining({
        ...request,
        correlationId: jasmine.any(String),
        correlationSource: 'ship-exterior-socket.listCelestialBodies',
        requestIdentity: {
          operation: 'celestial-body-list',
          entityType: 'celestial-body',
          containerId: 'sol',
        },
      }),
    });

    const requestPayload = socketService.emittedEvents[0]?.payload as CelestialBodyListRequest;
    const correlationId = requestPayload.correlationId!;
    const requestIdentity = requestPayload.requestIdentity!;

    const mismatchResponse: CelestialBodyListResponse = {
      success: true,
      message: 'wrong response',
      correlationId: 'wrong-correlation-id',
      requestIdentity,
      playerName: 'Pioneer',
      solarSystemId: 'alpha-centauri',
      positionKm: { x: 0, y: 0, z: 0 },
      distanceKm: 1000,
      celestialBodies: [],
    };
    socketService.trigger(CELESTIAL_BODY_LIST_RESPONSE_EVENT, mismatchResponse);
    expect(received).toBeUndefined();
    expect(socketService.listenerCount(CELESTIAL_BODY_LIST_RESPONSE_EVENT)).toBe(1);

    const response: CelestialBodyListResponse = {
      success: true,
      message: 'ok',
      correlationId,
      requestIdentity,
      playerName: 'Pioneer',
      solarSystemId: 'sol',
      positionKm: { x: 0, y: 0, z: 0 },
      distanceKm: 1000,
      celestialBodies: [],
    };
    socketService.trigger(CELESTIAL_BODY_LIST_RESPONSE_EVENT, response);

    if (!received) {
      fail('Expected celestial-body-list response callback to be invoked');
      return;
    }
    expect(received).toEqual(response);
    expect(socketService.listenerCount(CELESTIAL_BODY_LIST_RESPONSE_EVENT)).toBe(0);
  });

  it('should emit item-list-by-location and resolve only matching responses', () => {
    let received: ItemListByLocationResponse | undefined;
    const request: ItemListByLocationRequest = {
      sessionKey: 'session-1',
      playerName: 'Pioneer',
      shipId: 'starter-char-1',
      location: {
        solarSystemId: 'sol',
        positionKm: { x: 10, y: 20, z: 30 },
      },
      maxDistanceKm: 500,
      limit: 50,
    };

    service.listNearbyDeployedItems(request, (response) => {
      received = response;
    });

    expect(socketService.emittedEvents[0]).toEqual({
      eventName: ITEM_LIST_BY_LOCATION_REQUEST_EVENT,
      payload: jasmine.objectContaining({
        ...request,
        correlationId: jasmine.any(String),
        correlationSource: 'ship-exterior-socket.listNearbyDeployedItems',
        requestIdentity: {
          operation: 'item-list-by-location',
          entityType: 'item',
          containerId: 'sol',
        },
      }),
    });

    const requestPayload = socketService.emittedEvents[0]?.payload as ItemListByLocationRequest;
    const correlationId = requestPayload.correlationId!;
    const requestIdentity = requestPayload.requestIdentity!;

    const mismatchResponse: ItemListByLocationResponse = {
      success: true,
      message: 'wrong response',
      correlationId: 'wrong-correlation-id',
      requestIdentity,
      items: [
        {
          id: 'item-2',
          itemType: 'probe',
          displayName: 'Probe',
          launchable: false,
          state: 'deployed',
          damageStatus: 'intact',
          container: { containerType: 'ship', containerId: 'other-ship' },
          owningPlayerId: null,
          owningCharacterId: null,
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: { x: 11, y: 20, z: 30 },
            epochMs: 1,
          },
          destroyedAt: null,
          destroyedReason: null,
          discoveredAt: null,
          discoveredByCharacterId: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };
    socketService.trigger(ITEM_LIST_BY_LOCATION_RESPONSE_EVENT, mismatchResponse);
    expect(received).toBeUndefined();
    expect(socketService.listenerCount(ITEM_LIST_BY_LOCATION_RESPONSE_EVENT)).toBe(1);

    const response: ItemListByLocationResponse = {
      success: true,
      message: 'ok',
      correlationId,
      requestIdentity,
      items: [],
    };
    socketService.trigger(ITEM_LIST_BY_LOCATION_RESPONSE_EVENT, response);

    if (!received) {
      fail('Expected item-list-by-location response callback to be invoked');
      return;
    }
    expect(received).toEqual(response);
    expect(socketService.listenerCount(ITEM_LIST_BY_LOCATION_RESPONSE_EVENT)).toBe(0);
  });

  it('should unsubscribe before response and ignore later emissions (negative)', () => {
    let called = false;
    const request: ItemListByLocationRequest = {
      sessionKey: 'session-1',
      playerName: 'Pioneer',
      shipId: 'starter-char-1',
      location: {
        solarSystemId: 'sol',
        positionKm: { x: 0, y: 0, z: 0 },
      },
    };

    const unsubscribe = service.listNearbyDeployedItems(request, () => {
      called = true;
    });

    expect(socketService.listenerCount(ITEM_LIST_BY_LOCATION_RESPONSE_EVENT)).toBe(1);
    unsubscribe();
    expect(socketService.listenerCount(ITEM_LIST_BY_LOCATION_RESPONSE_EVENT)).toBe(0);

    socketService.trigger(ITEM_LIST_BY_LOCATION_RESPONSE_EVENT, {
      success: true,
      items: [],
    } as ItemListByLocationResponse);

    expect(called).toBeFalse();
  });

  it('should forward launch requests through shared socket helper', () => {
    const request: LaunchItemRequest = {
      sessionKey: 'session-1',
      playerName: 'Pioneer',
      characterId: 'char-1',
      shipId: 'starter-char-1',
      targetCelestialBodyId: 'asteroid-1',
      hotkey: 1,
      itemId: 'item-1',
      itemType: 'probe',
    };

    service.launchItem(request);

    expect(socketService.emittedEvents[0].eventName).toBe('launchItem');
    expect(socketService.emittedEvents[0].payload).toEqual(
      jasmine.objectContaining({
        ...request,
        correlationId: jasmine.any(String),
        correlationSource: 'socket.launchItem',
        requestIdentity: {
          operation: 'launch-item',
          entityType: 'probe',
          containerId: 'starter-char-1',
          itemId: 'item-1',
          hotkey: 1,
          targetCelestialBodyId: 'asteroid-1',
          characterId: 'char-1',
        },
      }),
    );
  });

  it('should subscribe to launch responses and allow unsubscribe', () => {
    let received: LaunchItemResponse | undefined;

    service.launchItem({
      sessionKey: 'session-1',
      playerName: 'Pioneer',
      characterId: 'char-1',
      shipId: 'starter-char-1',
      targetCelestialBodyId: 'asteroid-1',
      hotkey: 1,
      itemId: 'item-1',
      itemType: 'probe',
    });
    const launchRequestPayload = socketService.emittedEvents[0].payload as LaunchItemRequest;

    const unsubscribe = service.subscribeLaunchResponses((response) => {
      received = response;
    });

    expect(socketService.listenerCount(LAUNCH_ITEM_RESPONSE_EVENT)).toBe(1);

    const response: LaunchItemResponse = {
      success: true,
      message: 'ok',
      playerName: 'Pioneer',
      characterId: 'char-1',
      shipId: 'starter-char-1',
      targetCelestialBodyId: 'asteroid-1',
      hotkey: 1,
      itemId: 'item-1',
      itemType: 'probe',
      correlationId: launchRequestPayload.correlationId,
      requestIdentity: launchRequestPayload.requestIdentity,
    };
    socketService.trigger(LAUNCH_ITEM_RESPONSE_EVENT, response);

    if (!received) {
      fail('Expected launch-item response callback to be invoked');
      return;
    }
    expect(received).toEqual(response);

    unsubscribe();
    expect(socketService.listenerCount(LAUNCH_ITEM_RESPONSE_EVENT)).toBe(0);
  });

  it('should drop unmatched launch responses when a different pending launch request exists', () => {
    let called = false;

    service.launchItem({
      sessionKey: 'session-1',
      playerName: 'Pioneer',
      characterId: 'char-1',
      shipId: 'starter-char-1',
      targetCelestialBodyId: 'asteroid-1',
      hotkey: 1,
      itemId: 'item-1',
      itemType: 'probe',
    });

    const unsubscribe = service.subscribeLaunchResponses(() => {
      called = true;
    });

    socketService.trigger(LAUNCH_ITEM_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      playerName: 'Pioneer',
      characterId: 'char-1',
      shipId: 'starter-char-1',
      targetCelestialBodyId: 'asteroid-1',
      hotkey: 1,
      itemId: 'item-1',
      itemType: 'probe',
      correlationId: 'unknown-correlation',
    } as LaunchItemResponse);

    expect(called).toBeFalse();
    unsubscribe();
  });
});
