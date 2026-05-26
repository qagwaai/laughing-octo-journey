import { fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import {
  MARKET_LIST_BY_LOCATION_REQUEST_EVENT,
  MARKET_LIST_BY_LOCATION_RESPONSE_EVENT,
  type MarketListByLocationRequest,
  type MarketListByLocationResponse,
} from '../model/market-list';
import { MarketService } from './market.service';
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

describe('market correlation integration', () => {
  let socketService: MockSocketService;
  let marketService: MarketService;

  beforeEach(() => {
    socketService = new MockSocketService();
    TestBed.configureTestingModule({
      providers: [MarketService, { provide: SocketService, useValue: socketService }],
    });
    marketService = TestBed.inject(MarketService);
  });

  it('routes concurrent market-list-by-location responses to the matching request', fakeAsync(() => {
    const nearCallback = jasmine.createSpy('nearCallback');
    marketService.listMarketsByLocation(
      {
        playerName: 'Pioneer',
        sessionKey: 'session-1',
        solarSystemId: 'sol',
        positionKm: { x: 0, y: 0, z: 0 },
        distanceAu: 0.5,
        locationTypes: ['station'],
      },
      nearCallback,
    );

    const farCallback = jasmine.createSpy('farCallback');
    marketService.listMarketsByLocation(
      {
        playerName: 'Pioneer',
        sessionKey: 'session-1',
        solarSystemId: 'sol',
        positionKm: { x: 20, y: 0, z: 0 },
        distanceAu: 5,
        locationTypes: ['free-floating'],
      },
      farCallback,
    );

    expect(socketService.emittedEvents.length).toBe(2);
    expect(socketService.listenerCount(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT)).toBe(2);

    const nearRequest = socketService.emittedEvents[0].data as MarketListByLocationRequest;
    const farRequest = socketService.emittedEvents[1].data as MarketListByLocationRequest;

    const farResponse: MarketListByLocationResponse = {
      success: true,
      message: 'far',
      correlationId: farRequest.correlationId!,
      requestIdentity: farRequest.requestIdentity!,
      playerName: 'Pioneer',
      solarSystemId: 'sol',
      positionKm: { x: 20, y: 0, z: 0 },
      distanceAu: 5,
      locationTypes: ['free-floating'],
      markets: [],
    };

    const nearResponse: MarketListByLocationResponse = {
      success: true,
      message: 'near',
      correlationId: nearRequest.correlationId!,
      requestIdentity: nearRequest.requestIdentity!,
      playerName: 'Pioneer',
      solarSystemId: 'sol',
      positionKm: { x: 0, y: 0, z: 0 },
      distanceAu: 0.5,
      locationTypes: ['station'],
      markets: [],
    };

    socketService.trigger(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT, farResponse);
    flushMicrotasks();

    expect(farCallback).toHaveBeenCalledTimes(1);
    expect(farCallback).toHaveBeenCalledWith(farResponse);
    expect(nearCallback).not.toHaveBeenCalled();

    socketService.trigger(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT, nearResponse);
    flushMicrotasks();

    expect(nearCallback).toHaveBeenCalledTimes(1);
    expect(nearCallback).toHaveBeenCalledWith(nearResponse);
  }));

  it('drops legacy-style responses when correlation does not match', fakeAsync(() => {
    const nearCallback = jasmine.createSpy('nearCallback');
    marketService.listMarketsByLocation(
      {
        playerName: 'Pioneer',
        sessionKey: 'session-1',
        solarSystemId: 'sol',
        positionKm: { x: 0, y: 0, z: 0 },
        distanceAu: 0.5,
        locationTypes: ['station'],
      },
      nearCallback,
    );

    const farCallback = jasmine.createSpy('farCallback');
    marketService.listMarketsByLocation(
      {
        playerName: 'Pioneer',
        sessionKey: 'session-1',
        solarSystemId: 'sol',
        positionKm: { x: 20, y: 0, z: 0 },
        distanceAu: 5,
        locationTypes: ['free-floating'],
      },
      farCallback,
    );

    socketService.trigger(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT, {
      success: true,
      message: 'legacy-far',
      correlationId: '00000000-0000-4000-8000-000000000007',
      requestIdentity: {
        operation: 'list-markets-by-location',
        entityType: 'market',
        containerId: 'sol',
      },
      playerName: 'Pioneer',
      solarSystemId: 'sol',
      positionKm: { x: 20, y: 0, z: 0 },
      distanceAu: 5,
      locationTypes: ['free-floating'],
      markets: [],
    } satisfies MarketListByLocationResponse);
    flushMicrotasks();

    expect(farCallback).not.toHaveBeenCalled();
    expect(nearCallback).not.toHaveBeenCalled();

    socketService.trigger(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT, {
      success: true,
      message: 'legacy-near',
      correlationId: '00000000-0000-4000-8000-000000000008',
      requestIdentity: {
        operation: 'list-markets-by-location',
        entityType: 'market',
        containerId: 'sol',
      },
      playerName: 'Pioneer',
      solarSystemId: 'sol',
      positionKm: { x: 0, y: 0, z: 0 },
      distanceAu: 0.5,
      locationTypes: ['station'],
      markets: [],
    } satisfies MarketListByLocationResponse);
    flushMicrotasks();

    expect(nearCallback).not.toHaveBeenCalled();
    expect(farCallback).not.toHaveBeenCalled();
  }));
});
