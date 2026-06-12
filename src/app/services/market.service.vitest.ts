import { TestBed } from '@angular/core/testing';
import {
  MARKET_LIST_BY_LOCATION_REQUEST_EVENT,
  MARKET_LIST_BY_LOCATION_RESPONSE_EVENT,
  type MarketListByLocationRequest,
  type MarketListByLocationResponse,
} from '../model/market-list';
import { SocketService } from './socket.service';
import { MarketService } from './market.service';

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

describe('MarketService', () => {
  let socketService: MockSocketService;
  let service: MarketService;

  beforeEach(() => {
    socketService = new MockSocketService();
    TestBed.configureTestingModule({
      providers: [{ provide: SocketService, useValue: socketService }],
    });
    service = TestBed.inject(MarketService);
  });

  it('emits market-list-by-location with correlation metadata and ignores mismatched responses', () => {
    const request: MarketListByLocationRequest = {
      playerName: 'Pioneer',
      sessionKey: 'session-1',
      solarSystemId: 'sol',
      positionKm: { x: 1, y: 2, z: 3 },
      distanceAu: 0.5,
      locationTypes: ['station', 'free-floating'],
      characterId: 'char-1',
      shipId: 'ship-1',
    };
    let received: MarketListByLocationResponse | undefined;

    service.listMarketsByLocation(request, (response) => {
      received = response;
    });

    expect(socketService.emittedEvents).toEqual([
      {
        eventName: MARKET_LIST_BY_LOCATION_REQUEST_EVENT,
        payload: expect.objectContaining({
          ...request,
          correlationId: expect.any(String),
          correlationSource: 'market-service.listMarketsByLocation',
          requestIdentity: {
            operation: 'market-list-by-location',
            entityType: 'market',
            containerId: 'sol',
          },
        }),
      },
    ]);
    expect(socketService.listenerCount(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT)).toBe(1);

    const requestPayload = socketService.emittedEvents[0].payload as MarketListByLocationRequest;

    socketService.trigger(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT, {
      success: true,
      message: 'wrong',
      correlationId: 'wrong-correlation-id',
      requestIdentity: requestPayload.requestIdentity!,
      playerName: 'Pioneer',
      solarSystemId: 'sol',
      positionKm: { x: 1, y: 2, z: 3 },
      distanceAu: 0.5,
      locationTypes: ['station', 'free-floating'],
      markets: [],
    } satisfies MarketListByLocationResponse);

    expect(received).toBeUndefined();
    expect(socketService.listenerCount(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT)).toBe(1);

    const response: MarketListByLocationResponse = {
      success: true,
      message: 'ok',
      correlationId: requestPayload.correlationId!,
      requestIdentity: requestPayload.requestIdentity!,
      playerName: 'Pioneer',
      solarSystemId: 'sol',
      positionKm: { x: 1, y: 2, z: 3 },
      distanceAu: 0.5,
      locationTypes: ['station', 'free-floating'],
      markets: [],
    };

    socketService.trigger(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT, response);

    expect(received).toEqual(response);
    expect(socketService.listenerCount(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT)).toBe(0);
  });

  it('isolates concurrent market-list-by-location requests under out-of-order responses', () => {
    const received: Record<string, MarketListByLocationResponse | undefined> = {};

    service.listMarketsByLocation(
      {
        playerName: 'Pioneer',
        sessionKey: 'session-1',
        solarSystemId: 'sol',
        positionKm: { x: 1, y: 2, z: 3 },
        distanceAu: 0.5,
      },
      (response) => {
        received['near'] = response;
      },
    );
    service.listMarketsByLocation(
      {
        playerName: 'Pioneer',
        sessionKey: 'session-1',
        solarSystemId: 'sol',
        positionKm: { x: 4, y: 5, z: 6 },
        distanceAu: 10,
      },
      (response) => {
        received['far'] = response;
      },
    );

    const nearPayload = socketService.emittedEvents[0].payload as MarketListByLocationRequest;
    const farPayload = socketService.emittedEvents[1].payload as MarketListByLocationRequest;

    const farResponse: MarketListByLocationResponse = {
      success: true,
      message: 'far',
      correlationId: farPayload.correlationId!,
      requestIdentity: farPayload.requestIdentity!,
      playerName: 'Pioneer',
      solarSystemId: 'sol',
      positionKm: { x: 4, y: 5, z: 6 },
      distanceAu: 10,
      markets: [],
    };
    const nearResponse: MarketListByLocationResponse = {
      success: true,
      message: 'near',
      correlationId: nearPayload.correlationId!,
      requestIdentity: nearPayload.requestIdentity!,
      playerName: 'Pioneer',
      solarSystemId: 'sol',
      positionKm: { x: 1, y: 2, z: 3 },
      distanceAu: 0.5,
      markets: [],
    };

    socketService.trigger(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT, farResponse);
    expect(received['far']).toEqual(farResponse);
    expect(received['near']).toBeUndefined();

    socketService.trigger(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT, nearResponse);
    expect(received['near']).toEqual(nearResponse);
    expect(socketService.listenerCount(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT)).toBe(0);
  });

  it('matches fallback responses without correlation metadata when request fields align', () => {
    let received: MarketListByLocationResponse | undefined;
    service.listMarketsByLocation(
      {
        playerName: 'Pioneer',
        sessionKey: 'session-1',
        solarSystemId: 'sol',
        positionKm: { x: 1, y: 2, z: 3 },
        distanceAu: 0.5,
        locationTypes: ['free-floating', 'station'],
      },
      (response) => {
        received = response;
      },
    );

    socketService.trigger(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      playerName: 'Pioneer',
      solarSystemId: 'sol',
      positionKm: { x: 1, y: 2, z: 3 },
      distanceAu: 0.5,
      locationTypes: ['station', 'free-floating'],
      markets: [],
    } as unknown as MarketListByLocationResponse);

    expect(received).toEqual(
      expect.objectContaining({
        success: true,
        message: 'ok',
        solarSystemId: 'sol',
      }),
    );
    expect(socketService.listenerCount(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT)).toBe(0);
  });

  it('rejects fallback responses when position differs', () => {
    let received: MarketListByLocationResponse | undefined;
    service.listMarketsByLocation(
      {
        playerName: 'Pioneer',
        sessionKey: 'session-1',
        solarSystemId: 'sol',
        positionKm: { x: 1, y: 2, z: 3 },
        distanceAu: 0.5,
      },
      (response) => {
        received = response;
      },
    );

    socketService.trigger(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT, {
      success: true,
      message: 'wrong-position',
      playerName: 'Pioneer',
      solarSystemId: 'sol',
      positionKm: { x: 1, y: 2, z: 4 },
      markets: [],
    } as unknown as MarketListByLocationResponse);

    expect(received).toBeUndefined();
    expect(socketService.listenerCount(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT)).toBe(1);
  });

  it('rejects fallback responses when distance differs', () => {
    let received: MarketListByLocationResponse | undefined;
    service.listMarketsByLocation(
      {
        playerName: 'Pioneer',
        sessionKey: 'session-1',
        solarSystemId: 'sol',
        positionKm: { x: 1, y: 2, z: 3 },
        distanceAu: 0.5,
      },
      (response) => {
        received = response;
      },
    );

    socketService.trigger(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT, {
      success: true,
      message: 'wrong-distance',
      playerName: 'Pioneer',
      solarSystemId: 'sol',
      positionKm: { x: 1, y: 2, z: 3 },
      distanceAu: 0.75,
      markets: [],
    } as unknown as MarketListByLocationResponse);

    expect(received).toBeUndefined();
    expect(socketService.listenerCount(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT)).toBe(1);
  });

  it('invokes callback once even if duplicate matching responses arrive', () => {
    const received: MarketListByLocationResponse[] = [];
    service.listMarketsByLocation(
      {
        playerName: 'Pioneer',
        sessionKey: 'session-1',
        solarSystemId: 'sol',
        positionKm: { x: 1, y: 2, z: 3 },
        distanceAu: 0.5,
      },
      (response) => {
        received.push(response);
      },
    );

    const payload = socketService.emittedEvents[0].payload as MarketListByLocationRequest;
    const response: MarketListByLocationResponse = {
      success: true,
      message: 'ok',
      correlationId: payload.correlationId!,
      requestIdentity: payload.requestIdentity!,
      playerName: 'Pioneer',
      solarSystemId: 'sol',
      positionKm: { x: 1, y: 2, z: 3 },
      markets: [],
    };

    socketService.trigger(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT, response);
    socketService.trigger(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT, response);

    expect(received).toHaveLength(1);
  });
});