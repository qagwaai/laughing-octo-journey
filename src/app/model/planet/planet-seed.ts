/**
 * Deterministic seeding for procedural planet surfaces.
 *
 * Nova derives planet appearance locally for now. `ViewerBody.planetType` and
 * `ViewerBodyVisualization.textureKey` stay inert until the Forge contract is
 * negotiated from proven visuals; see docs/procedural-planets-2026-09-28.md.
 */
import { calibrateContinents } from './planet-surface';

export const PLANET_GENERATOR_VERSION = 'terran-v1';

/**
 * Deriving a climate now samples the continent field to calibrate sea level,
 * so results are memoised. The derivation is pure, which makes this safe.
 */
const climateCache = new Map<string, PlanetClimate>();

export type PlanetArchetype = 'terran';

export interface PlanetClimate {
  archetype: PlanetArchetype;
  /** 32-bit seed handed to the noise hash, shared by the CPU and GPU paths. */
  seed: number;
  /** Requested ocean coverage as a fraction of surface area. */
  waterFraction: number;
  iceLatitudeDeg: number;
  continentFrequency: number;
  warpStrength: number;
  mountainAmplitude: number;
  aridity: number;
  hueBias: number;
  /** Field value with `waterFraction` of the surface area below it. */
  seaLevel: number;
  /** Field distance from the deepest point up to sea level. */
  oceanSpan: number;
  /** Field distance from sea level up to the highest expected peak. */
  landSpan: number;
}

export function fnv1a32(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return hash >>> 0;
}

export function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

/** Rounded so the CPU reference and the float32 GPU uniforms consume equal inputs. */
function quantize(value: number): number {
  return Number(value.toFixed(6));
}

export function derivePlanetClimate(bodyId: string, archetype: PlanetArchetype = 'terran'): PlanetClimate {
  const cacheKey = `${archetype}|${bodyId}`;
  const cached = climateCache.get(cacheKey);
  if (cached) return cached;

  const seed = fnv1a32(`${PLANET_GENERATOR_VERSION}|${archetype}|${bodyId}`);
  const random = createSeededRng(seed);

  const base = {
    archetype,
    seed,
    waterFraction: quantize(lerp(0.45, 0.75, random())),
    iceLatitudeDeg: quantize(lerp(55, 80, random())),
    continentFrequency: quantize(lerp(1.4, 2.6, random())),
    warpStrength: quantize(lerp(0.15, 0.45, random())),
    mountainAmplitude: quantize(lerp(0.18, 0.38, random())),
    aridity: quantize(lerp(0.15, 0.7, random())),
    hueBias: quantize(lerp(-0.06, 0.06, random())),
  };

  const climate: PlanetClimate = {
    ...base,
    ...calibrateContinents(base, base.waterFraction, base.mountainAmplitude),
  };

  climateCache.set(cacheKey, climate);
  return climate;
}
