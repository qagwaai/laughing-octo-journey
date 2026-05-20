import type { AsteroidScanSample } from '../../model/ship-exterior-asteroid-sample';

export type AsteroidRenderTier = 'hero' | 'near' | 'background';

export interface AsteroidTierCaps {
  heroMax: number;
  nearMax: number;
}

export interface AsteroidTierCapMultiplier {
  capMultiplier?: number; // [0,1], scales near/background, never hero
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
  options?: AsteroidTierCapMultiplier,
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
  // Phase 3: dynamic cap scaling for frame-pressure
  let capMultiplier = 1;
  if (options && typeof options.capMultiplier === 'number') {
    capMultiplier = Math.max(0, Math.min(1, options.capMultiplier));
  }
  // Never reduce heroMax, only near/background
  const scaledNearMax = Math.max(0, Math.floor(caps.nearMax * capMultiplier));

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

    // Phase 3: degrade background first, then near, never hero
    const nearEligible = nearAssigned < scaledNearMax && distance <= distances.nearMaxDistance;
    if (nearEligible) {
      result.set(sample.id, 'near');
      nearAssigned += 1;
      continue;
    }

    // If capMultiplier < 1, background asteroids are the first to be degraded (not assigned to near/hero)
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
      return 1;
    default:
      return null;
  }
}
