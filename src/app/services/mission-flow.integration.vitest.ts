import { TestBed } from '@angular/core/testing';
import {
  evaluateMissionGateOnLaunch,
  evaluateMissionGateOnManufacture,
  evaluateMissionGateOnRepair,
  evaluateMissionGateOnScan,
  resolveShipExteriorMission,
  type ShipExteriorMissionGateState,
} from '../mission/ship-exterior-mission';
import type { LaunchItemResponse } from '../model/launch-item';
import { FIRST_TARGET_MISSION_ID } from '../model/mission.locale';
import {
  MISSION_UPSERT_REQUEST_EVENT,
  MISSION_UPSERT_RESPONSE_EVENT,
  type MissionUpsertRequest,
} from '../model/mission-upsert.model';
import { MissionProgressSyncService } from './mission-progress-sync.service';
import { MissionProgressFacade } from './mission-progression-facade.service';
import { MissionService, type UpsertMissionStatusResult } from './mission.service';
import { SessionService } from './session.service';
import { ShipExteriorMissionStateService } from './ship-exterior-mission-state.service';
import { SocketService } from './socket.service';

type Listener = (payload: any) => void;
type StepStatus = 'locked' | 'active' | 'completed' | 'pending-retry';
type MissionEvent = 'scan' | 'launch' | 'manufacture' | 'repair';

interface GateStepEvidence {
  sourceScanId: string;
  celestialBodyId: string | null;
  material: string | null;
  completedAt: string;
  characterId: string;
  missionId: string;
}

interface GateStepState {
  key: string;
  status: StepStatus;
  completedAt?: string;
  evidence?: GateStepEvidence;
}

interface GateState {
  missionId: string;
  characterId: string;
  activeObjectiveText: string;
  updatedAt: string;
  steps: GateStepState[];
}

const STEP_KEYS = [
  'identify_iron_asteroid',
  'neutralize_identified_asteroid',
  'manufacture_hull_patch_kit',
  'repair_scavenger_pod',
] as const;

function resolveCanonicalObjectiveText(steps: readonly GateStepState[]): string {
  const definitions = resolveShipExteriorMission(FIRST_TARGET_MISSION_ID).getGateStepDefinitions();
  const activeDefinition = definitions.find((definition) =>
    steps.some((step) => step.key === definition.key && step.status === 'active'),
  );
  if (activeDefinition) {
    return activeDefinition.objectiveText;
  }

  const pendingDefinition = definitions.find((definition) =>
    steps.some((step) => step.key === definition.key && step.status === 'pending-retry'),
  );
  if (pendingDefinition) {
    return `${pendingDefinition.objectiveText} (sync pending)`;
  }

  return 'Mission objectives complete. Await further directives.';
}

function createGateState(
  missionId: string,
  characterId: string,
  statuses: readonly StepStatus[],
  updatedAt: string,
): GateState {
  const steps = STEP_KEYS.map((key, index) => {
    const status = statuses[index] ?? 'locked';
    return {
      key,
      status,
      ...(status === 'completed' ? { completedAt: updatedAt } : {}),
    };
  });

  return {
    missionId,
    characterId,
    activeObjectiveText: resolveCanonicalObjectiveText(steps),
    updatedAt,
    steps,
  };
}

const IRON_SCAN_SAMPLE = {
  id: 'asteroid-iron-1',
  serverCelestialBodyId: 'celestial-body-1',
  revealedMaterial: { material: 'Iron' },
};

/**
 * Destroys the launch target without yielding iron, so it neutralizes an already-identified
 * asteroid but cannot satisfy the iron identification step on its own.
 */
const NEUTRALIZING_LAUNCH_RESPONSE = {
  success: true,
  resolution: { targetDestroyed: true },
} as unknown as LaunchItemResponse;

/**
 * Applies a mission event through the canonical evaluators rather than a test-local
 * transition model, so socket-level coverage cannot drift from production rules.
 */
function applyMissionEvent(gateState: GateState, event: MissionEvent, updatedAt: string): GateState {
  const mission = resolveShipExteriorMission(gateState.missionId);
  const canonicalGateState = gateState as unknown as ShipExteriorMissionGateState;

  switch (event) {
    case 'scan':
      return evaluateMissionGateOnScan({
        mission,
        gateState: canonicalGateState,
        sample: IRON_SCAN_SAMPLE,
        completedAt: updatedAt,
      }).gateState as unknown as GateState;
    case 'launch':
      return evaluateMissionGateOnLaunch({
        mission,
        gateState: canonicalGateState,
        response: NEUTRALIZING_LAUNCH_RESPONSE,
        completedAt: updatedAt,
      }).gateState as unknown as GateState;
    case 'manufacture':
      return evaluateMissionGateOnManufacture({
        mission,
        gateState: canonicalGateState,
        manufacturedItemType: 'hull-patch-kit',
        completedAt: updatedAt,
      }).gateState as unknown as GateState;
    case 'repair':
      return evaluateMissionGateOnRepair({
        mission,
        gateState: canonicalGateState,
        repairKind: 'ship',
        completedAt: updatedAt,
      }).gateState as unknown as GateState;
  }
}

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

describe('Mission integration proof of concept', () => {
  const playerName = 'Pioneer';
  const characterId = 'char-1';
  const sessionKey = 'session-1';
  const missionId = 'first-target';

  let socketService: MockSocketService;
  let missionService: MissionService;
  let syncService: MissionProgressSyncService;

  beforeEach(() => {
    socketService = new MockSocketService();
    TestBed.configureTestingModule({
      providers: [MissionService, MissionProgressSyncService, { provide: SocketService, useValue: socketService }],
    });
    missionService = TestBed.inject(MissionService);
    syncService = TestBed.inject(MissionProgressSyncService);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  async function syncGateStateAndAcknowledge(gateState: GateState): Promise<MissionUpsertRequest> {
    const pending = syncService.syncGateState({
      playerName,
      characterId,
      sessionKey,
      gateState: gateState as never,
    });

    await Promise.resolve();
    const emittedRequest = socketService.emittedEvents[socketService.emittedEvents.length - 1];
    expect(emittedRequest?.event).toBe(MISSION_UPSERT_REQUEST_EVENT);

    const requestPayload = emittedRequest.data as MissionUpsertRequest;
    socketService.trigger(MISSION_UPSERT_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      correlationId: requestPayload.correlationId!,
      requestIdentity: requestPayload.requestIdentity!,
      playerName,
      characterId,
      mission: {
        missionId: requestPayload.missionId,
        status: requestPayload.status,
        statusDetail: requestPayload.statusDetail,
      },
    });

    const result: UpsertMissionStatusResult | 'skipped' = await pending;
    expect(result).toBe('updated');
    return requestPayload;
  }

  it('should sync mission gate progression from ACTIVE to COMPLETED across service boundaries', async () => {
    const timeline: GateState[] = [
      createGateState(missionId, characterId, ['active', 'locked', 'locked', 'locked'], '2026-05-01T00:00:00.000Z'),
      createGateState(missionId, characterId, ['completed', 'active', 'locked', 'locked'], '2026-05-01T00:00:01.000Z'),
      createGateState(
        missionId,
        characterId,
        ['completed', 'completed', 'active', 'locked'],
        '2026-05-01T00:00:02.000Z',
      ),
      createGateState(
        missionId,
        characterId,
        ['completed', 'completed', 'completed', 'active'],
        '2026-05-01T00:00:03.000Z',
      ),
      createGateState(
        missionId,
        characterId,
        ['completed', 'completed', 'completed', 'completed'],
        '2026-05-01T00:00:04.000Z',
      ),
    ];
    const expectedStatuses = ['active', 'active', 'active', 'active', 'completed'] as const;

    for (let index = 0; index < timeline.length; index += 1) {
      const request = await syncGateStateAndAcknowledge(timeline[index]);
      expect(request.status).toBe(expectedStatuses[index]);
    }

    const finalRequest = socketService.emittedEvents[socketService.emittedEvents.length - 1]
      .data as MissionUpsertRequest;
    const finalStatusDetail = JSON.parse(finalRequest.statusDetail ?? '{}') as GateState;
    expect(finalStatusDetail.steps.every((step) => step.status === 'completed')).toBe(true);
    expect(socketService.connectCalls).toBe(0);
  });

  it('should keep mission ACTIVE after manufacture until repair step completes', async () => {
    const postManufactureState = createGateState(
      missionId,
      characterId,
      ['completed', 'completed', 'completed', 'active'],
      '2026-05-01T00:00:03.000Z',
    );

    const request = await syncGateStateAndAcknowledge(postManufactureState);
    expect(request.status).toBe('active');

    const statusDetail = JSON.parse(request.statusDetail ?? '{}') as GateState;
    expect(statusDetail.steps.find((step) => step.key === 'repair_scavenger_pod')?.status).toBe('active');
    expect(statusDetail.steps.find((step) => step.key === 'repair_scavenger_pod')?.completedAt).toBeUndefined();
  });

  it('should drive mission events scan-launch-manufacture-repair to COMPLETED status', async () => {
    let gateState = createGateState(
      missionId,
      characterId,
      ['active', 'locked', 'locked', 'locked'],
      '2026-05-01T00:00:00.000Z',
    );

    gateState = applyMissionEvent(gateState, 'scan', '2026-05-01T00:00:01.000Z');
    gateState = applyMissionEvent(gateState, 'launch', '2026-05-01T00:00:02.000Z');
    gateState = applyMissionEvent(gateState, 'manufacture', '2026-05-01T00:00:03.000Z');
    gateState = applyMissionEvent(gateState, 'repair', '2026-05-01T00:00:04.000Z');

    const request = await syncGateStateAndAcknowledge(gateState);
    expect(request.status).toBe('completed');

    const statusDetail = JSON.parse(request.statusDetail ?? '{}') as GateState;
    expect(statusDetail.steps.every((step) => step.status === 'completed')).toBe(true);
    expect(statusDetail.activeObjectiveText).toContain('Mission objectives complete');
  });

  it('should not progress mission when launch happens before scan', async () => {
    const initialState = createGateState(
      missionId,
      characterId,
      ['active', 'locked', 'locked', 'locked'],
      '2026-05-01T00:00:00.000Z',
    );

    const gateAfterWrongOrderEvent = applyMissionEvent(initialState, 'launch', '2026-05-01T00:00:01.000Z');
    expect(gateAfterWrongOrderEvent).toEqual(initialState);

    const request = await syncGateStateAndAcknowledge(gateAfterWrongOrderEvent);
    expect(request.status).toBe('active');

    const statusDetail = JSON.parse(request.statusDetail ?? '{}') as GateState;
    expect(statusDetail.steps.filter((step) => step.status === 'completed').length).toBe(0);
    expect(statusDetail.steps.find((step) => step.key === 'identify_iron_asteroid')?.status).toBe('active');
  });

  it('should reconnect socket and continue upsert flow when initially disconnected', async () => {
    socketService.connected = false;

    const gateState = createGateState(
      missionId,
      characterId,
      ['completed', 'active', 'locked', 'locked'],
      '2026-05-01T00:00:02.000Z',
    );

    const pending = syncService.syncGateState({
      playerName,
      characterId,
      sessionKey,
      gateState: gateState as never,
    });

    expect(socketService.connectCalls).toBe(1);

    socketService.connected = true;
    socketService.trigger('connect', {});
    await Promise.resolve();

    const emittedRequest = socketService.emittedEvents[socketService.emittedEvents.length - 1];
    expect(emittedRequest?.event).toBe(MISSION_UPSERT_REQUEST_EVENT);
    socketService.trigger(MISSION_UPSERT_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      correlationId: emittedRequest.data.correlationId,
      requestIdentity: emittedRequest.data.requestIdentity,
      playerName,
      characterId,
      mission: {
        missionId,
        status: 'active',
        statusDetail: emittedRequest.data.statusDetail,
      },
    });

    expect(await pending).toBe('updated');
  });

  it('should return not-connected when reconnect event does not arrive before timeout', async () => {
    socketService.connected = false;
    vi.useFakeTimers();

    try {
      const pending = missionService.upsertMissionStatus({
        playerName,
        characterId,
        sessionKey,
        missionId,
        status: 'active',
      });

      expect(socketService.connectCalls).toBe(1);
      await vi.advanceTimersByTimeAsync(5001);
      await expect(pending).resolves.toBe('not-connected');
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Mission progression facade over the socket transport', () => {
  const playerName = 'Pioneer';
  const characterId = 'char-1';
  const shipId = 'ship-1';
  const sessionKey = 'session-1';
  const missionId = FIRST_TARGET_MISSION_ID;

  const transitionContext = { missionId, playerName, characterId, shipId, sessionKey };

  let socketService: MockSocketService;
  let missionStateService: ShipExteriorMissionStateService;
  let facade: MissionProgressFacade;

  beforeEach(() => {
    window.localStorage.clear();
    socketService = new MockSocketService();
    TestBed.configureTestingModule({
      providers: [
        MissionService,
        MissionProgressSyncService,
        MissionProgressFacade,
        ShipExteriorMissionStateService,
        { provide: SocketService, useValue: socketService },
        { provide: SessionService, useValue: { getSessionKey: () => sessionKey } },
      ],
    });
    missionStateService = TestBed.inject(ShipExteriorMissionStateService);
    facade = TestBed.inject(MissionProgressFacade);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    window.localStorage.clear();
  });

  function seedPersistedState(statuses: readonly StepStatus[]): void {
    missionStateService.saveState(
      { missionId, playerName, characterId, shipId },
      createGateState(missionId, characterId, statuses, '2026-05-01T00:00:00.000Z') as unknown as ShipExteriorMissionGateState,
    );
  }

  async function flushEmit(): Promise<MissionUpsertRequest> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await Promise.resolve();
      const latest = socketService.emittedEvents[socketService.emittedEvents.length - 1];
      if (latest?.event === MISSION_UPSERT_REQUEST_EVENT) {
        return latest.data as MissionUpsertRequest;
      }
    }

    throw new Error('No mission upsert request was emitted.');
  }

  it('emits canonical scan progression over the mission upsert socket contract', async () => {
    seedPersistedState(['active', 'locked', 'locked', 'locked']);

    const nextState = facade.advanceScan(transitionContext, {
      id: 'asteroid-iron-1',
      serverCelestialBodyId: 'celestial-body-1',
      revealedMaterial: { material: 'Iron' },
    });
    const request = await flushEmit();

    expect(nextState?.steps.find((step) => step.key === 'identify_iron_asteroid')?.status).toBe('completed');
    expect(request.missionId).toBe(missionId);
    expect(request.status).toBe('active');

    const statusDetail = JSON.parse(request.statusDetail ?? '{}') as GateState;
    const identifyStep = statusDetail.steps.find((step) => step.key === 'identify_iron_asteroid');
    expect(identifyStep?.status).toBe('completed');
    expect(identifyStep?.evidence).toMatchObject({
      sourceScanId: 'asteroid-iron-1',
      celestialBodyId: 'celestial-body-1',
      material: 'Iron',
      characterId,
      missionId,
    });
    expect(statusDetail.steps.find((step) => step.key === 'neutralize_identified_asteroid')?.status).toBe('active');
    expect(statusDetail.activeObjectiveText).toBe(
      'Objective unlocked: Neutralize the identified asteroid using a launchable payload.',
    );
  });

  it('emits completed mission status when the final repair transition is published', async () => {
    seedPersistedState(['completed', 'completed', 'completed', 'active']);

    facade.advanceRepair(transitionContext, 'ship');
    const request = await flushEmit();

    expect(request.status).toBe('completed');

    const statusDetail = JSON.parse(request.statusDetail ?? '{}') as GateState;
    expect(statusDetail.steps.every((step) => step.status === 'completed')).toBe(true);
    expect(statusDetail.activeObjectiveText).toContain('Mission objectives complete');
  });

  it('emits no socket traffic for a non-qualifying scan', async () => {
    seedPersistedState(['active', 'locked', 'locked', 'locked']);

    facade.advanceScan(transitionContext, {
      id: 'asteroid-copper-1',
      serverCelestialBodyId: 'celestial-body-2',
      revealedMaterial: { material: 'Copper' },
    });
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await Promise.resolve();
    }

    expect(socketService.emittedEvents).toEqual([]);
  });

  it('keeps persisted scan progress when the socket transport is disconnected', async () => {
    socketService.connected = false;
    seedPersistedState(['active', 'locked', 'locked', 'locked']);
    vi.useFakeTimers();

    try {
      const nextState = facade.advanceScan(transitionContext, {
        id: 'asteroid-iron-1',
        serverCelestialBodyId: 'celestial-body-1',
        revealedMaterial: { material: 'Iron' },
      });

      expect(nextState?.steps.find((step) => step.key === 'identify_iron_asteroid')?.status).toBe('completed');
      expect(missionStateService.loadState({ missionId, playerName, characterId, shipId })?.steps).toEqual(
        nextState?.steps,
      );

      await vi.advanceTimersByTimeAsync(5001);
      expect(socketService.connectCalls).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
