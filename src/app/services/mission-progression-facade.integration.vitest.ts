import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFirstTargetMissionInitialGateState } from '../mission/first-target-ship-exterior-mission';
import type { ShipExteriorMissionGateState } from '../mission/ship-exterior-mission';
import { FIRST_TARGET_MISSION_ID } from '../model/mission.locale';
import type { MissionService, UpsertMissionStatusResult } from './mission.service';
import { MissionProgressSyncService } from './mission-progress-sync.service';
import { MissionProgressFacade, type MissionProgressTransitionContext } from './mission-progression-facade.service';
import type { SessionService } from './session.service';
import { ShipExteriorMissionStateService } from './ship-exterior-mission-state.service';

const CONTEXT: MissionProgressTransitionContext = {
  missionId: FIRST_TARGET_MISSION_ID,
  playerName: 'Pioneer',
  characterId: 'char-integration-1',
  shipId: 'ship-integration-1',
  sessionKey: 'session-integration-1',
};

const STORAGE_KEY = [
  'ship-exterior-mission-state',
  CONTEXT.missionId,
  CONTEXT.playerName,
  CONTEXT.characterId,
  CONTEXT.shipId,
].join('::');

type UpsertSpy = ReturnType<typeof vi.fn>;

interface Harness {
  facade: MissionProgressFacade;
  missionStateService: ShipExteriorMissionStateService;
  upsertMissionStatus: UpsertSpy;
  readPersisted: () => ShipExteriorMissionGateState | null;
}

function createHarness(
  upsertImplementation: () => Promise<UpsertMissionStatusResult> = async () => 'updated',
): Harness {
  const missionStateService = new ShipExteriorMissionStateService();
  const upsertMissionStatus = vi.fn(upsertImplementation);
  const missionService = { upsertMissionStatus } as unknown as MissionService;
  const missionProgressSyncService = new MissionProgressSyncService(missionService);
  const sessionService = { getSessionKey: () => CONTEXT.sessionKey } as unknown as SessionService;

  return {
    facade: new MissionProgressFacade(missionStateService, missionProgressSyncService, sessionService),
    missionStateService,
    upsertMissionStatus,
    readPersisted: () => {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as ShipExteriorMissionGateState) : null;
    },
  };
}

function seedState(
  missionStateService: ShipExteriorMissionStateService,
  statuses: Record<string, ShipExteriorMissionGateState['steps'][number]['status']>,
): ShipExteriorMissionGateState {
  const initial = createFirstTargetMissionInitialGateState(CONTEXT.characterId);
  const state: ShipExteriorMissionGateState = {
    ...initial,
    steps: initial.steps.map((step) => ({ ...step, status: statuses[step.key] ?? step.status })),
  };
  missionStateService.saveState(CONTEXT, state);
  return state;
}

async function flushSync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('MissionProgressFacade integration', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('publishes, persists, and synchronizes a successful manufacture transition', async () => {
    const harness = createHarness();
    seedState(harness.missionStateService, {
      identify_iron_asteroid: 'completed',
      neutralize_identified_asteroid: 'completed',
      manufacture_hull_patch_kit: 'active',
      repair_scavenger_pod: 'locked',
    });
    const published: ShipExteriorMissionGateState[] = [];
    harness.facade.registerPublisher(CONTEXT, (gateState) => published.push(gateState));

    const next = harness.facade.advanceManufacture(CONTEXT, 'hull-patch-kit');
    await flushSync();

    expect(next?.steps.find((step) => step.key === 'manufacture_hull_patch_kit')?.status).toBe('completed');
    expect(published).toEqual([next]);
    expect(harness.readPersisted()).toEqual(next);
    expect(harness.upsertMissionStatus).toHaveBeenCalledTimes(1);
    expect(harness.upsertMissionStatus.mock.calls[0][0]).toMatchObject({
      playerName: CONTEXT.playerName,
      characterId: CONTEXT.characterId,
      sessionKey: CONTEXT.sessionKey,
      missionId: CONTEXT.missionId,
      status: 'active',
    });
  });

  it('treats a repeated manufacture transition as a no-op across all boundaries', async () => {
    const harness = createHarness();
    seedState(harness.missionStateService, {
      identify_iron_asteroid: 'completed',
      neutralize_identified_asteroid: 'completed',
      manufacture_hull_patch_kit: 'completed',
      repair_scavenger_pod: 'active',
    });
    const published: ShipExteriorMissionGateState[] = [];
    harness.facade.registerPublisher(CONTEXT, (gateState) => published.push(gateState));
    const persistedBefore = harness.readPersisted();

    const next = harness.facade.advanceManufacture(CONTEXT, 'hull-patch-kit');
    await flushSync();

    expect(next?.steps.find((step) => step.key === 'repair_scavenger_pod')?.status).toBe('active');
    expect(published).toEqual([]);
    expect(harness.readPersisted()).toEqual(persistedBefore);
    expect(harness.upsertMissionStatus).not.toHaveBeenCalled();
  });

  it('does not advance, persist, publish, or synchronize an out-of-sequence manufacture', async () => {
    const harness = createHarness();
    seedState(harness.missionStateService, {
      identify_iron_asteroid: 'active',
      neutralize_identified_asteroid: 'locked',
      manufacture_hull_patch_kit: 'locked',
      repair_scavenger_pod: 'locked',
    });
    const published: ShipExteriorMissionGateState[] = [];
    harness.facade.registerPublisher(CONTEXT, (gateState) => published.push(gateState));
    const persistedBefore = harness.readPersisted();

    const next = harness.facade.advanceManufacture(CONTEXT, 'hull-patch-kit');
    await flushSync();

    expect(next?.steps.find((step) => step.key === 'manufacture_hull_patch_kit')?.status).toBe('locked');
    expect(published).toEqual([]);
    expect(harness.readPersisted()).toEqual(persistedBefore);
    expect(harness.upsertMissionStatus).not.toHaveBeenCalled();
  });

  it('does not advance an out-of-sequence repair while the manufacture step is still active', async () => {
    const harness = createHarness();
    seedState(harness.missionStateService, {
      identify_iron_asteroid: 'completed',
      neutralize_identified_asteroid: 'completed',
      manufacture_hull_patch_kit: 'active',
      repair_scavenger_pod: 'locked',
    });
    const published: ShipExteriorMissionGateState[] = [];
    harness.facade.registerPublisher(CONTEXT, (gateState) => published.push(gateState));
    const persistedBefore = harness.readPersisted();

    const next = harness.facade.advanceRepair(CONTEXT, 'ship');
    await flushSync();

    expect(next?.steps.find((step) => step.key === 'repair_scavenger_pod')?.status).toBe('locked');
    expect(published).toEqual([]);
    expect(harness.readPersisted()).toEqual(persistedBefore);
    expect(harness.upsertMissionStatus).not.toHaveBeenCalled();
  });

  it('keeps local publication and persistence when backend synchronization reports failure', async () => {
    const harness = createHarness(async () => 'update-failed');
    seedState(harness.missionStateService, {
      identify_iron_asteroid: 'completed',
      neutralize_identified_asteroid: 'completed',
      manufacture_hull_patch_kit: 'active',
      repair_scavenger_pod: 'locked',
    });
    const published: ShipExteriorMissionGateState[] = [];
    harness.facade.registerPublisher(CONTEXT, (gateState) => published.push(gateState));

    const next = harness.facade.advanceManufacture(CONTEXT, 'hull-patch-kit');
    await flushSync();

    expect(published).toEqual([next]);
    expect(harness.readPersisted()).toEqual(next);
    expect(harness.upsertMissionStatus).toHaveBeenCalledTimes(1);
  });

  it('does not reject or lose local state when backend synchronization throws', async () => {
    const harness = createHarness(async () => {
      throw new Error('socket disconnected');
    });
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    seedState(harness.missionStateService, {
      identify_iron_asteroid: 'completed',
      neutralize_identified_asteroid: 'completed',
      manufacture_hull_patch_kit: 'active',
      repair_scavenger_pod: 'locked',
    });

    const next = harness.facade.advanceManufacture(CONTEXT, 'hull-patch-kit');
    await flushSync();

    expect(next?.steps.find((step) => step.key === 'manufacture_hull_patch_kit')?.status).toBe('completed');
    expect(harness.readPersisted()).toEqual(next);
  });

  it('resynchronizes an already-completed ship repair without republishing or repersisting', async () => {
    const harness = createHarness();
    const seeded = seedState(harness.missionStateService, {
      identify_iron_asteroid: 'completed',
      neutralize_identified_asteroid: 'completed',
      manufacture_hull_patch_kit: 'completed',
      repair_scavenger_pod: 'completed',
    });
    const published: ShipExteriorMissionGateState[] = [];
    harness.facade.registerPublisher(CONTEXT, (gateState) => published.push(gateState));

    harness.facade.advanceRepair(CONTEXT, 'ship');
    await flushSync();

    expect(published).toEqual([]);
    expect(harness.readPersisted()?.steps.map((step) => step.status)).toEqual(seeded.steps.map((step) => step.status));
    expect(harness.upsertMissionStatus).toHaveBeenCalledTimes(1);
    expect(harness.upsertMissionStatus.mock.calls[0][0]).toMatchObject({ status: 'completed' });
  });

  it('stops publishing after the registered scene consumer is disposed', async () => {
    const harness = createHarness();
    seedState(harness.missionStateService, {
      identify_iron_asteroid: 'completed',
      neutralize_identified_asteroid: 'completed',
      manufacture_hull_patch_kit: 'active',
      repair_scavenger_pod: 'locked',
    });
    const published: ShipExteriorMissionGateState[] = [];
    const dispose = harness.facade.registerPublisher(CONTEXT, (gateState) => published.push(gateState));
    dispose();

    const next = harness.facade.advanceManufacture(CONTEXT, 'hull-patch-kit');
    await flushSync();

    expect(published).toEqual([]);
    expect(harness.readPersisted()).toEqual(next);
    expect(harness.upsertMissionStatus).toHaveBeenCalledTimes(1);
  });

  it('synchronizes externally published state through the same boundary without local persistence', async () => {
    const harness = createHarness();
    const seeded = seedState(harness.missionStateService, {
      identify_iron_asteroid: 'completed',
      neutralize_identified_asteroid: 'active',
      manufacture_hull_patch_kit: 'locked',
      repair_scavenger_pod: 'locked',
    });

    harness.facade.syncPublishedState(CONTEXT, seeded);
    await flushSync();

    expect(harness.upsertMissionStatus).toHaveBeenCalledTimes(1);
    expect(harness.upsertMissionStatus.mock.calls[0][0]).toMatchObject({
      missionId: CONTEXT.missionId,
      sessionKey: CONTEXT.sessionKey,
      status: 'active',
    });
  });

  it('skips synchronization when no session key is available from the context or session service', async () => {
    const missionStateService = new ShipExteriorMissionStateService();
    const upsertMissionStatus = vi.fn(async () => 'updated' as UpsertMissionStatusResult);
    const facade = new MissionProgressFacade(
      missionStateService,
      new MissionProgressSyncService({ upsertMissionStatus } as unknown as MissionService),
      { getSessionKey: () => null } as unknown as SessionService,
    );
    seedState(missionStateService, {
      identify_iron_asteroid: 'completed',
      neutralize_identified_asteroid: 'completed',
      manufacture_hull_patch_kit: 'active',
      repair_scavenger_pod: 'locked',
    });

    const next = facade.advanceManufacture({ ...CONTEXT, sessionKey: '' }, 'hull-patch-kit');
    await flushSync();

    expect(next?.steps.find((step) => step.key === 'manufacture_hull_patch_kit')?.status).toBe('completed');
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('"completed"');
    expect(upsertMissionStatus).not.toHaveBeenCalled();
  });

  it('returns null and performs no boundary work when no persisted state exists', async () => {
    const harness = createHarness();
    const published: ShipExteriorMissionGateState[] = [];
    harness.facade.registerPublisher(CONTEXT, (gateState) => published.push(gateState));

    const next = harness.facade.advanceManufacture(CONTEXT, 'hull-patch-kit');
    await flushSync();

    expect(next).toBeNull();
    expect(published).toEqual([]);
    expect(harness.readPersisted()).toBeNull();
    expect(harness.upsertMissionStatus).not.toHaveBeenCalled();
  });

  describe('scan progression', () => {
    const ironSample = {
      id: 'asteroid-iron-1',
      serverCelestialBodyId: 'celestial-body-1',
      revealedMaterial: { material: 'Iron' },
    };

    it('publishes, persists, and synchronizes a qualifying iron scan with canonical evidence', async () => {
      const harness = createHarness();
      seedState(harness.missionStateService, {
        identify_iron_asteroid: 'active',
        neutralize_identified_asteroid: 'locked',
        manufacture_hull_patch_kit: 'locked',
        repair_scavenger_pod: 'locked',
      });
      const published: ShipExteriorMissionGateState[] = [];
      harness.facade.registerPublisher(CONTEXT, (gateState) => published.push(gateState));

      const next = harness.facade.advanceScan(CONTEXT, ironSample);
      await flushSync();

      const identifyStep = next?.steps.find((step) => step.key === 'identify_iron_asteroid');
      expect(identifyStep?.status).toBe('completed');
      expect(identifyStep?.evidence).toMatchObject({
        sourceScanId: ironSample.id,
        celestialBodyId: ironSample.serverCelestialBodyId,
        material: 'Iron',
        characterId: CONTEXT.characterId,
        missionId: CONTEXT.missionId,
      });
      expect(next?.steps.find((step) => step.key === 'neutralize_identified_asteroid')?.status).toBe('active');
      expect(next?.activeObjectiveText).toBe(
        'Objective unlocked: Neutralize the identified asteroid using a launchable payload.',
      );
      expect(published).toEqual([next]);
      expect(harness.readPersisted()).toEqual(next);
      expect(harness.upsertMissionStatus).toHaveBeenCalledTimes(1);
    });

    it('treats a non-qualifying material scan as a no-op across all boundaries', async () => {
      const harness = createHarness();
      seedState(harness.missionStateService, {
        identify_iron_asteroid: 'active',
        neutralize_identified_asteroid: 'locked',
        manufacture_hull_patch_kit: 'locked',
        repair_scavenger_pod: 'locked',
      });
      const published: ShipExteriorMissionGateState[] = [];
      harness.facade.registerPublisher(CONTEXT, (gateState) => published.push(gateState));
      const persistedBefore = harness.readPersisted();

      const next = harness.facade.advanceScan(CONTEXT, {
        id: 'asteroid-copper-1',
        serverCelestialBodyId: 'celestial-body-2',
        revealedMaterial: { material: 'Copper' },
      });
      await flushSync();

      expect(next?.steps.find((step) => step.key === 'identify_iron_asteroid')?.status).toBe('active');
      expect(published).toEqual([]);
      expect(harness.readPersisted()).toEqual(persistedBefore);
      expect(harness.upsertMissionStatus).not.toHaveBeenCalled();
    });

    it('does not regress later progress when an already-identified asteroid is rescanned', async () => {
      const harness = createHarness();
      seedState(harness.missionStateService, {
        identify_iron_asteroid: 'completed',
        neutralize_identified_asteroid: 'completed',
        manufacture_hull_patch_kit: 'active',
        repair_scavenger_pod: 'locked',
      });
      const published: ShipExteriorMissionGateState[] = [];
      harness.facade.registerPublisher(CONTEXT, (gateState) => published.push(gateState));
      const persistedBefore = harness.readPersisted();

      const next = harness.facade.advanceScan(CONTEXT, ironSample);
      await flushSync();

      expect(next?.steps.find((step) => step.key === 'neutralize_identified_asteroid')?.status).toBe('completed');
      expect(next?.steps.find((step) => step.key === 'manufacture_hull_patch_kit')?.status).toBe('active');
      expect(published).toEqual([]);
      expect(harness.readPersisted()).toEqual(persistedBefore);
      expect(harness.upsertMissionStatus).not.toHaveBeenCalled();
    });

    it('keeps local publication and persistence when scan synchronization fails', async () => {
      const harness = createHarness(async () => {
        throw new Error('socket disconnected');
      });
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      seedState(harness.missionStateService, {
        identify_iron_asteroid: 'active',
        neutralize_identified_asteroid: 'locked',
        manufacture_hull_patch_kit: 'locked',
        repair_scavenger_pod: 'locked',
      });
      const published: ShipExteriorMissionGateState[] = [];
      harness.facade.registerPublisher(CONTEXT, (gateState) => published.push(gateState));

      const next = harness.facade.advanceScan(CONTEXT, ironSample);
      await flushSync();

      expect(next?.steps.find((step) => step.key === 'identify_iron_asteroid')?.status).toBe('completed');
      expect(published).toEqual([next]);
      expect(harness.readPersisted()).toEqual(next);
    });

    it('returns null and performs no boundary work when no persisted state exists', async () => {
      const harness = createHarness();

      const next = harness.facade.advanceScan(CONTEXT, ironSample);
      await flushSync();

      expect(next).toBeNull();
      expect(harness.readPersisted()).toBeNull();
      expect(harness.upsertMissionStatus).not.toHaveBeenCalled();
    });
  });
});
