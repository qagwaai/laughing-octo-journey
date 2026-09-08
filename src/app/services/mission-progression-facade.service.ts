import { Injectable } from '@angular/core';
import {
  evaluateMissionGateOnManufacture,
  evaluateMissionGateOnRepair,
  evaluateMissionGateOnScan,
  parseMissionGateState,
  resolveShipExteriorMission,
  type MissionScanSample,
  type ShipExteriorMissionDefinition,
  type ShipExteriorMissionGateStepDefinition,
  type ShipExteriorMissionGateState,
} from '../mission/ship-exterior-mission';
import { appLogger } from './logger';
import { MissionProgressSyncService } from './mission-progress-sync.service';
import {
  ShipExteriorMissionStateService,
  type ShipExteriorMissionStateContext,
} from './ship-exterior-mission-state.service';
import { SessionService } from './session.service';

export interface MissionProgressTransitionContext extends ShipExteriorMissionStateContext {
  sessionKey: string;
}

export type MissionProgressPublisher = (gateState: ShipExteriorMissionGateState) => void;

@Injectable({
  providedIn: 'root',
})
/**
 * Coordinates canonical mission evaluation with local publication and backend sync.
 */
export class MissionProgressFacade {
  private readonly publishers = new Map<string, MissionProgressPublisher>();

  constructor(
    private readonly missionStateService: ShipExteriorMissionStateService,
    private readonly missionProgressSyncService: MissionProgressSyncService,
    private readonly sessionService: SessionService,
  ) {}

  advanceManufacture(
    context: MissionProgressTransitionContext,
    manufacturedItemType: string,
  ): ShipExteriorMissionGateState | null {
    const mission = resolveShipExteriorMission(context.missionId);
    const gateState = this.loadGateState(context, mission.getGateStepDefinitions());
    if (!gateState) {
      return null;
    }

    const evaluation = evaluateMissionGateOnManufacture({
      mission,
      gateState,
      manufacturedItemType,
    });
    return this.publishEvaluation(context, evaluation.gateState, evaluation.changed);
  }

  advanceScan(
    context: MissionProgressTransitionContext,
    sample: MissionScanSample,
  ): ShipExteriorMissionGateState | null {
    const mission = resolveShipExteriorMission(context.missionId);
    const gateState = this.loadGateState(context, mission.getGateStepDefinitions());
    if (!gateState) {
      return null;
    }

    const evaluation = evaluateMissionGateOnScan({
      mission,
      gateState,
      sample,
    });
    return this.publishEvaluation(context, evaluation.gateState, evaluation.changed);
  }

  advanceRepair(
    context: MissionProgressTransitionContext,
    repairKind: string,
  ): ShipExteriorMissionGateState | null {
    const mission = resolveShipExteriorMission(context.missionId);
    const gateState = this.loadGateState(context, mission.getGateStepDefinitions());
    if (!gateState) {
      return null;
    }

    const evaluation = evaluateMissionGateOnRepair({
      mission,
      gateState,
      repairKind,
    });
    const nextState = this.publishEvaluation(context, evaluation.gateState, evaluation.changed);

    if (nextState && !evaluation.changed && this.isRepairStepAlreadyCompleted(mission, nextState, repairKind)) {
      void this.sync(context, nextState);
    }

    return nextState;
  }

  /**
   * Detects an already-satisfied repair so completed progress can be resynchronized idempotently,
   * while out-of-sequence repairs perform no backend work.
   */
  private isRepairStepAlreadyCompleted(
    mission: ShipExteriorMissionDefinition,
    gateState: ShipExteriorMissionGateState,
    repairKind: string,
  ): boolean {
    return gateState.steps.some(
      (step) => step.status === 'completed' && mission.doesRepairCompleteGateStep?.(step.key, repairKind) === true,
    );
  }

  syncPublishedState(
    context: MissionProgressTransitionContext,
    gateState: ShipExteriorMissionGateState,
  ): void {
    void this.sync(context, gateState);
  }

  registerPublisher(context: ShipExteriorMissionStateContext, publisher: MissionProgressPublisher): () => void {
    const key = this.contextKey(context);
    this.publishers.set(key, publisher);
    return () => {
      if (this.publishers.get(key) === publisher) {
        this.publishers.delete(key);
      }
    };
  }

  private loadGateState(
    context: MissionProgressTransitionContext,
    steps: readonly ShipExteriorMissionGateStepDefinition[],
  ): ShipExteriorMissionGateState | null {
    const stored = this.missionStateService.loadState(context);
    if (!stored) {
      return null;
    }

    return (
      parseMissionGateState({
        rawStatusDetail: JSON.stringify(stored),
        missionId: context.missionId,
        characterId: context.characterId,
        steps,
      }) ?? stored
    );
  }

  private publishEvaluation(
    context: MissionProgressTransitionContext,
    nextState: ShipExteriorMissionGateState,
    changed: boolean,
  ): ShipExteriorMissionGateState {
    if (changed) {
      this.missionStateService.saveState(context, nextState);
      this.publishers.get(this.contextKey(context))?.(nextState);
      void this.sync(context, nextState);
    }

    return nextState;
  }

  private contextKey(context: ShipExteriorMissionStateContext): string {
    return [context.missionId, context.playerName, context.characterId, context.shipId].join('::');
  }

  private async sync(
    context: MissionProgressTransitionContext,
    gateState: ShipExteriorMissionGateState,
  ): Promise<void> {
    try {
      await this.missionProgressSyncService.syncGateState({
        playerName: context.playerName,
        characterId: context.characterId,
        sessionKey: context.sessionKey || this.sessionService.getSessionKey() || '',
        gateState,
      });
    } catch (error) {
      appLogger.warn(
        `[mission-progress-facade] Mission status synchronization failed. missionId=${context.missionId} characterId=${context.characterId} error=${String(error)}`,
      );
    }
  }
}
