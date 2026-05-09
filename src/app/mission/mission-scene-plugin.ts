/**
 * Mission scene plugin contract.
 *
 * A `MissionScenePlugin` is a thin façade that the ship-exterior scene consumes
 * to orchestrate per-mission behavior without coupling to a specific mission's
 * implementation. It is built on top of `ShipExteriorMissionDefinition` and
 * adds three scene-facing concerns:
 *
 * 1. **seedPolicy** — how the scene should seed asteroid samples (fallback,
 *    new launch, resume).
 * 2. **hudConfig** — which HUD panels/affordances the scene should expose for
 *    this mission.
 * 3. **hooks** — optional lifecycle callbacks invoked by the scene when key
 *    events happen (scan, launch, manufacture, repair).
 *
 * Phase 3 of the scene decomposition introduces this contract. The scene
 * itself continues to consume the mission definition directly until Phase 4
 * migrates it to the plugin.
 */

import type { LaunchItemResponse } from '../model/launch-item';
import type { CelestialBodyListItem } from '../model/celestial-body-list';
import type { AsteroidScanSample } from '../model/ship-exterior-asteroid-sample';
import type { Triple } from '../model/shared/triple';
import {
  resolveShipExteriorMission,
  type ShipExteriorMissionDefinition,
  type ShipExteriorMissionGateState,
} from './ship-exterior-mission';

/**
 * Scene seeding policy. Wraps the seed-related methods on the mission
 * definition so individual missions can override seeding without
 * re-implementing the rest of the definition.
 */
export interface MissionScenePluginSeedPolicy {
  createFallbackSamples(): AsteroidScanSample[];
  createNewSamples(params: {
    playerName: string;
    characterId: string;
    center: Triple;
    launchSeedHint?: number | null;
  }): AsteroidScanSample[];
  createResumedSamples(params: {
    playerName: string;
    characterId: string;
    center: Triple;
    launchSeedHint?: number | null;
    existingBodies: CelestialBodyListItem[];
  }): AsteroidScanSample[];
}

/**
 * HUD layout/affordance config. Lets a mission opt out of (or override) the
 * scene's default operational panels (repair bay, fabrication lab, scan,
 * launch, etc.) without forking the scene template.
 */
export interface MissionScenePluginHudConfig {
  showRepairBay: boolean;
  showFabricationLab: boolean;
  showScanPanel: boolean;
  showLaunchPanel: boolean;
  /** Optional override for the objective banner copy. */
  objectiveBannerOverride?: string;
}

/**
 * Lifecycle hooks fired by the scene when the corresponding event occurs.
 * All hooks are optional. Hooks are advisory: they may emit UI feedback,
 * record analytics, or trigger side missions, but must not mutate the
 * scene's authoritative state — that responsibility stays with the scene.
 */
export interface MissionScenePluginHooks {
  onScan?(params: { sample: AsteroidScanSample; gateState: ShipExteriorMissionGateState }): void;
  onLaunch?(params: {
    response: LaunchItemResponse;
    gateState: ShipExteriorMissionGateState;
  }): void;
  onManufacture?(params: {
    manufacturedItemType: string;
    gateState: ShipExteriorMissionGateState;
  }): void;
  onRepair?(params: { repairKind: string; gateState: ShipExteriorMissionGateState }): void;
}

/**
 * The scene-facing contract describing how a mission integrates with the
 * ship-exterior scene.
 */
export interface MissionScenePlugin {
  readonly missionId: string;
  readonly definition: ShipExteriorMissionDefinition;
  readonly seedPolicy: MissionScenePluginSeedPolicy;
  readonly hudConfig: MissionScenePluginHudConfig;
  readonly hooks: MissionScenePluginHooks;
}

export const DEFAULT_MISSION_SCENE_HUD_CONFIG: MissionScenePluginHudConfig = Object.freeze({
  showRepairBay: true,
  showFabricationLab: true,
  showScanPanel: true,
  showLaunchPanel: true,
});

/**
 * Build a default seed policy by delegating to the mission definition.
 */
export function createDefaultSeedPolicy(
  definition: ShipExteriorMissionDefinition,
): MissionScenePluginSeedPolicy {
  return {
    createFallbackSamples: () => definition.createFallbackAsteroidSamples(),
    createNewSamples: (params) => definition.createNewAsteroidSamplesAroundShip(params),
    createResumedSamples: (params) => definition.createResumedAsteroidSamples(params),
  };
}

/**
 * Build a `MissionScenePlugin` from a mission definition. Optional overrides
 * let a mission customize seed policy, HUD config, and hooks while inheriting
 * sensible defaults from the definition.
 */
export function createMissionScenePlugin(
  definition: ShipExteriorMissionDefinition,
  overrides?: {
    seedPolicy?: Partial<MissionScenePluginSeedPolicy>;
    hudConfig?: Partial<MissionScenePluginHudConfig>;
    hooks?: MissionScenePluginHooks;
  },
): MissionScenePlugin {
  const defaultSeedPolicy = createDefaultSeedPolicy(definition);
  return {
    missionId: definition.missionId,
    definition,
    seedPolicy: { ...defaultSeedPolicy, ...overrides?.seedPolicy },
    hudConfig: { ...DEFAULT_MISSION_SCENE_HUD_CONFIG, ...overrides?.hudConfig },
    hooks: overrides?.hooks ?? {},
  };
}

/**
 * Per-mission plugin registry. Missions that need scene-specific overrides
 * register a factory here. Missions absent from the registry fall back to the
 * default plugin built from their `ShipExteriorMissionDefinition`.
 *
 * The registry is lazily initialized to be resilient to circular-import edge
 * cases where module evaluation order can leave a `const`-declared Map in the
 * temporal dead zone when registration is invoked from a side-effect import.
 */
let missionScenePluginFactories: Map<
  string,
  (definition: ShipExteriorMissionDefinition) => MissionScenePlugin
> | null = null;

function getMissionScenePluginFactories(): Map<
  string,
  (definition: ShipExteriorMissionDefinition) => MissionScenePlugin
> {
  if (!missionScenePluginFactories) {
    missionScenePluginFactories = new Map();
  }
  return missionScenePluginFactories;
}

/**
 * Register a plugin factory for a specific mission. Intended to be called
 * from the mission's own module (so the registration is co-located with the
 * mission definition).
 */
export function registerMissionScenePlugin(
  missionId: string,
  factory: (definition: ShipExteriorMissionDefinition) => MissionScenePlugin,
): void {
  getMissionScenePluginFactories().set(missionId, factory);
}

/**
 * Resolve the `MissionScenePlugin` for a given mission id. Falls back to the
 * default plugin built from the mission definition if no custom factory is
 * registered.
 */
export function resolveMissionScenePlugin(missionId?: string | null): MissionScenePlugin {
  const definition = resolveShipExteriorMission(missionId);
  const factory = getMissionScenePluginFactories().get(definition.missionId);
  return factory ? factory(definition) : createMissionScenePlugin(definition);
}
