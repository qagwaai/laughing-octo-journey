import { MissionGateSimulator } from './mission-gate-simulator';
import { createInitialMissionGateState, resolveShipExteriorMission } from '../../mission/ship-exterior-mission';
import { FIRST_TARGET_MISSION_ID } from '../../model/mission.locale';

describe('MissionGateSimulator', () => {
  const createState = (characterId = 'char-42') =>
    createInitialMissionGateState({
      missionId: FIRST_TARGET_MISSION_ID,
      characterId,
      steps: resolveShipExteriorMission(FIRST_TARGET_MISSION_ID).getGateStepDefinitions(),
    });

  it('advances manufacture when the hull-patch-kit step is active', () => {
    const state = createState();
    const activeState = {
      ...state,
      steps: state.steps.map((step) =>
        step.key === 'manufacture_hull_patch_kit' ? { ...step, status: 'active' } : step,
      ),
    };
    const simulator = new MissionGateSimulator({
      createInitialState: () => activeState,
      getCurrentState: () => activeState,
      setState: vi.fn(),
      persistState: vi.fn(),
      refreshView: vi.fn(),
    });

    const next = simulator.simulateManufacture('hull-patch-kit');

    expect(next.steps.find((step) => step.key === 'manufacture_hull_patch_kit')?.status).toBe('completed');
    expect(next.steps.find((step) => step.key === 'repair_scavenger_pod')?.status).toBe('active');
    expect(next.activeObjectiveText).toContain('Repair the Scavenger Pod');
  });

  it('does not advance manufacture when the step is not active', () => {
    const state = createState();
    const simulator = new MissionGateSimulator({
      createInitialState: () => state,
      getCurrentState: () => state,
      setState: vi.fn(),
      persistState: vi.fn(),
      refreshView: vi.fn(),
    });

    const next = simulator.simulateManufacture('hull-patch-kit');
    expect(next.steps.find((step) => step.key === 'manufacture_hull_patch_kit')?.status).toBe('locked');
  });

  it('completes the repair objective when repair is requested', () => {
    const state = createState();
    const simulator = new MissionGateSimulator({
      createInitialState: () => state,
      getCurrentState: () => ({
        ...state,
        steps: state.steps.map((step) =>
          step.key === 'repair_scavenger_pod' ? { ...step, status: 'active' } : step,
        ),
      }),
      setState: vi.fn(),
      persistState: vi.fn(),
      refreshView: vi.fn(),
    });

    const next = simulator.simulateRepair('ship');

    expect(next.steps.find((step) => step.key === 'repair_scavenger_pod')?.status).toBe('completed');
    expect(next.activeObjectiveText).toContain('Mission objectives complete');
  });

  it('updates a specific step status without mutating the original object', () => {
    const state = createState();
    const next = MissionGateSimulator.setStepStatus(state, 'identify_iron_asteroid', 'completed');

    expect(next).not.toBe(state);
    expect(next.steps.find((step) => step.key === 'identify_iron_asteroid')?.status).toBe('completed');
    expect(state.steps.find((step) => step.key === 'identify_iron_asteroid')?.status).toBe('active');
  });
});
