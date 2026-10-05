import { GAS_GIANT_GENERATOR_VERSION } from './planet/gas-giant-profile';
import { PLANET_GENERATOR_VERSION } from './planet/planet-seed';
import { STAR_GENERATOR_VERSION } from './star/star-profile';
import type { CanonicalBodyType, SurfaceArchetype } from './celestial-classification';
import { isCompatibleBodyClassification } from './celestial-classification';

export type AppearanceRenderer = 'terran' | 'gas-giant' | 'star' | 'asteroid';
export const ASTEROID_GENERATOR_VERSION = 'asteroid-v2';

export interface CelestialAppearanceInput {
  source: 'canonical' | 'demo';
  bodyId: string;
  bodyType: CanonicalBodyType;
  surfaceArchetype: SurfaceArchetype;
  generatorVersion: string;
  renderer: AppearanceRenderer;
  gasGiantPalette?: 'jovian' | 'ice';
  fallbackReason?: string;
}

export type CelestialAppearanceResolution =
  | { valid: true; input: CelestialAppearanceInput }
  | { valid: false; reason: string };

const GENERATOR_VERSIONS: Readonly<Record<AppearanceRenderer, string>> = {
  terran: PLANET_GENERATOR_VERSION,
  'gas-giant': GAS_GIANT_GENERATOR_VERSION,
  star: STAR_GENERATOR_VERSION,
  asteroid: ASTEROID_GENERATOR_VERSION,
};

export function resolveCelestialAppearance(
  input: { source: 'canonical' | 'demo'; bodyId: string; bodyType: unknown; surfaceArchetype: unknown },
): CelestialAppearanceResolution {
  if (!input.bodyId.trim()) {
    return { valid: false, reason: 'canonical body ID is missing' };
  }
  if (!isCompatibleBodyClassification(input.bodyType, input.surfaceArchetype)) {
    return {
      valid: false,
      reason: `invalid bodyType/surfaceArchetype pair: ${String(input.bodyType)}/${String(input.surfaceArchetype)}`,
    };
  }

  const bodyType = input.bodyType;
  const surfaceArchetype = input.surfaceArchetype;
  if (typeof bodyType !== 'string' || typeof surfaceArchetype !== 'string') {
    return { valid: false, reason: 'bodyType and surfaceArchetype must be strings' };
  }
  const classified = {
    source: input.source,
    bodyId: input.bodyId,
    bodyType: bodyType as CanonicalBodyType,
    surfaceArchetype: surfaceArchetype as SurfaceArchetype,
  };
  if (surfaceArchetype === 'star') {
    return {
      valid: true,
      input: { ...classified, generatorVersion: GENERATOR_VERSIONS.star, renderer: 'star' },
    };
  }
  if (surfaceArchetype === 'asteroid') {
    return {
      valid: true,
      input: { ...classified, generatorVersion: GENERATOR_VERSIONS.asteroid, renderer: 'asteroid' },
    };
  }
  if (surfaceArchetype === 'gas-giant' || surfaceArchetype === 'ice-giant') {
    return {
      valid: true,
      input: {
        ...classified,
        generatorVersion: GENERATOR_VERSIONS['gas-giant'],
        renderer: 'gas-giant',
        gasGiantPalette: surfaceArchetype === 'ice-giant' ? 'ice' : 'jovian',
      },
    };
  }
  if (surfaceArchetype === 'rocky') {
    return {
      valid: true,
      input: { ...classified, generatorVersion: GENERATOR_VERSIONS.terran, renderer: 'terran' },
    };
  }

  return {
    valid: true,
    input: {
      ...classified,
      generatorVersion: GENERATOR_VERSIONS.terran,
      renderer: 'terran',
      fallbackReason: `No dedicated ${surfaceArchetype} renderer is implemented; using terran surface renderer.`,
    },
  };
}

export function celestialAppearanceKey(
  bodyId: string,
  surfaceArchetype: SurfaceArchetype,
  generatorVersion: string,
): string {
  return `${generatorVersion}|${surfaceArchetype}|${bodyId}`;
}
