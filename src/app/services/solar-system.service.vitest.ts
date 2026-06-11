import { TestBed } from '@angular/core/testing';
import { SOLAR_SYSTEM_GET_REQUEST_EVENT, SOLAR_SYSTEM_GET_RESPONSE_EVENT } from '../model/solar-system-get';
import { SOLAR_SYSTEM_LIST_REQUEST_EVENT, SOLAR_SYSTEM_LIST_RESPONSE_EVENT } from '../model/solar-system-list';
import { SocketService } from './socket.service';
import { SolarSystemService } from './solar-system.service';

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
    return () => set.delete(callback);
  }

  once(eventName: string, callback: Listener): void {
    const unsubscribe = this.on(eventName, (payload) => {
      unsubscribe();
      callback(payload);
    });
  }

  trigger(eventName: string, payload: unknown): void {
    const set = this.listeners.get(eventName);
    if (!set) {
      return;
    }
    for (const listener of Array.from(set)) {
      listener(payload);
    }
  }
}

describe('SolarSystemService', () => {
  let socket: MockSocketService;
  let service: SolarSystemService;

  beforeEach(() => {
    socket = new MockSocketService();
    TestBed.configureTestingModule({
      providers: [SolarSystemService, { provide: SocketService, useValue: socket }],
    });
    service = TestBed.inject(SolarSystemService);
  });

  it('emits solar-system-list-request and resolves only matching responses', () => {
    const callback = vi.fn();

    service.listSolarSystems(
      { playerName: 'Pilot', sessionKey: 'sk', limit: 50 },
      callback as unknown as (response: import('../model/solar-system-list').SolarSystemListResponse) => void,
    );

    expect(socket.emittedEvents[0].event).toBe(SOLAR_SYSTEM_LIST_REQUEST_EVENT);
    expect(socket.emittedEvents[0].data).toEqual(
      expect.objectContaining({
        playerName: 'Pilot',
        sessionKey: 'sk',
        limit: 50,
        correlationId: expect.any(String),
        correlationSource: 'solar-system-service.listSolarSystems',
        requestIdentity: {
          operation: 'solar-system-list',
          entityType: 'all-sources',
          containerId: 'pilot||||50',
        },
      }),
    );

    const requestPayload = socket.emittedEvents[0].data as {
      correlationId?: string;
      requestIdentity?: unknown;
    };

    socket.trigger(SOLAR_SYSTEM_LIST_RESPONSE_EVENT, {
      success: true,
      message: 'wrong',
      correlationId: 'wrong-correlation-id',
      requestIdentity: requestPayload.requestIdentity!,
      playerName: 'Other',
      solarSystems: [],
    });
    expect(callback).not.toHaveBeenCalled();

    socket.trigger(SOLAR_SYSTEM_LIST_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      correlationId: requestPayload.correlationId!,
      requestIdentity: requestPayload.requestIdentity!,
      playerName: 'Pilot',
      solarSystems: [],
    });
    socket.trigger(SOLAR_SYSTEM_LIST_RESPONSE_EVENT, {
      success: true,
      message: 'late',
      playerName: 'Pilot',
      solarSystems: [],
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0].message).toBe('ok');
  });

  it('emits solar-system-get-request and resolves only matching responses', () => {
    const callback = vi.fn();

    service.getSolarSystem(
      { playerName: 'Pilot', sessionKey: 'sk', solarSystemId: 'sol' },
      callback as unknown as (response: import('../model/solar-system-get').SolarSystemGetResponse) => void,
    );

    expect(socket.emittedEvents[0].event).toBe(SOLAR_SYSTEM_GET_REQUEST_EVENT);
    expect(socket.emittedEvents[0].data).toEqual(
      expect.objectContaining({
        playerName: 'Pilot',
        sessionKey: 'sk',
        solarSystemId: 'sol',
        correlationId: expect.any(String),
        correlationSource: 'solar-system-service.getSolarSystem',
        requestIdentity: {
          operation: 'solar-system-get',
          entityType: 'sol',
          containerId: 'pilot|sol|',
        },
      }),
    );

    const requestPayload = socket.emittedEvents[0].data as {
      correlationId?: string;
      requestIdentity?: unknown;
    };

    socket.trigger(SOLAR_SYSTEM_GET_RESPONSE_EVENT, {
      success: true,
      message: 'wrong',
      correlationId: 'wrong-correlation-id',
      requestIdentity: requestPayload.requestIdentity!,
      solarSystemId: 'sol',
      bodies: [],
    });
    expect(callback).not.toHaveBeenCalled();

    socket.trigger(SOLAR_SYSTEM_GET_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      correlationId: requestPayload.correlationId!,
      requestIdentity: requestPayload.requestIdentity!,
      solarSystemId: 'sol',
      bodies: [],
    });

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('ignores unmatched get responses when requestId differs', () => {
    const callback = vi.fn();

    service.getSolarSystem(
      { playerName: 'Pilot', sessionKey: 'sk', solarSystemId: 'sol' },
      callback as unknown as (response: import('../model/solar-system-get').SolarSystemGetResponse) => void,
    );

    const requestPayload = socket.emittedEvents[0].data as { requestId?: string };
    expect(typeof requestPayload.requestId).toBe('string');

    socket.trigger(SOLAR_SYSTEM_GET_RESPONSE_EVENT, {
      success: true,
      message: 'wrong',
      requestId: 'other-request-id',
      solarSystemId: 'sol',
      bodies: [{ id: 'b-1' }],
    });

    expect(callback).not.toHaveBeenCalled();

    socket.trigger(SOLAR_SYSTEM_GET_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      requestId: requestPayload.requestId,
      solarSystemId: 'sol',
      bodies: [],
    });

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback.mock.calls[0][0].message).toBe('ok');
  });
});
