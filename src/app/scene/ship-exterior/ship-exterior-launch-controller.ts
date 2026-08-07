import { evaluateMissionGateOnLaunch, type ShipExteriorMissionGateState } from '../../mission/ship-exterior-mission';
import type { ShipExteriorMissionDefinition } from '../../mission/ship-exterior-mission';
import type { LaunchItemResponse, LaunchItemYieldedItem, LaunchItemYieldedMaterial } from '../../model/launch-item';
import type { AsteroidScanSample } from '../../model/ship-exterior-asteroid-sample';

type ShipExteriorLaunchAsteroidSample = {
  id: string;
  serverCelestialBodyId?: string | null;
  revealedMaterial?: {
    material?: string;
  } | null;
};

interface ShipExteriorLaunchControllerDeps {
  missionDefinition: ShipExteriorMissionDefinition;
  getAsteroidSamples: () => readonly ShipExteriorLaunchAsteroidSample[];
  getMissionGateState: () => ShipExteriorMissionGateState | null;
  setMissionGateState: (gateState: ShipExteriorMissionGateState) => void;
  persistMissionGateState: (gateState: ShipExteriorMissionGateState) => void;
  enqueueMissionProgressUpsert: (item: {
    gateState: ShipExteriorMissionGateState;
    completedStepKey: string | null;
    toastMessage: string | null;
  }) => void;
  removeAsteroidSamples: (sampleIds: readonly string[]) => void;
  consumeLaunchedItem: (response: LaunchItemResponse) => void;
  applyMaterialRewards: (materials: readonly LaunchItemYieldedMaterial[]) => void;
  applyYieldedItems: (items: readonly LaunchItemYieldedItem[]) => void;
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
  private static readonly MISSION_PROGRESS_UPSERT_AFTER_REWARD_DELAY_MS = 150;
  private static readonly MAX_LAUNCH_GATE_CHAIN_EVALUATIONS = 8;

  constructor(private readonly deps: ShipExteriorLaunchControllerDeps) {}

  private normalizeMaterialToken(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[_\s]+/g, '-')
      .replace(/[^a-z0-9-]/g, '');
  }

  private toMissionAsteroidSamples(
    asteroidSamples: readonly ShipExteriorLaunchAsteroidSample[],
  ): readonly AsteroidScanSample[] {
    return asteroidSamples.map((sample) => ({
      id: sample.id,
      serverCelestialBodyId: sample.serverCelestialBodyId ?? null,
      position: [0, 0, 0],
      basePosition: [0, 0, 0],
      scanProgress: 0,
      scanned: false,
      revealedMaterial: sample.revealedMaterial
        ? {
            material: sample.revealedMaterial.material ?? 'Unknown',
            rarity: 'Common',
            textureColor: '#8f99a7',
          }
        : null,
      revealedKinematics: null,
      capturedKinematics: {
        velocityKmPerSec: { x: 0, y: 0, z: 0 },
        angularVelocityRadPerSec: { x: 0, y: 0, z: 0 },
        estimatedMassKg: 0,
        estimatedDiameterM: 0,
      },
      solarSystemLocation: {
        positionKm: { x: 0, y: 0, z: 0 },
      },
      clusterCenterKm: { x: 0, y: 0, z: 0 },
      motionPhase: 0,
      motionRate: 0,
      motionRadius: 0,
      bobAmplitude: 0,
    }));
  }

  private resolveImmediateMaterialRewards(params: {
    response: LaunchItemResponse;
    missionResolution: { removeAsteroidSampleIds: string[] };
    asteroidSamples: readonly ShipExteriorLaunchAsteroidSample[];
  }): LaunchItemYieldedMaterial[] {
    const yieldedMaterials = (params.response.resolution?.yieldedMaterials ?? []).filter(
      (material) => Number.isFinite(material.quantity) && material.quantity > 0,
    );
    const isIronTargetHit = params.asteroidSamples.some((sample) => {
      const matchedByMissionResolution = params.missionResolution.removeAsteroidSampleIds.includes(sample.id);
      const matchedByResponseTarget =
        sample.serverCelestialBodyId === params.response.targetCelestialBodyId ||
        sample.id === params.response.targetCelestialBodyId;
      if (!matchedByMissionResolution && !matchedByResponseTarget) {
        return false;
      }

      return this.normalizeMaterialToken(sample.revealedMaterial?.material ?? '') === 'iron';
    });

    if (params.response.resolution?.outcome === 'target-destroyed' && isIronTargetHit) {
      const nonIronYielded = yieldedMaterials.filter(
        (material) => this.normalizeMaterialToken(material.material) !== 'iron',
      );
      return [
        {
          material: 'Iron',
          rarity: 'Common',
          quantity: 1,
        },
        ...nonIronYielded,
      ];
    }

    if (yieldedMaterials.length > 0) {
      return yieldedMaterials;
    }

    if (params.response.resolution?.outcome !== 'target-destroyed') {
      return [];
    }

    return [];
  }

  handleLaunchItemResponse(response: LaunchItemResponse): void {
    if (!response || typeof response !== 'object') {
      return;
    }

    const launchSeed = response.resolution?.launchSeed ?? null;
    this.deps.setLaunchSeedHint(launchSeed);
    const asteroidSamples = this.deps.getAsteroidSamples();
    const missionAsteroidSamples = this.toMissionAsteroidSamples(asteroidSamples);
    const missionResolution = this.deps.missionDefinition.resolveLaunchItemResponse({
      response,
      asteroidSamples: missionAsteroidSamples,
    });

    if (!response.success) {
      this.deps.setLaunchToast(response.message || 'Launch failed', 'error', launchSeed);
      return;
    }

    if (missionResolution.removeAsteroidSampleIds.length > 0) {
      this.deps.removeAsteroidSamples(missionResolution.removeAsteroidSampleIds);
    }

    this.deps.consumeLaunchedItem(response);

    const materialRewards = this.resolveImmediateMaterialRewards({
      response,
      missionResolution,
      asteroidSamples,
    });
    if (materialRewards.length > 0) {
      this.deps.applyMaterialRewards(materialRewards);
    }
    const yieldedItems = response.resolution?.yieldedItems ?? [];
    if (yieldedItems.length > 0) {
      this.deps.applyYieldedItems(yieldedItems);
    }

    let toastMessage = response.message || 'Launch complete';
    if (materialRewards.length > 0) {
      const materialsList = materialRewards.map((item) => `${item.material} ×${item.quantity}`).join(', ');
      toastMessage = `${toastMessage} — ${materialsList}`;
    }
    if (yieldedItems.length > 0) {
      const itemsList = yieldedItems.map((item) => `${item.displayName} ×${item.quantity}`).join(', ');
      toastMessage = `${toastMessage} — ${itemsList}`;
    }

    const gateState = this.deps.getMissionGateState();
    if (gateState) {
      let lastLaunchEvaluation: ReturnType<typeof evaluateMissionGateOnLaunch> | null = null;
      let launchEvaluationInputGateState = gateState;
      for (let i = 0; i < ShipExteriorLaunchController.MAX_LAUNCH_GATE_CHAIN_EVALUATIONS; i += 1) {
        const launchEvaluation = evaluateMissionGateOnLaunch({
          mission: this.deps.missionDefinition,
          gateState: launchEvaluationInputGateState,
          response,
        });
        if (!launchEvaluation.changed) {
          break;
        }
        lastLaunchEvaluation = launchEvaluation;
        launchEvaluationInputGateState = launchEvaluation.gateState;
      }

      if (lastLaunchEvaluation) {
        this.deps.setMissionGateState(lastLaunchEvaluation.gateState);
        this.deps.persistMissionGateState(lastLaunchEvaluation.gateState);
        this.enqueueMissionProgressUpsertWithContentionBackoff(
          {
            gateState: lastLaunchEvaluation.gateState,
            completedStepKey: lastLaunchEvaluation.completedStepKey,
            toastMessage: lastLaunchEvaluation.completionToastMessage,
          },
          materialRewards.length > 0,
        );
        this.deps.invokePluginHook('onLaunch', { response, gateState: lastLaunchEvaluation.gateState });
        if (lastLaunchEvaluation.completionToastMessage) {
          toastMessage = `${toastMessage} ${lastLaunchEvaluation.completionToastMessage}`;
        }
      }
    }

    this.deps.setLaunchToast(toastMessage, 'success', launchSeed);
    if (missionResolution.shouldRefreshAfterLaunch) {
      this.deps.queuePostLaunchRefresh();
    }
  }

  private enqueueMissionProgressUpsertWithContentionBackoff(
    item: {
      gateState: ShipExteriorMissionGateState;
      completedStepKey: string | null;
      toastMessage: string | null;
    },
    shouldDelay: boolean,
  ): void {
    if (!shouldDelay) {
      this.deps.enqueueMissionProgressUpsert(item);
      return;
    }

    // Launch success can trigger immediate item-upsert writes for material rewards.
    // Briefly delaying mission-upsert reduces optimistic concurrency collisions on the
    // same character aggregate while preserving user-visible progress behavior.
    setTimeout(() => this.deps.enqueueMissionProgressUpsert(item), ShipExteriorLaunchController.MISSION_PROGRESS_UPSERT_AFTER_REWARD_DELAY_MS);
  }
}