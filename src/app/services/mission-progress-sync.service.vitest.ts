import type { ShipExteriorMissionGateState } from '../mission/ship-exterior-mission';
import { appLogger } from './logger';
import { MissionProgressSyncService } from './mission-progress-sync.service';
import { MissionService } from './mission.service';

describe('MissionProgressSyncService', () => {
  const gateState: ShipExteriorMissionGateState = {
    missionId: 'first-target',
    characterId: 'char-1',
    activeObjectiveText: 'Mission objectives complete. Await further directives.',
    updatedAt: '2026-04-30T00:00:00.000Z',
    steps: [
      { key: 'identify_iron_asteroid', status: 'completed', completedAt: '2026-04-30T00:00:00.000Z' },
      { key: 'neutralize_identified_asteroid', status: 'completed', completedAt: '2026-04-30T00:00:00.000Z' },
      { key: 'manufacture_hull_patch_kit', status: 'completed', completedAt: '2026-04-30T00:00:00.000Z' },
      { key: 'repair_scavenger_pod', status: 'completed', completedAt: '2026-04-30T00:00:00.000Z' },
    ],
  };

  const createGateStateWithStatuses = (
    statuses: Array<'locked' | 'active' | 'completed' | 'pending-retry'>,
  ): ShipExteriorMissionGateState => ({
    missionId: 'first-target',
    characterId: 'char-1',
    activeObjectiveText: 'Objective',
    updatedAt: '2026-04-30T00:00:00.000Z',
    steps: [
      { key: 'identify_iron_asteroid', status: statuses[0] ?? 'locked' },
      { key: 'neutralize_identified_asteroid', status: statuses[1] ?? 'locked' },
      { key: 'manufacture_hull_patch_kit', status: statuses[2] ?? 'locked' },
      { key: 'repair_scavenger_pod', status: statuses[3] ?? 'locked' },
    ],
  });

  it('should skip sync when required context is missing', async () => {
    const missionService = {
      upsertMissionStatus: vi.fn(),
    } as unknown as MissionService;
    const service = new MissionProgressSyncService(missionService);

    const result = await service.syncGateState({
      playerName: 'Pioneer',
      characterId: '',
      sessionKey: 'session-1',
      gateState,
    });

    expect(result).toBe('skipped');
    expect(missionService.upsertMissionStatus).not.toHaveBeenCalled();
  });

  it('should upsert mission status derived from gate state', async () => {
    const missionService = {
      upsertMissionStatus: vi.fn().mockResolvedValue('updated'),
    } as unknown as MissionService;
    const service = new MissionProgressSyncService(missionService);

    const result = await service.syncGateState({
      playerName: 'Pioneer',
      characterId: 'char-1',
      sessionKey: 'session-1',
      gateState,
    });

    expect(result).toBe('updated');
    expect(missionService.upsertMissionStatus).toHaveBeenCalledTimes(1);
    expect(missionService.upsertMissionStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        playerName: 'Pioneer',
        characterId: 'char-1',
        sessionKey: 'session-1',
        missionId: 'first-target',
        status: 'completed',
      }),
    );
  });

  it('should derive ACTIVE/COMPLETED mission statuses from gate states', async () => {
    const missionService = {
      upsertMissionStatus: vi.fn().mockResolvedValue('updated'),
    } as unknown as MissionService;
    const service = new MissionProgressSyncService(missionService);

    const matrix: Array<{
      label: string;
      statuses: Array<'locked' | 'active' | 'completed' | 'pending-retry'>;
      expectedStatus: string;
    }> = [
      {
        label: 'ACTIVE when no step is completed',
        statuses: ['active', 'locked', 'locked', 'locked'],
        expectedStatus: 'active',
      },
      {
        label: 'ACTIVE when any step is completed',
        statuses: ['completed', 'active', 'locked', 'locked'],
        expectedStatus: 'active',
      },
      {
        label: 'ACTIVE when a step is pending-retry',
        statuses: ['completed', 'pending-retry', 'locked', 'locked'],
        expectedStatus: 'active',
      },
      {
        label: 'COMPLETED when all steps are completed',
        statuses: ['completed', 'completed', 'completed', 'completed'],
        expectedStatus: 'completed',
      },
    ];

    for (const row of matrix) {
      await service.syncGateState({
        playerName: 'Pioneer',
        characterId: 'char-1',
        sessionKey: 'session-1',
        gateState: createGateStateWithStatuses(row.statuses),
      });
    }

    expect(missionService.upsertMissionStatus).toHaveBeenCalledTimes(matrix.length);
    const calls = vi.mocked(missionService.upsertMissionStatus).mock.calls;
    for (let index = 0; index < matrix.length; index += 1) {
      expect(calls[index][0]).toEqual(
        expect.objectContaining({
          status: matrix[index].expectedStatus,
        }),
      );
    }
  });

  it('should derive "active" when steps array is empty', async () => {
    const missionService = {
      upsertMissionStatus: vi.fn().mockResolvedValue('updated'),
    } as unknown as MissionService;
    const service = new MissionProgressSyncService(missionService);

    const emptyStepsGateState: ShipExteriorMissionGateState = {
      missionId: 'first-target',
      characterId: 'char-1',
      activeObjectiveText: 'Beginning mission.',
      updatedAt: '2026-04-30T00:00:00.000Z',
      steps: [],
    };

    await service.syncGateState({
      playerName: 'Pioneer',
      characterId: 'char-1',
      sessionKey: 'session-1',
      gateState: emptyStepsGateState,
    });

    expect(missionService.upsertMissionStatus).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }));
  });

  it('should derive "active" when all steps are pending-retry (not "completed")', async () => {
    const missionService = {
      upsertMissionStatus: vi.fn().mockResolvedValue('updated'),
    } as unknown as MissionService;
    const service = new MissionProgressSyncService(missionService);

    await service.syncGateState({
      playerName: 'Pioneer',
      characterId: 'char-1',
      sessionKey: 'session-1',
      gateState: createGateStateWithStatuses(['pending-retry', 'pending-retry', 'pending-retry', 'pending-retry']),
    });

    expect(missionService.upsertMissionStatus).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active' }),
    );
  });

  it('should skip sync when missionId is empty', async () => {
    const missionService = {
      upsertMissionStatus: vi.fn(),
    } as unknown as MissionService;
    const service = new MissionProgressSyncService(missionService);

    const noMissionIdGateState: ShipExteriorMissionGateState = {
      missionId: '',
      characterId: 'char-1',
      activeObjectiveText: 'Objective.',
      updatedAt: '2026-04-30T00:00:00.000Z',
      steps: [],
    };

    const result = await service.syncGateState({
      playerName: 'Pioneer',
      characterId: 'char-1',
      sessionKey: 'session-1',
      gateState: noMissionIdGateState,
    });

    expect(result).toBe('skipped');
    expect(missionService.upsertMissionStatus).not.toHaveBeenCalled();
  });

  it('should skip sync when playerName is empty', async () => {
    const missionService = {
      upsertMissionStatus: vi.fn(),
    } as unknown as MissionService;
    const service = new MissionProgressSyncService(missionService);

    const result = await service.syncGateState({
      playerName: '',
      characterId: 'char-1',
      sessionKey: 'session-1',
      gateState: {
        missionId: 'first-target',
        characterId: 'char-1',
        activeObjectiveText: 'Objective.',
        updatedAt: '2026-04-30T00:00:00.000Z',
        steps: [],
      },
    });

    expect(result).toBe('skipped');
    expect(missionService.upsertMissionStatus).not.toHaveBeenCalled();
  });

  it('should translate legacy step statuses before persisting statusDetail', async () => {
    const missionService = {
      upsertMissionStatus: vi.fn().mockResolvedValue('updated'),
    } as unknown as MissionService;
    const service = new MissionProgressSyncService(missionService);

    const legacyGateState = {
      missionId: 'first-target',
      characterId: 'char-1',
      activeObjectiveText: 'Objective',
      updatedAt: '2026-04-30T00:00:00.000Z',
      steps: [
        { key: 'identify_iron_asteroid', status: 'turned-in' },
        { key: 'neutralize_identified_asteroid', status: 'in-progress' },
        { key: 'manufacture_hull_patch_kit', status: 'started' },
        { key: 'repair_scavenger_pod', status: 'paused' },
      ],
    } as unknown as ShipExteriorMissionGateState;

    await service.syncGateState({
      playerName: 'Pioneer',
      characterId: 'char-1',
      sessionKey: 'session-1',
      gateState: legacyGateState,
    });

    expect(missionService.upsertMissionStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'active',
      }),
    );

    const upsertPayload = vi.mocked(missionService.upsertMissionStatus).mock.calls.at(-1)?.[0] as {
      statusDetail: string;
    };
    const persistedGateState = JSON.parse(upsertPayload.statusDetail) as {
      steps: Array<{ key: string; status: string }>;
    };
    expect(persistedGateState.steps.map((step) => step.status)).toEqual(['completed', 'active', 'active', 'active']);
  });

  it('should warn on unknown gate step statuses and coerce them to active', async () => {
    const missionService = {
      upsertMissionStatus: vi.fn().mockResolvedValue('updated'),
    } as unknown as MissionService;
    const service = new MissionProgressSyncService(missionService);
    const warnSpy = vi.spyOn(appLogger, 'warn');

    const unknownStatusGateState = {
      missionId: 'first-target',
      characterId: 'char-1',
      activeObjectiveText: 'Objective',
      updatedAt: '2026-04-30T00:00:00.000Z',
      steps: [
        { key: 'identify_iron_asteroid', status: 'mystery' },
        { key: 'neutralize_identified_asteroid', status: 'completed' },
        { key: 'manufacture_hull_patch_kit', status: 'completed' },
        { key: 'repair_scavenger_pod', status: 'completed' },
      ],
    } as unknown as ShipExteriorMissionGateState;

    await service.syncGateState({
      playerName: 'Pioneer',
      characterId: 'char-1',
      sessionKey: 'session-1',
      gateState: unknownStatusGateState,
    });

    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls.at(-1)?.[0] as string).toContain('Contract violation: unknown gate step status');

    const upsertPayload = vi.mocked(missionService.upsertMissionStatus).mock.calls.at(-1)?.[0] as {
      status: string;
      statusDetail: string;
    };
    expect(upsertPayload.status).toBe('active');

    const persistedGateState = JSON.parse(upsertPayload.statusDetail) as {
      steps: Array<{ key: string; status: string }>;
    };
    expect(persistedGateState.steps[0].status).toBe('active');
  });
});
