import {
  ASTEROID_MATERIALS,
  pickWeightedAsteroidMaterial,
  type AsteroidMaterialProfile,
} from '../model/catalog/asteroid-materials';
import {
  SW13B_M0B_PUBLISHED_ARTIFACTS,
  type Sw13bAsteroidRegistryEntry,
  type Sw13bTier,
} from '../model/sw13b/sw-13b-m0b-asteroid-baseline';
import { generateRandomAsteroidKinematics } from '../model/math/asteroid-kinematics';
import {
  DEFAULT_CLUSTER_SPREAD_KM,
  generateRandomAsteroidBeltClusterCenterKm,
  generateRandomCelestialBodyLocationNear,
} from '../model/math/celestial-body-location';
import { generateRandomAsteroidMeshProfile } from '../model/catalog/asteroid-mesh-profiles';
import type { MissionStatus } from '../model/mission';
import { FIRST_TARGET_MISSION_ID } from '../model/mission.locale';
import { resolveAsteroidExternalObjectDescriptor } from '../model/ship-exterior-descriptors';
import type { Triple } from '../model/shared/triple';
import type { AsteroidScanSample } from '../model/ship-exterior-asteroid-sample';
import type { LaunchItemResponse } from '../model/launch-item';
import type { CelestialBodyListItem } from '../model/celestial-body-list';
import { coerceShipInventory } from '../model/ship-list';
import {
  registerMissionInitializationStrategy,
  type MissionInitializationStrategy,
} from '../services/mission-navigation/mission-initialization-strategy';

interface ShipExteriorMissionGateStepDefinition {
  key: string;
  objectiveText: string;
  completionToastMessage: string;
  prerequisiteStepKeys?: readonly string[];
}

interface ShipExteriorMissionGateStepState {
  key: string;
  status: 'locked' | 'active' | 'completed' | 'pending-retry';
}

interface ShipExteriorMissionGateState {
  missionId: string;
  characterId: string;
  activeObjectiveText: string;
  updatedAt: string;
  steps: ShipExteriorMissionGateStepState[];
}

function normalizeInventoryToken(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function hasExpendableDartDroneInInventory(rawInventory: unknown): boolean {
  const normalizedTarget = 'expendable-dart-drone';
  const normalizedDisplayTarget = 'expendable-dart-drone';

  const coercedInventory = coerceShipInventory(rawInventory);
  if (coercedInventory.some((item) => normalizeInventoryToken(item.itemType) === normalizedTarget)) {
    return true;
  }

  if (!Array.isArray(rawInventory)) {
    return false;
  }

  return rawInventory.some((rawItem) => {
    if (!rawItem || typeof rawItem !== 'object') {
      return false;
    }

    const item = rawItem as Record<string, unknown>;
    const itemType = normalizeInventoryToken(item['itemType']);
    if (itemType === normalizedTarget) {
      return true;
    }

    const displayName = normalizeInventoryToken(item['displayName']);
    return displayName === normalizedDisplayTarget;
  });
}

const IRON_MATERIAL = ASTEROID_MATERIALS.find((m) => m.material === 'Iron')!;

interface GeneratedAsteroidAssignment {
  material: AsteroidMaterialProfile;
  registryEntry: Sw13bAsteroidRegistryEntry;
}

const FIRST_TARGET_GATE_STEPS: readonly ShipExteriorMissionGateStepDefinition[] = [
  {
    key: 'identify_iron_asteroid',
    objectiveText: 'Objective: Identify an Iron asteroid via full scan.',
    completionToastMessage: 'Mission update: Iron asteroid identified.',
  },
  {
    key: 'neutralize_identified_asteroid',
    objectiveText: 'Objective unlocked: Neutralize the identified asteroid using a launchable payload.',
    completionToastMessage: 'Mission update: Target neutralized.',
    prerequisiteStepKeys: ['identify_iron_asteroid'],
  },
  {
    key: 'manufacture_hull_patch_kit',
    objectiveText: 'Objective unlocked: Manufacture a Hull Patch Kit at the Fabrication Lab (requires 1 iron).',
    completionToastMessage: 'Mission update: Hull Patch Kit manufactured.',
    prerequisiteStepKeys: ['neutralize_identified_asteroid'],
  },
  {
    key: 'repair_scavenger_pod',
    objectiveText: 'Objective unlocked: Repair the Scavenger Pod at the Repair & Retrofit station.',
    completionToastMessage: 'Mission update: Scavenger Pod repaired.',
    prerequisiteStepKeys: ['manufacture_hull_patch_kit'],
  },
];

function materialToSeedToken(material: string): string {
  return material.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function resolveRegistryEntry(material: string, tier: Sw13bTier): Sw13bAsteroidRegistryEntry {
  const token = materialToSeedToken(material);
  const matches = SW13B_M0B_PUBLISHED_ARTIFACTS.registry.filter(
    (entry) => entry.seedId.includes(`-${tier}-`) && entry.seedId.split('-')[3] === token,
  );

  return matches[0] ?? SW13B_M0B_PUBLISHED_ARTIFACTS.registry[0]!;
}

function resolveSampleTier(index: number, count: number): Sw13bTier {
  if (count <= 1) {
    return 'B';
  }

  if (index === 0) {
    return 'B';
  }

  if (index === 1) {
    return 'H';
  }

  return index % 5 === 0 ? 'H' : 'B';
}

function generateMaterialAssignments(count: number, random: () => number): GeneratedAsteroidAssignment[] {
  const materials = Array.from({ length: count }, () => pickWeightedAsteroidMaterial(random));
  if (count > 0 && !materials.some((m) => m.material === 'Iron')) {
    const replaceIndex = Math.floor(random() * count);
    materials[replaceIndex] = IRON_MATERIAL;
  }

  return materials.map((material, index) => {
    const tier = resolveSampleTier(index, count);
    return {
      material,
      registryEntry: resolveRegistryEntry(material.material, tier),
    };
  });
}

function hashToSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function resolveAsteroidSeed(
  playerName: string,
  characterId: string,
  center: Triple,
  launchSeedHint: number | null | undefined,
): number {
  const baseSeed = hashToSeed(`${playerName}::${characterId}::${center.x}:${center.y}:${center.z}`);
  if (launchSeedHint === null || launchSeedHint === undefined || !Number.isFinite(launchSeedHint)) {
    return baseSeed;
  }

  return (baseSeed ^ (launchSeedHint >>> 0)) >>> 0;
}

function generateAsteroidSamples(
  clusterCenterKm?: Triple,
  random: () => number = Math.random,
  count?: number,
  preAssignedAssignments?: GeneratedAsteroidAssignment[],
): AsteroidScanSample[] {
  const resolvedCount = count ?? Math.floor(random() * 16) + 5;
  const samples: AsteroidScanSample[] = [];
  const resolvedClusterCenterKm = clusterCenterKm ?? generateRandomAsteroidBeltClusterCenterKm(random);

  for (let i = 0; i < resolvedCount; i++) {
    const baseAngle = (i / resolvedCount) * Math.PI * 2;
    const angleJitter = (random() - 0.5) * (Math.PI / resolvedCount);
    const angle = baseAngle + angleJitter;

    const distance = 6 + random() * 14;
    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const solarSystemLocation = generateRandomCelestialBodyLocationNear(resolvedClusterCenterKm, undefined, random);
    const y = (random() - 0.5) * 8;
    const basePosition: [number, number, number] = [+x.toFixed(2), +y.toFixed(2), +z.toFixed(2)];
    const capturedKinematics = generateRandomAsteroidKinematics(random);
    const velocity = capturedKinematics.velocityKmPerSec;
    const speedKmPerSec = Math.hypot(velocity.x, velocity.y, velocity.z);
    const speedFactor = Math.min(1, speedKmPerSec / 32);

    samples.push({
      id: `sample-a${i + 1}`,
      serverCelestialBodyId: null,
      meshProfileKey: generateRandomAsteroidMeshProfile(random).meshProfileKey,
      sw13bSeedId: preAssignedAssignments?.[i]?.registryEntry.seedId ?? null,
      sw13bGeneratorVersion: preAssignedAssignments?.[i]?.registryEntry.generatorVersion ?? null,
      sw13bParameterBundleHash: preAssignedAssignments?.[i]?.registryEntry.parameterBundleHash ?? null,
      sw13bProfilePreset: preAssignedAssignments?.[i]?.registryEntry.profilePreset ?? null,
      sw13bTargetSurfaces: preAssignedAssignments?.[i]?.registryEntry.targetSurfaces ?? null,
      sw13bValidationStatus: preAssignedAssignments?.[i]?.registryEntry.validationStatus ?? null,
      position: basePosition,
      basePosition,
      scanProgress: 0,
      scanned: false,
      revealedMaterial: preAssignedAssignments?.[i]?.material ?? null,
      externalObjectDescriptor: resolveAsteroidExternalObjectDescriptor({
        sampleId: `sample-a${i + 1}`,
        revealedMaterial: preAssignedAssignments?.[i]?.material ?? null,
      }),
      revealedKinematics: null,
      solarSystemLocation,
      clusterCenterKm: resolvedClusterCenterKm,
      capturedKinematics,
      motionPhase: random() * Math.PI * 2,
      motionRate: 0.2 + speedFactor * 0.55,
      motionRadius: 0.2 + speedFactor * 0.95,
      bobAmplitude: 0.06 + random() * 0.4,
    });
  }

  return samples;
}

export const FIRST_TARGET_SHIP_EXTERIOR_MISSION = {
  missionId: FIRST_TARGET_MISSION_ID,
  canTargetAsteroids() {
    return true;
  },
  resolveTargetingCapabilityFromInventory(rawInventory: unknown) {
    return hasExpendableDartDroneInInventory(rawInventory);
  },
  resolveLaunchItemResponse({
    response,
    asteroidSamples,
  }: {
    response: LaunchItemResponse;
    asteroidSamples: readonly AsteroidScanSample[];
  }) {
    if (!response.success) {
      return {
        removeAsteroidSampleIds: [],
        shouldRefreshAfterLaunch: false,
      };
    }

    if (response.resolution?.outcome !== 'target-destroyed') {
      return {
        removeAsteroidSampleIds: [],
        shouldRefreshAfterLaunch: true,
      };
    }

    const removeAsteroidSampleIds = asteroidSamples
      .filter(
        (sample) =>
          sample.serverCelestialBodyId === response.targetCelestialBodyId ||
          sample.id === response.targetCelestialBodyId,
      )
      .map((sample) => sample.id);

    return {
      removeAsteroidSampleIds,
      shouldRefreshAfterLaunch: true,
    };
  },
  createFallbackAsteroidSamples() {
    const count = Math.floor(Math.random() * 16) + 5;
    const assignments = generateMaterialAssignments(count, Math.random);
    return generateAsteroidSamples(undefined, Math.random, count, assignments);
  },
  createNewAsteroidSamplesAroundShip({
    playerName,
    characterId,
    center,
    launchSeedHint,
  }: {
    playerName: string;
    characterId: string;
    center: Triple;
    launchSeedHint?: number | null;
  }) {
    const rng = seededRandom(resolveAsteroidSeed(playerName, characterId, center, launchSeedHint));
    const count = Math.floor(rng() * 16) + 5;
    const assignments = generateMaterialAssignments(count, rng);
    return generateAsteroidSamples(center, rng, count, assignments);
  },
  createResumedAsteroidSamples({
    playerName,
    characterId,
    center,
    existingBodies,
    launchSeedHint,
  }: {
    playerName: string;
    characterId: string;
    center: Triple;
    existingBodies: CelestialBodyListItem[];
    launchSeedHint?: number | null;
  }) {
    const rng = seededRandom(resolveAsteroidSeed(playerName, characterId, center, launchSeedHint));
    const activeBodies = existingBodies.filter((body) => body.state !== 'destroyed');
    const existingBySourceScanId = new Map(
      activeBodies
        .filter((body) => typeof body.sourceScanId === 'string' && body.sourceScanId.trim().length > 0)
        .map((body) => [body.sourceScanId, body] as const),
    );
    const randomTarget = Math.floor(rng() * 16) + 5;
    const total = Math.max(activeBodies.length, randomTarget);
    const assignments = generateMaterialAssignments(total, rng);
    const allSamples = generateAsteroidSamples(center, rng, total, assignments);

    return allSamples.map((sample, index) => {
      const existingBody = existingBySourceScanId.get(sample.id) ?? activeBodies[index];
      if (!existingBody) {
        return sample;
      }

      const shouldTreatAsScanned =
        existingBody.observability?.scanState === 'scanned' || existingBody.state === 'active';
      const resolvedKinematics = existingBody.motion
        ? {
            velocityKmPerSec: existingBody.motion.velocityKmPerSec,
            angularVelocityRadPerSec:
              existingBody.motion.angularVelocityRadPerSec ?? sample.capturedKinematics.angularVelocityRadPerSec,
            estimatedMassKg: existingBody.physical?.estimatedMassKg ?? sample.capturedKinematics.estimatedMassKg,
            estimatedDiameterM:
              existingBody.physical?.estimatedDiameterM ?? sample.capturedKinematics.estimatedDiameterM,
          }
        : sample.capturedKinematics;
      const resolvedLocation = existingBody.spatial
        ? { positionKm: existingBody.spatial.positionKm }
        : sample.solarSystemLocation;
      const resolvedMaterial = existingBody.composition ?? sample.revealedMaterial;
      const resolvedFallbackTier = shouldTreatAsScanned ? 'hero' : 'standard';

      return {
        ...sample,
        serverCelestialBodyId: existingBody.id,
        meshProfileKey: existingBody.meshProfileKey ?? sample.meshProfileKey,
        scanProgress: shouldTreatAsScanned ? 100 : 0,
        scanned: shouldTreatAsScanned,
        revealedMaterial: resolvedMaterial,
        externalObjectDescriptor: resolveAsteroidExternalObjectDescriptor({
          sampleId: existingBody.sourceScanId || existingBody.id || sample.id,
          revealedMaterial: resolvedMaterial,
          fallbackTier: resolvedFallbackTier,
        }),
        revealedKinematics: shouldTreatAsScanned ? resolvedKinematics : null,
        capturedKinematics: resolvedKinematics,
        solarSystemLocation: resolvedLocation,
      };
    });
  },
  getGateStepDefinitions() {
    return FIRST_TARGET_GATE_STEPS;
  },
  doesScanCompleteGateStep(stepKey: string, sample: AsteroidScanSample) {
    if (stepKey === 'identify_iron_asteroid') {
      return sample.revealedMaterial?.material === 'Iron';
    }

    return false;
  },
  doesLaunchCompleteGateStep(stepKey: string, response: LaunchItemResponse) {
    return (
      stepKey === 'neutralize_identified_asteroid' &&
      response.success === true &&
      response.resolution?.outcome === 'target-destroyed'
    );
  },
  doesManufactureCompleteGateStep(stepKey: string, manufacturedItemType: string) {
    return stepKey === 'manufacture_hull_patch_kit' && manufacturedItemType === 'hull-patch-kit';
  },
  doesRepairCompleteGateStep(stepKey: string, repairKind: string) {
    return stepKey === 'repair_scavenger_pod' && repairKind === 'ship';
  },
  resolveMissionStatusFromGateState(gateState: ShipExteriorMissionGateState): MissionStatus {
    const totalSteps = gateState.steps.length;
    if (totalSteps > 0 && gateState.steps.every((step) => step.status === 'completed')) {
      return 'completed';
    }

    return 'active';
  },
};

export function createFirstTargetMissionInitialGateState(characterId: string): ShipExteriorMissionGateState {
  const nowIso = new Date().toISOString();
  return {
    missionId: FIRST_TARGET_MISSION_ID,
    characterId,
    activeObjectiveText: FIRST_TARGET_GATE_STEPS[0]?.objectiveText ?? 'Mission objective pending.',
    updatedAt: nowIso,
    steps: FIRST_TARGET_GATE_STEPS.map((step, index) => ({
      key: step.key,
      status: index === 0 ? 'active' : 'locked',
    })),
  };
}

export { DEFAULT_CLUSTER_SPREAD_KM };

/**
 * Initialize first-target mission context for ship-exterior-view entry points.
 *
 * First-target is a scripted cold-boot onboarding mission that:
 * - Always applies the 'cold-boot-starter-damaged' damage preset
 * - Uses 'auto' seed policy (infers 'new' vs 'resume' from status hint)
 */
const FIRST_TARGET_INITIALIZATION_STRATEGY: MissionInitializationStrategy = {
  getMissionId: () => FIRST_TARGET_MISSION_ID,
  buildMissionContext: (params) => ({
    missionId: FIRST_TARGET_MISSION_ID,
    seedPolicy: 'auto',
    shipDamagePreset: 'cold-boot-starter-damaged',
    ...(params.missionStatus ? { missionStatusHint: params.missionStatus } : {}),
  }),
  resolveDamagePreset: () => 'cold-boot-starter-damaged',
};

// Register the strategy at module load time
registerMissionInitializationStrategy(FIRST_TARGET_MISSION_ID, FIRST_TARGET_INITIALIZATION_STRATEGY);
