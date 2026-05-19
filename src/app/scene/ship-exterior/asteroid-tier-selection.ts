import type { AsteroidScanSample } from '../../model/ship-exterior-asteroid-sample';

export type AsteroidRenderTier = 'hero' | 'near' | 'background';

export interface AsteroidTierCaps {
  heroMax: number;
  nearMax: number;
}

export interface AsteroidTierDistances {
  heroMaxDistance: number;
  nearMaxDistance: number;
}

export interface AsteroidTierContext {
  cameraPosition: [number, number, number];
  targetedAsteroidId: string | null;
  activeScanAsteroidId: string | null;
  scannedOnlyHero: boolean;
}

export const DEFAULT_ASTEROID_TIER_CAPS: AsteroidTierCaps = {
  heroMax: 3,
  nearMax: 8,
};

export const DEFAULT_ASTEROID_TIER_DISTANCES: AsteroidTierDistances = {
  heroMaxDistance: 6,
  nearMaxDistance: 14,
};

function distanceTo(camera: [number, number, number], position: [number, number, number]): number {
  const dx = camera[0] - position[0];
  const dy = camera[1] - position[1];
  const dz = camera[2] - position[2];
  return Math.hypot(dx, dy, dz);
}

export function assignAsteroidRenderTiers(
  samples: readonly AsteroidScanSample[],
  context: AsteroidTierContext,
  caps: AsteroidTierCaps = DEFAULT_ASTEROID_TIER_CAPS,
  distances: AsteroidTierDistances = DEFAULT_ASTEROID_TIER_DISTANCES,
): Map<string, AsteroidRenderTier> {
  const result = new Map<string, AsteroidRenderTier>();
  if (samples.length === 0) {
    return result;
  }

  const ranked = samples
    .map((sample) => ({ sample, distance: distanceTo(context.cameraPosition, sample.position) }))
    .sort((a, b) => a.distance - b.distance);

  const forcedHeroIds = new Set<string>();
  if (context.targetedAsteroidId) {
    forcedHeroIds.add(context.targetedAsteroidId);
  }
  if (context.activeScanAsteroidId) {
    forcedHeroIds.add(context.activeScanAsteroidId);
  }

  let heroAssigned = 0;
  let nearAssigned = 0;

  for (const id of forcedHeroIds) {
    const candidate = samples.find((sample) => sample.id === id);
    if (!candidate) {
      continue;
    }
    if (context.scannedOnlyHero && !candidate.scanned) {
      continue;
    }
    if (heroAssigned >= caps.heroMax) {
      break;
    }
    result.set(candidate.id, 'hero');
    heroAssigned += 1;
  }

  for (const { sample, distance } of ranked) {
    if (result.has(sample.id)) {
      continue;
    }

    const heroEligible =
      heroAssigned < caps.heroMax &&
      distance <= distances.heroMaxDistance &&
      (!context.scannedOnlyHero || sample.scanned);

    if (heroEligible) {
      result.set(sample.id, 'hero');
      heroAssigned += 1;
      continue;
    }

    const nearEligible = nearAssigned < caps.nearMax && distance <= distances.nearMaxDistance;
    if (nearEligible) {
      result.set(sample.id, 'near');
      nearAssigned += 1;
      continue;
    }

    result.set(sample.id, 'background');
  }

  return result;
}

export function resolveAsteroidTierDetailOverride(
  tier: AsteroidRenderTier,
  scanned: boolean,
): number | null {
  if (!scanned) {
    return null;
  }

  switch (tier) {
    case 'hero':
      return null;
    case 'near':
      return 1;
    case 'background':
      return 0;
    default:
      return null;
  }
}
