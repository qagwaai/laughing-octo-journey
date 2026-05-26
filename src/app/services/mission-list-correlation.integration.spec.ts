import { fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import {
  MISSION_LIST_REQUEST_EVENT,
  MISSION_LIST_RESPONSE_EVENT,
  type MissionListRequest,
  type MissionListResponse,
} from '../model/mission-list';
import { MissionBoardService } from './mission-board.service';
import { MissionService, type ListMissionsResult } from './mission.service';
import { SocketService } from './socket.service';

type Listener<T = unknown> = (payload: T) => void;

class MockSocketService {
  serverUrl = 'http://localhost:3000';
  connected = true;
  connectCalls = 0;
  emittedEvents: Array<{ event: string; data: unknown }> = [];
  private listeners = new Map<string, Set<Listener>>();

  connect(): void {
    this.connectCalls += 1;
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
    const unsubscribe = this.on(eventName, (payload) => {
      unsubscribe();
      callback(payload);
    });
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

describe('mission-list correlation integration', () => {
  let socketService: MockSocketService;
  let missionService: MissionService;
  let missionBoardService: MissionBoardService;

  beforeEach(() => {
    socketService = new MockSocketService();
    TestBed.configureTestingModule({
      providers: [MissionService, MissionBoardService, { provide: SocketService, useValue: socketService }],
    });

    missionService = TestBed.inject(MissionService);
    missionBoardService = TestBed.inject(MissionBoardService);
  });

  it('routes concurrent mission-list responses to the correct service wrappers', fakeAsync(() => {
    let missionServiceResult: ListMissionsResult | undefined;
    const missionServicePromise = missionService.listMissions({
      playerName: 'Pioneer',
      characterId: 'char-a',
      sessionKey: 'session-1',
    });
    missionServicePromise.then((result) => {
      missionServiceResult = result;
    });

    const missionBoardCallback = jasmine.createSpy('missionBoardCallback');
    missionBoardService.listMissions(
      {
        playerName: 'Pioneer',
        characterId: 'char-b',
        sessionKey: 'session-1',
      },
      missionBoardCallback,
    );

    flushMicrotasks();

    expect(socketService.emittedEvents.length).toBe(2);
    expect(socketService.listenerCount(MISSION_LIST_RESPONSE_EVENT)).toBe(2);

    const requestFromMissionService = socketService.emittedEvents.find(
      (entry) =>
        entry.event === MISSION_LIST_REQUEST_EVENT &&
        (entry.data as MissionListRequest).correlationSource === 'mission-service.listMissions',
    )?.data as MissionListRequest;

    const requestFromMissionBoard = socketService.emittedEvents.find(
      (entry) =>
        entry.event === MISSION_LIST_REQUEST_EVENT &&
        (entry.data as MissionListRequest).correlationSource === 'mission-board-service.listMissions',
    )?.data as MissionListRequest;

    expect(requestFromMissionService.correlationId).toEqual(jasmine.any(String));
    expect(requestFromMissionBoard.correlationId).toEqual(jasmine.any(String));

    const responseForMissionBoard: MissionListResponse = {
      success: true,
      message: 'mission-board',
      correlationId: requestFromMissionBoard.correlationId!,
      requestIdentity: requestFromMissionBoard.requestIdentity!,
      playerName: 'Pioneer',
      characterId: 'char-b',
      missions: [{ missionId: 'board-mission', status: 'available' }],
    };

    const responseForMissionService: MissionListResponse = {
      success: true,
      message: 'mission-service',
      correlationId: requestFromMissionService.correlationId!,
      requestIdentity: requestFromMissionService.requestIdentity!,
      playerName: 'Pioneer',
      characterId: 'char-a',
      missions: [{ missionId: 'service-mission', status: 'started' }],
    };

    socketService.trigger(MISSION_LIST_RESPONSE_EVENT, responseForMissionBoard);
    flushMicrotasks();

    expect(missionBoardCallback).toHaveBeenCalledTimes(1);
    expect(missionBoardCallback).toHaveBeenCalledWith(responseForMissionBoard);
    expect(missionServiceResult).toBeUndefined();

    socketService.trigger(MISSION_LIST_RESPONSE_EVENT, responseForMissionService);
    flushMicrotasks();

    expect(missionServiceResult).toEqual({
      status: 'loaded',
      missions: [{ missionId: 'service-mission', status: 'started' }],
    });
  }));

  it('keeps strict mission-list matching when responses omit correlation metadata', fakeAsync(() => {
    let missionServiceResult: ListMissionsResult | undefined;
    const missionServicePromise = missionService.listMissions({
      playerName: 'Pioneer',
      characterId: 'char-a',
      sessionKey: 'session-1',
    });
    missionServicePromise.then((result) => {
      missionServiceResult = result;
    });

    const missionBoardCallback = jasmine.createSpy('missionBoardCallback');
    missionBoardService.listMissions(
      {
        playerName: 'Pioneer',
        characterId: 'char-b',
        sessionKey: 'session-1',
      },
      missionBoardCallback,
    );

    flushMicrotasks();

    socketService.trigger(MISSION_LIST_RESPONSE_EVENT, {
      success: true,
      message: 'legacy-char-b',
      playerName: 'Pioneer',
      characterId: 'char-b',
      missions: [{ missionId: 'board-mission', status: 'available' }],
    } as unknown as MissionListResponse);
    flushMicrotasks();

    expect(missionBoardCallback).toHaveBeenCalledTimes(0);
    expect(missionServiceResult).toBeUndefined();

    socketService.trigger(MISSION_LIST_RESPONSE_EVENT, {
      success: true,
      message: 'legacy-char-a',
      playerName: 'Pioneer',
      characterId: 'char-a',
      missions: [{ missionId: 'service-mission', status: 'started' }],
    } as unknown as MissionListResponse);
    flushMicrotasks();

    expect(missionBoardCallback).toHaveBeenCalledTimes(0);
    expect(missionServiceResult).toBeUndefined();

    const requestFromMissionService = socketService.emittedEvents.find(
      (entry) =>
        entry.event === MISSION_LIST_REQUEST_EVENT &&
        (entry.data as MissionListRequest).correlationSource === 'mission-service.listMissions',
    )?.data as MissionListRequest;

    socketService.trigger(MISSION_LIST_RESPONSE_EVENT, {
      success: true,
      message: 'strict-char-a',
      correlationId: requestFromMissionService.correlationId!,
      requestIdentity: requestFromMissionService.requestIdentity!,
      playerName: 'Pioneer',
      characterId: 'char-a',
      missions: [{ missionId: 'service-mission', status: 'started' }],
    } satisfies MissionListResponse);
    flushMicrotasks();

    expect(missionServiceResult).toEqual({
      status: 'loaded',
      missions: [{ missionId: 'service-mission', status: 'started' }],
    });
    expect(missionBoardCallback).toHaveBeenCalledTimes(0);
  }));
});
