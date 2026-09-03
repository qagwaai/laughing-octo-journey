import {
  evaluateMissionGateOnManufacture,
  evaluateMissionGateOnRepair,
  resolveShipExteriorMission,
  type ShipExteriorMissionGateState,
} from '../../mission/ship-exterior-mission';

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

  simulateManufacture(itemType: string): ShipExteriorMissionGateState {
    const missionState = this.deps.getCurrentState() ?? this.deps.createInitialState();
    const evaluation = evaluateMissionGateOnManufacture({
      mission: resolveShipExteriorMission(missionState.missionId),
      gateState: missionState,
      manufacturedItemType: itemType,
    });

    if (!evaluation.changed) {
      return missionState;
    }

    this.deps.setState(evaluation.gateState);
    this.deps.persistState(evaluation.gateState);
    this.deps.refreshView();
    return evaluation.gateState;
  }

  simulateRepair(repairKind: string): ShipExteriorMissionGateState {
    const missionState = this.deps.getCurrentState() ?? this.deps.createInitialState();
    const evaluation = evaluateMissionGateOnRepair({
      mission: resolveShipExteriorMission(missionState.missionId),
      gateState: missionState,
      repairKind,
    });

    if (!evaluation.changed) {
      return missionState;
    }

    this.deps.setState(evaluation.gateState);
    this.deps.persistState(evaluation.gateState);
    this.deps.refreshView();
    return evaluation.gateState;
  }
}
