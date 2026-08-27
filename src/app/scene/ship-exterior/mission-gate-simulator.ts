import type { ShipExteriorMissionGateState } from '../../mission/ship-exterior-mission';

export interface MissionGateSimulatorDeps {
  createInitialState: (characterId?: string) => ShipExteriorMissionGateState;
  getCurrentState: () => ShipExteriorMissionGateState | null;
  setState: (state: ShipExteriorMissionGateState) => void;
  persistState: (state: ShipExteriorMissionGateState) => void;
  refreshView: () => void;
}

export class MissionGateSimulator {
  constructor(private readonly deps: MissionGateSimulatorDeps) {}

  static setStepStatus(
    state: ShipExteriorMissionGateState,
    key: string,
    status: 'locked' | 'active' | 'completed' | 'pending-retry',
  ): ShipExteriorMissionGateState {
    return {
      ...state,
      updatedAt: new Date().toISOString(),
      steps: state.steps.map((step) =>
        step.key === key
          ? {
              ...step,
              status,
              completedAt: status === 'completed' ? (step.completedAt ?? new Date().toISOString()) : step.completedAt,
            }
          : step,
      ),
    };
  }

  updateState(
    updater: (state: ShipExteriorMissionGateState) => ShipExteriorMissionGateState,
  ): ShipExteriorMissionGateState {
    const currentState = this.deps.getCurrentState() ?? this.deps.createInitialState();
    const nextState = updater(currentState);
    this.deps.setState(nextState);
    this.deps.persistState(nextState);
    this.deps.refreshView();
    return nextState;
  }

  resetForTest(characterId?: string): ShipExteriorMissionGateState {
    const resetState = this.deps.createInitialState(characterId);
    this.deps.setState(resetState);
    this.deps.persistState(resetState);
    this.deps.refreshView();
    return resetState;
  }

  simulateDebrisCollection(_remainingDebrisCount?: number): ShipExteriorMissionGateState {
    return this.deps.getCurrentState() ?? this.deps.createInitialState();
  }

  simulateManufacture(itemType: string): ShipExteriorMissionGateState {
    if (itemType !== 'hull-patch-kit') {
      return this.deps.getCurrentState() ?? this.deps.createInitialState();
    }

    const missionState = this.deps.getCurrentState() ?? this.deps.createInitialState();
    const manufactureStep = missionState.steps.find((step) => step.key === 'manufacture_hull_patch_kit');
    if (manufactureStep?.status !== 'active') {
      return missionState;
    }

    return this.updateState((state) => {
      const manufactureCompleted = MissionGateSimulator.setStepStatus(state, 'manufacture_hull_patch_kit', 'completed');
      const repairActive = MissionGateSimulator.setStepStatus(manufactureCompleted, 'repair_scavenger_pod', 'active');
      return {
        ...repairActive,
        activeObjectiveText: 'Objective unlocked: Repair the Scavenger Pod at the Repair & Retrofit station.',
      };
    });
  }

  simulateRepair(repairKind: string): ShipExteriorMissionGateState {
    if (repairKind !== 'ship') {
      return this.deps.getCurrentState() ?? this.deps.createInitialState();
    }

    const missionState = this.deps.getCurrentState() ?? this.deps.createInitialState();
    const repairStep = missionState.steps.find((step) => step.key === 'repair_scavenger_pod');
    if (repairStep?.status !== 'active') {
      return missionState;
    }

    return this.updateState((state) => {
      const repairCompleted = MissionGateSimulator.setStepStatus(state, 'repair_scavenger_pod', 'completed');
      return {
        ...repairCompleted,
        activeObjectiveText: 'Mission objectives complete. Await further directives.',
      };
    });
  }
}
