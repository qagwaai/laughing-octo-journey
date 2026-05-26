import { fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import {
  SOLAR_SYSTEM_LIST_REQUEST_EVENT,
  SOLAR_SYSTEM_LIST_RESPONSE_EVENT,
  type SolarSystemListRequest,
  type SolarSystemListResponse,
} from '../model/solar-system-list';
import { SolarSystemService } from './solar-system.service';
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

describe('solar-system correlation integration', () => {
  let socketService: MockSocketService;
  let solarSystemService: SolarSystemService;

  beforeEach(() => {
    socketService = new MockSocketService();
    TestBed.configureTestingModule({
      providers: [SolarSystemService, { provide: SocketService, useValue: socketService }],
    });
    solarSystemService = TestBed.inject(SolarSystemService);
  });

  it('routes concurrent solar-system-list responses to matching requests', fakeAsync(() => {
    const curatedCallback = jasmine.createSpy('curatedCallback');
    solarSystemService.listSolarSystems(
      {
        playerName: 'Pioneer',
        sessionKey: 'session-1',
        source: 'curated',
        limit: 10,
      },
      curatedCallback,
    );

    const proceduralCallback = jasmine.createSpy('proceduralCallback');
    solarSystemService.listSolarSystems(
      {
        playerName: 'Pioneer',
        sessionKey: 'session-1',
        source: 'procedural',
        limit: 10,
      },
      proceduralCallback,
    );

    expect(socketService.emittedEvents.length).toBe(2);
    expect(socketService.listenerCount(SOLAR_SYSTEM_LIST_RESPONSE_EVENT)).toBe(2);

    const curatedRequest = socketService.emittedEvents[0].data as SolarSystemListRequest;
    const proceduralRequest = socketService.emittedEvents[1].data as SolarSystemListRequest;

    const proceduralResponse: SolarSystemListResponse = {
      success: true,
      message: 'procedural',
      correlationId: proceduralRequest.correlationId!,
      requestIdentity: proceduralRequest.requestIdentity!,
      requestId: proceduralRequest.requestId,
      playerName: 'Pioneer',
      solarSystems: [
        {
          id: 'proc-1',
          displayName: 'Proc One',
          source: 'procedural',
        },
      ],
    };

    const curatedResponse: SolarSystemListResponse = {
      success: true,
      message: 'curated',
      correlationId: curatedRequest.correlationId!,
      requestIdentity: curatedRequest.requestIdentity!,
      requestId: curatedRequest.requestId,
      playerName: 'Pioneer',
      solarSystems: [
        {
          id: 'sol',
          displayName: 'Sol',
          source: 'curated',
        },
      ],
    };

    socketService.trigger(SOLAR_SYSTEM_LIST_RESPONSE_EVENT, proceduralResponse);
    flushMicrotasks();

    expect(proceduralCallback).toHaveBeenCalledTimes(1);
    expect(proceduralCallback).toHaveBeenCalledWith(proceduralResponse);
    expect(curatedCallback).not.toHaveBeenCalled();

    socketService.trigger(SOLAR_SYSTEM_LIST_RESPONSE_EVENT, curatedResponse);
    flushMicrotasks();

    expect(curatedCallback).toHaveBeenCalledTimes(1);
    expect(curatedCallback).toHaveBeenCalledWith(curatedResponse);
  }));

  it('dispatches socket-correlation-warning when dropping mismatched list response', fakeAsync(() => {
    const callback = jasmine.createSpy('listCallback');
    const warningSpy = jasmine.createSpy('warningSpy');
    const listener = (event: Event): void => {
      warningSpy(event);
    };

    window.addEventListener('socket-correlation-warning', listener);
    try {
      solarSystemService.listSolarSystems(
        {
          playerName: 'Pioneer',
          sessionKey: 'session-1',
          source: 'curated',
          limit: 10,
        },
        callback,
      );

      const requestPayload = socketService.emittedEvents[0].data as SolarSystemListRequest;

      socketService.trigger(SOLAR_SYSTEM_LIST_RESPONSE_EVENT, {
        success: true,
        message: 'wrong-response',
        correlationId: 'wrong-correlation-id',
        requestIdentity: requestPayload.requestIdentity!,
        requestId: requestPayload.requestId,
        playerName: 'Pioneer',
        solarSystems: [],
      } satisfies SolarSystemListResponse);
      flushMicrotasks();

      expect(callback).not.toHaveBeenCalled();
      expect(warningSpy).toHaveBeenCalled();

      const customEvent = warningSpy.calls.mostRecent().args[0] as CustomEvent;
      expect(customEvent.detail.operation).toBe('solar-system-list');
      expect(customEvent.detail.responseCorrelationId).toBe('wrong-correlation-id');
      expect(customEvent.detail.expectedCorrelationId).toBe(requestPayload.correlationId);
    } finally {
      window.removeEventListener('socket-correlation-warning', listener);
    }
  }));
});
