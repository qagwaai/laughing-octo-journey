import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { MISSION_ADD_REQUEST_EVENT, MISSION_ADD_RESPONSE_EVENT } from '../model/mission-add';
import { MISSION_LIST_RESPONSE_EVENT } from '../model/mission-list';
import { MISSION_UPSERT_REQUEST_EVENT, MISSION_UPSERT_RESPONSE_EVENT } from '../model/mission-upsert.model';
import { SocketLifecycleService } from './socket-lifecycle.service';
import { MissionService } from './mission.service';
import { createMockSocketLifecycleService, type MockSocketLifecycleService } from '../../testing';

type Listener = (payload: any) => void;

class MockSocketService {
  serverUrl = 'http://localhost:3000';
  connected = true;
  connectCalls = 0;
  emittedEvents: Array<{ event: string; data: any }> = [];
  private listeners = new Map<string, Set<Listener>>();

  connect(): void {
    this.connectCalls += 1;
  }

  getIsConnected(): boolean {
    return this.connected;
  }

  emit(eventName: string, data?: any): void {
    this.emittedEvents.push({ event: eventName, data });
  }

  on(eventName: string, callback: Listener): () => void {
    const set = this.listeners.get(eventName) ?? new Set<Listener>();
    set.add(callback);
    this.listeners.set(eventName, set);

    return () => {
      set.delete(callback);
      if (set.size === 0) {
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

  trigger(eventName: string, payload: any): void {
    const set = this.listeners.get(eventName);
    if (!set) {
      return;
    }

    for (const listener of Array.from(set)) {
      listener(payload);
    }
  }
}

describe('MissionService — error handling & timeout paths', () => {
  let socketService: MockSocketService;
  let socketLifecycleService: MockSocketLifecycleService;
  let service: MissionService;

  beforeEach(() => {
    socketService = new MockSocketService();
    socketLifecycleService = createMockSocketLifecycleService(socketService);
    service = new MissionService(socketService as never, socketLifecycleService as unknown as SocketLifecycleService);
  });

  function metadataFor(eventName: string): { correlationId: string; requestIdentity: unknown } {
    const emitted = [...socketService.emittedEvents].reverse().find((entry) => entry.event === eventName);
    if (!emitted?.data?.correlationId || !emitted?.data?.requestIdentity) {
      throw new Error(`Missing correlation metadata for ${eventName}`);
    }

    return {
      correlationId: emitted.data.correlationId,
      requestIdentity: emitted.data.requestIdentity,
    };
  }

  describe('ensureMissionExists — error paths', () => {
    it('should return list-failed when list response has success: false', async () => {
      const promise = service.ensureMissionExists({
        playerName: 'Pioneer',
        characterId: 'char-1',
        sessionKey: 'session-1',
        missionId: 'first-target',
      });

      await Promise.resolve();
      const listMetadata = metadataFor('list-missions-request');

      socketService.trigger(MISSION_LIST_RESPONSE_EVENT, {
        success: false,
        message: 'List failed',
        correlationId: listMetadata.correlationId!,
        requestIdentity: listMetadata.requestIdentity!,
        playerName: 'Pioneer',
        characterId: 'char-1',
        missions: [],
      });

      const result = await promise;
      expect(result).toBe('list-failed');
    });

    it('should return add-failed when add response has success: false', async () => {
      const promise = service.ensureMissionExists({
        playerName: 'Pioneer',
        characterId: 'char-1',
        sessionKey: 'session-1',
        missionId: 'first-target',
      });

      await Promise.resolve();
      const listMetadata = metadataFor('list-missions-request');

      socketService.trigger(MISSION_LIST_RESPONSE_EVENT, {
        success: true,
        message: 'ok',
        correlationId: listMetadata.correlationId!,
        requestIdentity: listMetadata.requestIdentity!,
        playerName: 'Pioneer',
        characterId: 'char-1',
        missions: [],
      });

      await Promise.resolve();
      const addMetadata = metadataFor(MISSION_ADD_REQUEST_EVENT);

      socketService.trigger(MISSION_ADD_RESPONSE_EVENT, {
        success: false,
        message: 'Add failed',
        correlationId: addMetadata.correlationId!,
        requestIdentity: addMetadata.requestIdentity!,
        playerName: 'Pioneer',
        characterId: 'char-1',
        missionId: 'first-target',
      });

      const result = await promise;
      expect(result).toBe('add-failed');
    });

    it('should ignore response with mismatched playerName', async () => {
      const promise = service.ensureMissionExists({
        playerName: 'Pioneer',
        characterId: 'char-1',
        sessionKey: 'session-1',
        missionId: 'first-target',
      });

      await Promise.resolve();
      const listMetadata = metadataFor('list-missions-request');

      // Send response with wrong playerName
      socketService.trigger(MISSION_LIST_RESPONSE_EVENT, {
        success: true,
        message: 'ok',
        correlationId: 'wrong-correlation-id',
        requestIdentity: listMetadata.requestIdentity!,
        playerName: 'WrongName',
        characterId: 'char-1',
        missions: [],
      });

      await Promise.resolve();

      // Send correct response
      socketService.trigger(MISSION_LIST_RESPONSE_EVENT, {
        success: true,
        message: 'ok',
        correlationId: listMetadata.correlationId!,
        requestIdentity: listMetadata.requestIdentity!,
        playerName: 'Pioneer',
        characterId: 'char-1',
        missions: [],
      });

      await Promise.resolve();

      // Should proceed to add
      const addListeners = socketService.emittedEvents.filter((e) => e.event === MISSION_ADD_REQUEST_EVENT);
      expect(addListeners.length).toBe(1);
    });

    it('should return timeout when response does not arrive within 5s', fakeAsync(() => {
      const promise = service.ensureMissionExists({
        playerName: 'Pioneer',
        characterId: 'char-1',
        sessionKey: 'session-1',
        missionId: 'first-target',
      });

      let result: any;
      promise.then((value) => {
        result = value;
      });

      tick(5001);
      flushMicrotasks();
      expect(result).toBe('timeout');
    }));

    it('should return invalid-request for missing fields', async () => {
      const result = await service.ensureMissionExists({
        playerName: '',
        characterId: 'char-1',
        sessionKey: 'session-1',
        missionId: 'first-target',
      });

      expect(result).toBe('invalid-request');
    });
  });

  describe('listMissions — error paths', () => {
    it('should return list-failed with message when response has success: false', async () => {
      const promise = service.listMissions({
        playerName: 'Pioneer',
        characterId: 'char-1',
        sessionKey: 'session-1',
      });

      await Promise.resolve();
      const listMetadata = metadataFor('list-missions-request');

      socketService.trigger(MISSION_LIST_RESPONSE_EVENT, {
        success: false,
        message: 'Database error',
        correlationId: listMetadata.correlationId!,
        requestIdentity: listMetadata.requestIdentity!,
        playerName: 'Pioneer',
        characterId: 'char-1',
        missions: [],
      });

      const result = await promise;
      expect(result.status).toBe('list-failed');
      expect(result.message).toBe('Database error');
    });

    it('should return timeout when response does not arrive within 5s', fakeAsync(() => {
      const promise = service.listMissions({
        playerName: 'Pioneer',
        characterId: 'char-1',
        sessionKey: 'session-1',
      });

      let result: any;
      promise.then((value) => {
        result = value;
      });

      tick(5001);
      flushMicrotasks();
      expect(result.status).toBe('timeout');
    }));

    it('should return invalid-request for missing sessionKey', async () => {
      const result = await service.listMissions({
        playerName: 'Pioneer',
        characterId: 'char-1',
        sessionKey: '',
      });

      expect(result.status).toBe('invalid-request');
    });

    it('should ignore response with mismatched characterId', async () => {
      const promise = service.listMissions({
        playerName: 'Pioneer',
        characterId: 'char-1',
        sessionKey: 'session-1',
      });

      await Promise.resolve();
      const listMetadata = metadataFor('list-missions-request');

      socketService.trigger(MISSION_LIST_RESPONSE_EVENT, {
        success: true,
        correlationId: 'wrong-correlation-id',
        requestIdentity: listMetadata.requestIdentity!,
        playerName: 'Pioneer',
        characterId: 'wrong-char',
        missions: [{ missionId: 'm1', status: 'active' }],
      });

      await Promise.resolve();

      socketService.trigger(MISSION_LIST_RESPONSE_EVENT, {
        success: true,
        correlationId: listMetadata.correlationId!,
        requestIdentity: listMetadata.requestIdentity!,
        playerName: 'Pioneer',
        characterId: 'char-1',
        missions: [{ missionId: 'm1', status: 'active' }],
      });

      const result = await promise;
      expect(result.status).toBe('loaded');
      expect(result.missions.length).toBeGreaterThan(0);
    });
  });

  describe('upsertMissionStatus — error paths', () => {
    it('should return update-failed when response has success: false', async () => {
      const promise = service.upsertMissionStatus({
        playerName: 'Pioneer',
        characterId: 'char-1',
        sessionKey: 'session-1',
        missionId: 'first-target',
        status: 'active',
      });

      await Promise.resolve();
      const upsertMetadata = metadataFor(MISSION_UPSERT_REQUEST_EVENT);

      socketService.trigger(MISSION_UPSERT_RESPONSE_EVENT, {
        success: false,
        message: 'Update failed',
        correlationId: upsertMetadata.correlationId!,
        requestIdentity: upsertMetadata.requestIdentity!,
        playerName: 'Pioneer',
        characterId: 'char-1',
        mission: {},
      });

      const result = await promise;
      expect(result).toBe('update-failed');
    });

    it('should return timeout when response does not arrive within 5s', fakeAsync(() => {
      const promise = service.upsertMissionStatus({
        playerName: 'Pioneer',
        characterId: 'char-1',
        sessionKey: 'session-1',
        missionId: 'first-target',
        status: 'completed',
      });

      let result: any;
      promise.then((value) => {
        result = value;
      });

      tick(5001);
      flushMicrotasks();
      expect(result).toBe('timeout');
    }));

    it('should return invalid-request for empty status', async () => {
      const result = await service.upsertMissionStatus({
        playerName: 'Pioneer',
        characterId: 'char-1',
        sessionKey: 'session-1',
        missionId: 'first-target',
        status: '' as any,
      });

      expect(result).toBe('invalid-request');
    });

    it('should ignore response with mismatched characterId', async () => {
      const promise = service.upsertMissionStatus({
        playerName: 'Pioneer',
        characterId: 'char-1',
        sessionKey: 'session-1',
        missionId: 'first-target',
        status: 'completed',
      });

      await Promise.resolve();
      const upsertMetadata = metadataFor(MISSION_UPSERT_REQUEST_EVENT);

      socketService.trigger(MISSION_UPSERT_RESPONSE_EVENT, {
        success: true,
        correlationId: 'wrong-correlation-id',
        requestIdentity: upsertMetadata.requestIdentity!,
        playerName: 'Pioneer',
        characterId: 'wrong-char',
        mission: { missionId: 'first-target', status: 'completed' },
      });

      await Promise.resolve();

      socketService.trigger(MISSION_UPSERT_RESPONSE_EVENT, {
        success: true,
        correlationId: upsertMetadata.correlationId!,
        requestIdentity: upsertMetadata.requestIdentity!,
        playerName: 'Pioneer',
        characterId: 'char-1',
        mission: { missionId: 'first-target', status: 'completed' },
      });

      const result = await promise;
      expect(result).toBe('updated');
    });

    it('should include statusDetail when provided', async () => {
      const promise = service.upsertMissionStatus({
        playerName: 'Pioneer',
        characterId: 'char-1',
        sessionKey: 'session-1',
        missionId: 'first-target',
        status: 'active',
        statusDetail: '{"step":"scan"}',
      });

      await Promise.resolve();

      const emittedRequest = socketService.emittedEvents.find((e) => e.event === MISSION_UPSERT_REQUEST_EVENT);
      expect(emittedRequest?.data.statusDetail).toBe('{"step":"scan"}');

      socketService.trigger(MISSION_UPSERT_RESPONSE_EVENT, {
        success: true,
        correlationId: emittedRequest?.data.correlationId,
        requestIdentity: emittedRequest?.data.requestIdentity,
        playerName: 'Pioneer',
        characterId: 'char-1',
        mission: { missionId: 'first-target', status: 'active' },
      });

      const result = await promise;
      expect(result).toBe('updated');
    });
  });
});
