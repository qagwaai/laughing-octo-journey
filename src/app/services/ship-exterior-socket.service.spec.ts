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

  launchItem(request: unknown): void {
    this.emittedEvents.push({ eventName: 'launchItem', payload: request });
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

  it('should emit owner-scoped ship list and resolve once', () => {
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
      payload: request,
    });
    expect(socketService.listenerCount(SHIP_LIST_BY_OWNER_RESPONSE_EVENT)).toBe(1);

    const response: ShipListByOwnerResponse = {
      success: true,
      message: 'ok',
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

  it('should emit celestial-body-list and resolve once', () => {
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

    expect(socketService.emittedEvents[0].eventName).toBe(CELESTIAL_BODY_LIST_REQUEST_EVENT);

    const response: CelestialBodyListResponse = {
      success: true,
      message: 'ok',
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

  it('should emit item-list-by-location and resolve once', () => {
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

    expect(socketService.emittedEvents[0].eventName).toBe(ITEM_LIST_BY_LOCATION_REQUEST_EVENT);

    const response: ItemListByLocationResponse = {
      success: true,
      message: 'ok',
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
    expect(socketService.emittedEvents[0].payload).toEqual(request);
  });

  it('should subscribe to launch responses and allow unsubscribe', () => {
    let received: LaunchItemResponse | undefined;

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
});
