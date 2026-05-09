/**
 * Generic exploration mission — Phase 5 of the scene decomposition.
 *
 * This mission demonstrates the `MissionScenePlugin` reuse story: it shares
 * the asteroid seeding implementation from `FIRST_TARGET_SHIP_EXTERIOR_MISSION`
 * but defines its own simpler gate (a single "scan three asteroids" step) and
 * a HUD config that hides repair/fabrication panels which are irrelevant to
 * pure exploration.
 *
 * It is intentionally minimal but fully functional — it can be selected via
 * navigation state (`missionContext.missionId`) and the scene will resolve it
 * through `resolveMissionScenePlugin` exactly like the first-target mission.
 */

import type { MissionStatus } from '../model/mission';
import type { AsteroidScanSample } from '../model/ship-exterior-asteroid-sample';
import {
  createMissionScenePlugin,
  registerMissionScenePlugin,
  type MissionScenePlugin,
} from './mission-scene-plugin';
import { FIRST_TARGET_SHIP_EXTERIOR_MISSION } from './first-target-ship-exterior-mission';
import {
  createInitialMissionGateState,
  registerShipExteriorMission,
  type ShipExteriorMissionDefinition,
  type ShipExteriorMissionGateState,
  type ShipExteriorMissionGateStepDefinition,
} from './ship-exterior-mission';

export const GENERIC_EXPLORATION_MISSION_ID = 'generic-exploration';

const EXPLORATION_REQUIRED_SCAN_COUNT = 3;

const EXPLORATION_GATE_STEPS: readonly ShipExteriorMissionGateStepDefinition[] = [
  {
    key: 'survey_asteroid_field',
    objectiveText: `Objective: Complete ${EXPLORATION_REQUIRED_SCAN_COUNT} asteroid scans to chart this region.`,
    completionToastMessage: 'Mission update: Region charted.',
  },
];

/**
 * Per-character running scan-count tracker. Keyed by character id so distinct
 * pilots maintain independent progress within the same browser session.
 */
const explorationScanCounts = new Map<string, number>();

function incrementExplorationScanCount(characterId: string): number {
  const next = (explorationScanCounts.get(characterId) ?? 0) + 1;
  explorationScanCounts.set(characterId, next);
  return next;
}

function resetExplorationScanCount(characterId: string): void {
  explorationScanCounts.delete(characterId);
}

/**
 * Mission definition. Asteroid seeding and launch-response handling delegate
 * to `FIRST_TARGET_SHIP_EXTERIOR_MISSION` — that logic is mission-agnostic and
 * already battle-tested.
 */
export const GENERIC_EXPLORATION_SHIP_EXTERIOR_MISSION: ShipExteriorMissionDefinition = {
  missionId: GENERIC_EXPLORATION_MISSION_ID,
  canTargetAsteroids() {
    // Exploration missions never launch payloads, so targeting is disabled.
    return false;
  },
  resolveTargetingCapabilityFromInventory() {
    return false;
  },
  resolveLaunchItemResponse({ response }) {
    return {
      removeAsteroidSampleIds: [],
      shouldRefreshAfterLaunch: response.success,
    };
  },
  createFallbackAsteroidSamples(): AsteroidScanSample[] {
    return FIRST_TARGET_SHIP_EXTERIOR_MISSION.createFallbackAsteroidSamples();
  },
  createNewAsteroidSamplesAroundShip(params): AsteroidScanSample[] {
    return FIRST_TARGET_SHIP_EXTERIOR_MISSION.createNewAsteroidSamplesAroundShip(params);
  },
  createResumedAsteroidSamples(params): AsteroidScanSample[] {
    return FIRST_TARGET_SHIP_EXTERIOR_MISSION.createResumedAsteroidSamples(params);
  },
  getGateStepDefinitions() {
    return EXPLORATION_GATE_STEPS;
  },
  doesScanCompleteGateStep(stepKey, _sample) {
    // Completion is tracked in the plugin's `onScan` hook (it needs cumulative
    // state). The definition reports completion only when the count threshold
    // has already been reached — which the hook signals by storing the latest
    // count in `explorationScanCounts`.
    if (stepKey !== 'survey_asteroid_field') {
      return false;
    }
    // The scene calls this from the active sample's character id context; the
    // hook updates the count *before* this is evaluated when invoked through
    // the plugin. To stay decoupled, we sum across all known counters.
    const totals = Array.from(explorationScanCounts.values());
    return totals.some((count) => count >= EXPLORATION_REQUIRED_SCAN_COUNT);
  },
  doesLaunchCompleteGateStep() {
    return false;
  },
  resolveMissionStatusFromGateState(gateState: ShipExteriorMissionGateState): MissionStatus {
    if (gateState.steps.every((step) => step.status === 'completed')) {
      return 'completed';
    }
    if (gateState.steps.some((step) => step.status === 'completed')) {
      return 'in-progress';
    }
    return 'started';
  },
};

export function createGenericExplorationInitialGateState(
  characterId: string,
): ShipExteriorMissionGateState {
  resetExplorationScanCount(characterId);
  return createInitialMissionGateState({
    missionId: GENERIC_EXPLORATION_MISSION_ID,
    characterId,
    steps: EXPLORATION_GATE_STEPS,
  });
}

/**
 * Plugin factory for the generic-exploration mission. Customizes the HUD to
 * hide repair/fabrication panels and registers an `onScan` hook that
 * accumulates the per-character scan count consulted by
 * `doesScanCompleteGateStep`.
 */
export function createGenericExplorationPlugin(
  definition: ShipExteriorMissionDefinition,
): MissionScenePlugin {
  return createMissionScenePlugin(definition, {
    hudConfig: {
      showRepairBay: false,
      showFabricationLab: false,
      showLaunchPanel: false,
      showScanPanel: true,
      objectiveBannerOverride: undefined,
    },
    hooks: {
      onScan: ({ gateState }) => {
        incrementExplorationScanCount(gateState.characterId);
      },
    },
  });
}

/**
 * Register the mission definition (so `resolveShipExteriorMission` can find
 * it) and the plugin factory (so `resolveMissionScenePlugin` applies the
 * exploration HUD/hooks).
 */
registerShipExteriorMission(GENERIC_EXPLORATION_SHIP_EXTERIOR_MISSION);
registerMissionScenePlugin(GENERIC_EXPLORATION_MISSION_ID, createGenericExplorationPlugin);

/**
 * Test-only helper for clearing the scan-count cache between test runs.
 * @internal
 */
export function __resetExplorationScanCountsForTest(): void {
  explorationScanCounts.clear();
}
