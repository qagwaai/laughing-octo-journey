import { Injectable } from '@angular/core';
import type { ShipExteriorMissionGateState } from '../mission/ship-exterior-mission';
import type { MissionStatus } from '../model/mission';
import { appLogger } from './logger';
import { MissionService, type UpsertMissionStatusResult } from './mission.service';

/**
 * Payload used to persist ship-exterior gate progress into mission status records.
 */
export interface MissionProgressSyncRequest {
  playerName: string;
  characterId: string;
  sessionKey: string;
  gateState: ShipExteriorMissionGateState;
}

@Injectable({
  providedIn: 'root',
})
/**
 * Translates mission gate-state snapshots into mission-service upsert operations.
 */
export class MissionProgressSyncService {
  private static readonly CANONICAL_GATE_STEP_STATUSES = new Set(['locked', 'active', 'completed', 'pending-retry']);

  private static readonly LEGACY_GATE_STEP_STATUS_MAP: Record<string, 'active' | 'completed'> = {
    started: 'active',
    'in-progress': 'active',
    failed: 'active',
    abandoned: 'active',
    paused: 'active',
    available: 'active',
    'turned-in': 'completed',
  };

  constructor(private missionService: MissionService) {}

  /**
   * Syncs gate-state progress to mission status, or skips when required identifiers are missing.
   */
  async syncGateState(request: MissionProgressSyncRequest): Promise<UpsertMissionStatusResult | 'skipped'> {
    const playerName = request.playerName.trim();
    const characterId = request.characterId.trim();
    const sessionKey = request.sessionKey.trim();
    const missionId = request.gateState.missionId?.trim();
    if (!playerName || !characterId || !sessionKey || !missionId) {
      return 'skipped';
    }

    const normalizedGateState = this.normalizeGateStateForSync(request.gateState);
    const status = this.resolveStatusFromGateState(normalizedGateState);
    const upsertResult = await this.missionService.upsertMissionStatus({
      playerName,
      characterId,
      sessionKey,
      missionId,
      status,
      statusDetail: JSON.stringify(normalizedGateState),
    });

    return upsertResult;
  }

  /**
   * Maps gate-step completion progression to mission lifecycle status.
   */
  private resolveStatusFromGateState(gateState: ShipExteriorMissionGateState): MissionStatus {
    const totalSteps = gateState.steps.length;
    if (totalSteps > 0 && gateState.steps.every((step) => step.status === 'completed')) {
      return 'completed';
    }

    return 'active';
  }

  private normalizeGateStateForSync(gateState: ShipExteriorMissionGateState): ShipExteriorMissionGateState {
    const normalizedSteps = gateState.steps.map((step) => {
      const normalizedStatus = this.normalizeGateStepStatus(step.status, {
        missionId: gateState.missionId,
        stepKey: step.key,
      });

      return {
        ...step,
        status: normalizedStatus,
      };
    });

    return {
      ...gateState,
      steps: normalizedSteps,
    };
  }

  private normalizeGateStepStatus(
    rawStatus: unknown,
    context: {
      missionId: string;
      stepKey: string;
    },
  ): 'locked' | 'active' | 'completed' | 'pending-retry' {
    const status = typeof rawStatus === 'string' ? rawStatus.trim().toLowerCase() : '';

    if (MissionProgressSyncService.CANONICAL_GATE_STEP_STATUSES.has(status)) {
      return status as 'locked' | 'active' | 'completed' | 'pending-retry';
    }

    const translatedLegacyStatus = MissionProgressSyncService.LEGACY_GATE_STEP_STATUS_MAP[status];
    if (translatedLegacyStatus) {
      return translatedLegacyStatus;
    }

    appLogger.warn(
      `[mission-progress-sync] Contract violation: unknown gate step status. missionId=${context.missionId} stepKey=${context.stepKey} status=${String(rawStatus)}`,
    );

    return 'active';
  }
}
