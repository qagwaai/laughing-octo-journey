import { Injectable } from '@angular/core';
import {
  evaluateMissionGateOnManufacture,
  evaluateMissionGateOnRepair,
  parseMissionGateState,
  resolveShipExteriorMission,
  type ShipExteriorMissionGateStepDefinition,
  type ShipExteriorMissionGateState,
} from '../mission/ship-exterior-mission';
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

    if (repairKind === 'ship' && nextState && !evaluation.changed) {
      void this.sync(context, nextState);
    }

    return nextState;
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
    await this.missionProgressSyncService.syncGateState({
      playerName: context.playerName,
      characterId: context.characterId,
      sessionKey: context.sessionKey || this.sessionService.getSessionKey() || '',
      gateState,
    });
  }
}
