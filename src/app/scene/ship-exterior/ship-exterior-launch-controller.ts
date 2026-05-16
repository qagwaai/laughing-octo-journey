import { evaluateMissionGateOnLaunch, type ShipExteriorMissionGateState } from '../../mission/ship-exterior-mission';
import type { ShipExteriorMissionDefinition } from '../../mission/ship-exterior-mission';
import type { LaunchItemResponse } from '../../model/launch-item';
import type { AsteroidScanSample } from '../../model/ship-exterior-asteroid-sample';

interface ShipExteriorLaunchControllerDeps {
  missionDefinition: ShipExteriorMissionDefinition;
  getAsteroidSamples: () => readonly AsteroidScanSample[];
  getMissionGateState: () => ShipExteriorMissionGateState | null;
  setMissionGateState: (gateState: ShipExteriorMissionGateState) => void;
  persistMissionGateState: (gateState: ShipExteriorMissionGateState) => void;
  enqueueMissionProgressUpsert: (item: {
    gateState: ShipExteriorMissionGateState;
    completedStepKey: string | null;
    toastMessage: string | null;
  }) => void;
  removeAsteroidSamples: (sampleIds: readonly string[]) => void;
  queuePostLaunchRefresh: () => void;
  setLaunchToast: (message: string, tone: 'success' | 'error', seed: number | null) => void;
  invokePluginHook: (
    name: 'onLaunch',
    payload: { response: LaunchItemResponse; gateState: ShipExteriorMissionGateState },
  ) => void;
  setLaunchSeedHint: (launchSeed: number | null) => void;
}

/**
 * Owns the launch response workflow for ship-exterior.
 *
 * The controller converts socket launch responses into scene state updates,
 * mission gate persistence, toast feedback, and post-launch refresh requests.
 */
export class ShipExteriorLaunchController {
  constructor(private readonly deps: ShipExteriorLaunchControllerDeps) {}

  handleLaunchItemResponse(response: LaunchItemResponse): void {
    if (!response || typeof response !== 'object') {
      return;
    }

    const launchSeed = response.resolution?.launchSeed ?? null;
    this.deps.setLaunchSeedHint(launchSeed);
    const missionResolution = this.deps.missionDefinition.resolveLaunchItemResponse({
      response,
      asteroidSamples: this.deps.getAsteroidSamples(),
    });

    if (!response.success) {
      this.deps.setLaunchToast(response.message || 'Launch failed', 'error', launchSeed);
      return;
    }

    if (missionResolution.removeAsteroidSampleIds.length > 0) {
      this.deps.removeAsteroidSamples(missionResolution.removeAsteroidSampleIds);
    }

    let toastMessage = response.message || 'Launch complete';
    const yieldedItems = response.resolution?.yieldedItems ?? [];
    if (yieldedItems.length > 0) {
      const itemsList = yieldedItems.map((item) => `${item.displayName} ×${item.quantity}`).join(', ');
      toastMessage = `${toastMessage} — ${itemsList}`;
    }

    const gateState = this.deps.getMissionGateState();
    if (gateState) {
      const launchEvaluation = evaluateMissionGateOnLaunch({
        mission: this.deps.missionDefinition,
        gateState,
        response,
      });
      if (launchEvaluation.changed) {
        this.deps.setMissionGateState(launchEvaluation.gateState);
        this.deps.persistMissionGateState(launchEvaluation.gateState);
        this.deps.enqueueMissionProgressUpsert({
          gateState: launchEvaluation.gateState,
          completedStepKey: launchEvaluation.completedStepKey,
          toastMessage: launchEvaluation.completionToastMessage,
        });
        this.deps.invokePluginHook('onLaunch', { response, gateState: launchEvaluation.gateState });
        if (launchEvaluation.completionToastMessage) {
          toastMessage = `${toastMessage} ${launchEvaluation.completionToastMessage}`;
        }
      }
    }

    this.deps.setLaunchToast(toastMessage, 'success', launchSeed);
    if (missionResolution.shouldRefreshAfterLaunch) {
      this.deps.queuePostLaunchRefresh();
    }
  }
}