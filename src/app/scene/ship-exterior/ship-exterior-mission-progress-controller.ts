import { AsyncSerialQueue } from './async-serial-queue';
import {
  clearMissionGatePendingRetry,
  evaluateMissionGateOnDebrisCollection,
  markMissionGateStepPendingRetry,
  serializeMissionGateState,
  type ShipExteriorMissionDefinition,
  type ShipExteriorMissionGateState,
} from '../../mission/ship-exterior-mission';
import { MissionService } from '../../services/mission.service';
import { SessionService } from '../../services/session.service';

interface MissionProgressUpsertQueueItem {
  gateState: ShipExteriorMissionGateState;
  completedStepKey: string | null;
  toastMessage: string | null;
}

interface ShipExteriorMissionProgressControllerDeps {
  missionDefinition: ShipExteriorMissionDefinition;
  missionService: MissionService;
  sessionService: SessionService;
  getPlayerName: () => string;
  getCharacterId: () => string | null;
  getGateState: () => ShipExteriorMissionGateState | null;
  setGateState: (gateState: ShipExteriorMissionGateState) => void;
  persistGateState: (gateState: ShipExteriorMissionGateState) => void;
  setLaunchToast: (message: string, tone: 'success' | 'error', seed: number | null) => void;
}

/**
 * Owns the mission-progress queue for ship-exterior launches and scans.
 *
 * The controller keeps backend write sequencing and retry handling out of the
 * scene component while preserving the component's mission state ownership.
 */
export class ShipExteriorMissionProgressController {
  private readonly missionProgressUpsertQueue = new AsyncSerialQueue<MissionProgressUpsertQueueItem>((item) =>
    this.processMissionProgressUpsert(item),
  );

  constructor(private readonly deps: ShipExteriorMissionProgressControllerDeps) {}

  evaluateFloatingDebrisCollection(previousCount: number, currentCount: number): void {
    if (previousCount <= 0 || currentCount !== 0) {
      return;
    }

    const currentGateState = this.deps.getGateState();
    if (!currentGateState) {
      return;
    }

    const evaluation = evaluateMissionGateOnDebrisCollection({
      mission: this.deps.missionDefinition,
      gateState: currentGateState,
      remainingDebrisCount: currentCount,
    });
    if (!evaluation.changed) {
      return;
    }

    this.deps.setGateState(evaluation.gateState);
    this.deps.persistGateState(evaluation.gateState);
    this.enqueueMissionProgressUpsert({
      gateState: evaluation.gateState,
      completedStepKey: evaluation.completedStepKey,
      toastMessage: evaluation.completionToastMessage,
    });
  }

  retryPendingMissionProgressSync(): void {
    const gateState = this.deps.getGateState();
    if (!gateState || !this.hasMissionGatePendingRetry(gateState)) {
      return;
    }

    if (this.missionProgressUpsertQueue.hasPending) {
      return;
    }

    this.enqueueMissionProgressUpsert({
      gateState,
      completedStepKey: null,
      toastMessage: null,
    });
  }

  enqueueMissionProgressUpsert(item: MissionProgressUpsertQueueItem): void {
    const statusDetail = serializeMissionGateState(item.gateState);
    this.missionProgressUpsertQueue.enqueue(
      item,
      (queued) => serializeMissionGateState(queued.gateState) === statusDetail,
    );
  }

  private hasMissionGatePendingRetry(gateState: ShipExteriorMissionGateState): boolean {
    return gateState.steps.some((step) => step.status === 'pending-retry');
  }

  private async processMissionProgressUpsert(item: MissionProgressUpsertQueueItem): Promise<void> {
    const sessionKey = this.deps.sessionService.getSessionKey()?.trim() ?? '';
    const playerName = this.deps.getPlayerName().trim();
    const characterId = this.deps.getCharacterId()?.trim() ?? '';
    if (!sessionKey || !playerName || !characterId) {
      return;
    }

    const result = await this.deps.missionService.upsertMissionStatus({
      playerName,
      characterId,
      sessionKey,
      missionId: this.deps.missionDefinition.missionId,
      status: this.deps.missionDefinition.resolveMissionStatusFromGateState(item.gateState),
      statusDetail: serializeMissionGateState(item.gateState),
    });

    if (result !== 'updated') {
      if (item.completedStepKey) {
        const nextState = markMissionGateStepPendingRetry(item.gateState, item.completedStepKey);
        this.deps.setGateState(nextState);
        this.deps.persistGateState(nextState);
        this.deps.setLaunchToast('Mission progress sync pending; retrying on next scan event.', 'error', null);
      }
      return;
    }

    const syncedState = clearMissionGatePendingRetry(item.gateState);
    this.deps.setGateState(syncedState);
    this.deps.persistGateState(syncedState);
    if (item.toastMessage) {
      this.deps.setLaunchToast(item.toastMessage, 'success', null);
    }
  }
}