import { describe, expect, it, vi } from 'vitest';
import { resolveShipExteriorMission, type ShipExteriorMissionGateState } from '../mission/ship-exterior-mission';
import { FIRST_TARGET_MISSION_ID } from '../model/mission.locale';
import { MissionProgressFacade, type MissionProgressTransitionContext } from './mission-progression-facade.service';

describe('MissionProgressFacade', () => {
  const context: MissionProgressTransitionContext = {
    missionId: FIRST_TARGET_MISSION_ID,
    playerName: 'Pioneer',
    characterId: 'char-1',
    shipId: 'ship-1',
    sessionKey: 'session-1',
  };

  const makeState = (steps: ShipExteriorMissionGateState['steps']): ShipExteriorMissionGateState => ({
    missionId: FIRST_TARGET_MISSION_ID,
    characterId: 'char-1',
    activeObjectiveText: 'Objective: Identify an Iron asteroid via full scan.',
    updatedAt: '2026-04-01T00:00:00.000Z',
    steps,
  });

  it('loads, evaluates, persists, and synchronizes manufacture progression', () => {
    const state = makeState([
      { key: 'identify_iron_asteroid', status: 'completed' },
      { key: 'neutralize_identified_asteroid', status: 'completed' },
      { key: 'manufacture_hull_patch_kit', status: 'active' },
      { key: 'repair_scavenger_pod', status: 'locked' },
    ]);
    const missionStateService = {
      loadState: vi.fn().mockReturnValue(state),
      saveState: vi.fn(),
    };
    const missionProgressSyncService = {
      syncGateState: vi.fn().mockResolvedValue('skipped'),
    };
    const facade = new MissionProgressFacade(
      missionStateService as never,
      missionProgressSyncService as never,
      { getSessionKey: vi.fn().mockReturnValue('fallback-session') } as never,
    );

    const next = facade.advanceManufacture(context, 'hull-patch-kit');

    expect(next?.steps.find((step) => step.key === 'manufacture_hull_patch_kit')?.status).toBe('completed');
    expect(missionStateService.loadState).toHaveBeenCalledWith(context);
    expect(missionStateService.saveState).toHaveBeenCalledWith(context, next);
    expect(missionProgressSyncService.syncGateState).toHaveBeenCalledWith({
      playerName: context.playerName,
      characterId: context.characterId,
      sessionKey: context.sessionKey,
      gateState: next,
    });
  });

  it('does not persist or synchronize a wrong repair transition', () => {
    const state = makeState([
      { key: 'identify_iron_asteroid', status: 'completed' },
      { key: 'neutralize_identified_asteroid', status: 'completed' },
      { key: 'manufacture_hull_patch_kit', status: 'completed' },
      { key: 'repair_scavenger_pod', status: 'active' },
    ]);
    const missionStateService = {
      loadState: vi.fn().mockReturnValue(state),
      saveState: vi.fn(),
    };
    const missionProgressSyncService = {
      syncGateState: vi.fn().mockResolvedValue('skipped'),
    };
    const facade = new MissionProgressFacade(
      missionStateService as never,
      missionProgressSyncService as never,
      { getSessionKey: vi.fn() } as never,
    );

    const next = facade.advanceRepair(context, 'item');

    expect(next?.steps.find((step) => step.key === 'repair_scavenger_pod')?.status).toBe('active');
    expect(missionStateService.saveState).not.toHaveBeenCalled();
    expect(missionProgressSyncService.syncGateState).not.toHaveBeenCalled();
  });

  it('uses the canonical mission definition while preserving the gate state shape', () => {
    const mission = resolveShipExteriorMission(FIRST_TARGET_MISSION_ID);
    const state = makeState(
      mission.getGateStepDefinitions().map((step) => ({
        key: step.key,
        status: step.key === 'repair_scavenger_pod' ? ('active' as const) : ('completed' as const),
      })),
    );
    const missionStateService = {
      loadState: vi.fn().mockReturnValue(state),
      saveState: vi.fn(),
    };
    const missionProgressSyncService = {
      syncGateState: vi.fn().mockResolvedValue('skipped'),
    };
    const facade = new MissionProgressFacade(
      missionStateService as never,
      missionProgressSyncService as never,
      { getSessionKey: vi.fn() } as never,
    );

    const next = facade.advanceRepair(context, 'ship');

    expect(next).toMatchObject({
      missionId: state.missionId,
      characterId: state.characterId,
      steps: expect.any(Array),
    });
    expect(Object.keys(next ?? {}).sort()).toEqual(Object.keys(state).sort());
  });

  it('publishes changed transitions to the registered scene context', () => {
    const state = makeState([
      { key: 'identify_iron_asteroid', status: 'completed' },
      { key: 'neutralize_identified_asteroid', status: 'completed' },
      { key: 'manufacture_hull_patch_kit', status: 'active' },
      { key: 'repair_scavenger_pod', status: 'locked' },
    ]);
    const missionStateService = {
      loadState: vi.fn().mockReturnValue(state),
      saveState: vi.fn(),
    };
    const missionProgressSyncService = {
      syncGateState: vi.fn().mockResolvedValue('skipped'),
    };
    const facade = new MissionProgressFacade(
      missionStateService as never,
      missionProgressSyncService as never,
      { getSessionKey: vi.fn() } as never,
    );
    const publish = vi.fn();
    facade.registerPublisher(context, publish);

    const next = facade.advanceManufacture(context, 'hull-patch-kit');

    expect(publish).toHaveBeenCalledWith(next);
  });
});
