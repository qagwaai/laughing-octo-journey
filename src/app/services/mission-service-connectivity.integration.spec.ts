import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { MISSION_LIST_REQUEST_EVENT, MISSION_LIST_RESPONSE_EVENT, type MissionListRequest } from '../model/mission-list';
import { MissionService } from './mission.service';
import { SocketService } from './socket.service';

type Listener = (payload: unknown) => void;

class MockSocketService {
  serverUrl = 'http://localhost:3000';
  connected = false;
  connectCalls: Array<{ url: string; options?: unknown }> = [];
  emittedEvents: Array<{ event: string; data: unknown }> = [];
  private listeners = new Map<string, Set<Listener>>();
  private onceListeners = new Map<string, Set<Listener>>();

  connect(url: string, options?: unknown): void {
    this.connectCalls.push({ url, options });
  }

  getIsConnected(): boolean {
    return this.connected;
  }

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

  once(eventName: string, callback: Listener): void {
    const set = this.onceListeners.get(eventName) ?? new Set<Listener>();
    set.add(callback);
    this.onceListeners.set(eventName, set);
  }

  trigger(eventName: string, payload: unknown): void {
    for (const listener of Array.from(this.listeners.get(eventName) ?? [])) {
      listener(payload);
    }

    const once = this.onceListeners.get(eventName);
    if (once) {
      this.onceListeners.delete(eventName);
      for (const listener of Array.from(once)) {
        listener(payload);
      }
    }
  }
}

describe('MissionService connectivity integration', () => {
  let socketService: MockSocketService;
  let missionService: MissionService;

  beforeEach(() => {
    socketService = new MockSocketService();
    TestBed.configureTestingModule({
      providers: [MissionService, { provide: SocketService, useValue: socketService }],
    });

    missionService = TestBed.inject(MissionService);
  });

  it('returns not-connected when connect event does not arrive before timeout', fakeAsync(() => {
    let result: Awaited<ReturnType<MissionService['listMissions']>> | undefined;

    missionService
      .listMissions({
        playerName: 'Pioneer',
        characterId: 'char-1',
        sessionKey: 'session-1',
      })
      .then((value) => {
        result = value;
      });

    tick(5001);
    flushMicrotasks();

    expect(socketService.connectCalls.length).toBe(1);
    expect(socketService.connectCalls[0].url).toBe(socketService.serverUrl);
    expect(result).toEqual({ status: 'not-connected', missions: [] });
    expect(socketService.emittedEvents.length).toBe(0);
  }));

  it('proceeds after delayed connect and resolves mission-list response', fakeAsync(() => {
    let result: Awaited<ReturnType<MissionService['listMissions']>> | undefined;

    missionService
      .listMissions({
        playerName: 'Pioneer',
        characterId: 'char-1',
        sessionKey: 'session-1',
      })
      .then((value) => {
        result = value;
      });

    expect(socketService.connectCalls.length).toBe(1);

    socketService.connected = true;
    socketService.trigger('connect', undefined);
    flushMicrotasks();

    expect(socketService.emittedEvents.length).toBe(1);
    expect(socketService.emittedEvents[0].event).toBe(MISSION_LIST_REQUEST_EVENT);

    const requestPayload = socketService.emittedEvents[0].data as MissionListRequest;

    socketService.trigger(MISSION_LIST_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      correlationId: requestPayload.correlationId,
      requestIdentity: requestPayload.requestIdentity,
      playerName: 'Pioneer',
      characterId: 'char-1',
      missions: [{ missionId: 'first-target', status: 'started' }],
    });
    flushMicrotasks();

    expect(result).toEqual({
      status: 'loaded',
      missions: [{ missionId: 'first-target', status: 'started' }],
    });
  }));
});
