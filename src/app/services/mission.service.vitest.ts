import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MISSION_ADD_REQUEST_EVENT, MISSION_ADD_RESPONSE_EVENT } from '../model/mission-add';
import { MISSION_LIST_REQUEST_EVENT, MISSION_LIST_RESPONSE_EVENT } from '../model/mission-list';
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

describe('MissionService (Vitest)', () => {
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

  it('should return invalid-request when required fields are missing', async () => {
    const result = await service.ensureMissionExists({
      playerName: ' ',
      characterId: 'char-1',
      sessionKey: 'session-1',
      missionId: 'first-target',
    });

    expect(result).toBe('invalid-request');
    expect(socketService.emittedEvents.length).toBe(0);
  });

  it('should return already-exists when mission is already present', async () => {
    const ensurePromise = service.ensureMissionExists({
      playerName: 'Pioneer',
      characterId: 'char-1',
      sessionKey: 'session-1',
      missionId: 'first-target',
      initialStatus: 'active',
    });
    await Promise.resolve();

    expect(socketService.emittedEvents[0].event).toBe(MISSION_LIST_REQUEST_EVENT);
    const listMetadata = metadataFor(MISSION_LIST_REQUEST_EVENT);

    socketService.trigger(MISSION_LIST_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      correlationId: listMetadata.correlationId!,
      requestIdentity: listMetadata.requestIdentity!,
      playerName: 'Pioneer',
      characterId: 'char-1',
      missions: [{ missionId: 'first-target', status: 'active' }],
    });

    const result = await ensurePromise;
    expect(result).toBe('already-exists');
    expect(socketService.emittedEvents.length).toBe(1);
  });

  it('should add mission when missing and return added', async () => {
    const ensurePromise = service.ensureMissionExists({
      playerName: 'Pioneer',
      characterId: 'char-1',
      sessionKey: 'session-1',
      missionId: 'first-target',
      initialStatus: 'active',
    });
    await Promise.resolve();

    const listMetadata = metadataFor(MISSION_LIST_REQUEST_EVENT);

    socketService.trigger(MISSION_LIST_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      correlationId: listMetadata.correlationId!,
      requestIdentity: listMetadata.requestIdentity!,
      playerName: 'Pioneer',
      characterId: 'char-1',
      missions: [],
    });

    expect(socketService.emittedEvents.length).toBe(2);
    expect(socketService.emittedEvents[1].event).toBe(MISSION_ADD_REQUEST_EVENT);
    expect(socketService.emittedEvents[1].data.status).toBe('active');
    expect(socketService.emittedEvents[1].data.correlationId).toEqual(expect.any(String));
    expect(socketService.emittedEvents[1].data.requestIdentity).toEqual(
      expect.objectContaining({
        operation: 'mission-upsert',
        entityType: 'mission',
        containerId: 'char-1',
      }),
    );

    socketService.trigger(MISSION_ADD_RESPONSE_EVENT, {
      success: true,
      message: 'wrong',
      correlationId: 'wrong-correlation-id',
      requestIdentity: socketService.emittedEvents[1].data.requestIdentity,
      playerName: 'Pioneer',
      characterId: 'char-1',
    });
    await Promise.resolve();

    socketService.trigger(MISSION_ADD_RESPONSE_EVENT, {
      success: true,
      message: 'added',
      correlationId: socketService.emittedEvents[1].data.correlationId,
      requestIdentity: socketService.emittedEvents[1].data.requestIdentity,
      playerName: 'Pioneer',
      characterId: 'char-1',
      mission: { missionId: 'first-target', status: 'active' },
    });

    const result = await ensurePromise;
    expect(result).toBe('added');
  });

  it('should use AVAILABLE as default status when initialStatus is omitted', async () => {
    const ensurePromise = service.ensureMissionExists({
      playerName: 'Pioneer',
      characterId: 'char-1',
      sessionKey: 'session-1',
      missionId: 'first-target',
    });
    await Promise.resolve();

    const listMetadata = metadataFor(MISSION_LIST_REQUEST_EVENT);

    socketService.trigger(MISSION_LIST_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      correlationId: listMetadata.correlationId!,
      requestIdentity: listMetadata.requestIdentity!,
      playerName: 'Pioneer',
      characterId: 'char-1',
      missions: [],
    });

    expect(socketService.emittedEvents[1].data.status).toBe('available');
    const addMetadata = metadataFor(MISSION_ADD_REQUEST_EVENT);

    socketService.trigger(MISSION_ADD_RESPONSE_EVENT, {
      success: true,
      message: 'added',
      correlationId: addMetadata.correlationId!,
      requestIdentity: addMetadata.requestIdentity!,
      playerName: 'Pioneer',
      characterId: 'char-1',
      mission: { missionId: 'first-target', status: 'available' },
    });

    const result = await ensurePromise;
    expect(result).toBe('added');
  });

  it('should return list-failed when mission list request fails', async () => {
    const ensurePromise = service.ensureMissionExists({
      playerName: 'Pioneer',
      characterId: 'char-1',
      sessionKey: 'session-1',
      missionId: 'first-target',
    });
    await Promise.resolve();

    const listMetadata = metadataFor(MISSION_LIST_REQUEST_EVENT);

    socketService.trigger(MISSION_LIST_RESPONSE_EVENT, {
      success: false,
      message: 'boom',
      correlationId: listMetadata.correlationId!,
      requestIdentity: listMetadata.requestIdentity!,
      playerName: 'Pioneer',
      characterId: 'char-1',
      missions: [],
    });

    const result = await ensurePromise;
    expect(result).toBe('list-failed');
  });

  it('should return add-failed when add mission request fails', async () => {
    const ensurePromise = service.ensureMissionExists({
      playerName: 'Pioneer',
      characterId: 'char-1',
      sessionKey: 'session-1',
      missionId: 'first-target',
    });
    await Promise.resolve();

    const listMetadata = metadataFor(MISSION_LIST_REQUEST_EVENT);

    socketService.trigger(MISSION_LIST_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      correlationId: listMetadata.correlationId!,
      requestIdentity: listMetadata.requestIdentity!,
      playerName: 'Pioneer',
      characterId: 'char-1',
      missions: [],
    });

    const addMetadata = metadataFor(MISSION_ADD_REQUEST_EVENT);

    socketService.trigger(MISSION_ADD_RESPONSE_EVENT, {
      success: false,
      message: 'boom',
      correlationId: addMetadata.correlationId!,
      requestIdentity: addMetadata.requestIdentity!,
      playerName: 'Pioneer',
      characterId: 'char-1',
    });

    const result = await ensurePromise;
    expect(result).toBe('add-failed');
  });
});
