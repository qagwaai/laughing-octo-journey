import { TestBed } from '@angular/core/testing';
import {
  MISSION_LIST_REQUEST_EVENT,
  MISSION_LIST_RESPONSE_EVENT,
  type MissionListRequest,
  type MissionListResponse,
} from '../model/mission-list';
import { SocketService } from './socket.service';
import { MissionBoardService } from './mission-board.service';

type Listener<T = unknown> = (payload: T) => void;

class MockSocketService {
  public readonly events = new Map<string, Set<Listener>>();
  public readonly emittedEvents: Array<{ event: string; data: unknown }> = [];

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

  emit(event: string, data: unknown): void {
    this.emittedEvents.push({ event, data });
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

describe('MissionBoardService', () => {
  let socketService: MockSocketService;
  let service: MissionBoardService;

  beforeEach(() => {
    socketService = new MockSocketService();
    TestBed.configureTestingModule({
      providers: [{ provide: SocketService, useValue: socketService }],
    });
    service = TestBed.inject(MissionBoardService);
  });

  it('emits mission-list with correlation metadata and ignores mismatched responses', () => {
    const request: MissionListRequest = {
      playerName: 'Pioneer',
      characterId: 'char-1',
      sessionKey: 'session-1',
    };
    let received: MissionListResponse | undefined;

    service.listMissions(request, (response) => {
      received = response;
    });

    expect(socketService.emittedEvents[0]).toEqual({
      event: MISSION_LIST_REQUEST_EVENT,
      data: jasmine.objectContaining({
        ...request,
        correlationId: jasmine.any(String),
        correlationSource: 'mission-board-service.listMissions',
        requestIdentity: {
          operation: 'mission-list',
          entityType: 'mission',
          containerId: 'char-1',
        },
      }),
    });
    expect(socketService.listenerCount(MISSION_LIST_RESPONSE_EVENT)).toBe(1);

    const requestPayload = socketService.emittedEvents[0].data as MissionListRequest;

    socketService.trigger(MISSION_LIST_RESPONSE_EVENT, {
      success: true,
      message: 'wrong',
      correlationId: 'wrong-correlation-id',
      requestIdentity: requestPayload.requestIdentity,
      playerName: 'Pioneer',
      characterId: 'char-1',
      missions: [],
    } satisfies MissionListResponse);

    expect(received).toBeUndefined();
    expect(socketService.listenerCount(MISSION_LIST_RESPONSE_EVENT)).toBe(1);

    const response: MissionListResponse = {
      success: true,
      message: 'ok',
      correlationId: requestPayload.correlationId,
      requestIdentity: requestPayload.requestIdentity,
      playerName: 'Pioneer',
      characterId: 'char-1',
      missions: [],
    };

    socketService.trigger(MISSION_LIST_RESPONSE_EVENT, response);

    expect(received).toEqual(response);
    expect(socketService.listenerCount(MISSION_LIST_RESPONSE_EVENT)).toBe(1);
  });

  it('returns an unsubscribe that removes the mission-list listener', () => {
    const unsubscribe = service.listMissions(
      {
        playerName: 'Pioneer',
        characterId: 'char-1',
        sessionKey: 'session-1',
      },
      () => undefined,
    );

    expect(socketService.listenerCount(MISSION_LIST_RESPONSE_EVENT)).toBe(1);
    unsubscribe();
    expect(socketService.listenerCount(MISSION_LIST_RESPONSE_EVENT)).toBe(0);
  });
});