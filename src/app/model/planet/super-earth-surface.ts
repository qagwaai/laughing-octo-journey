import { fbm3, lerp, ridged3 } from './planet-noise';
import type { PlanetClimate } from './planet-seed';
import { smoothstep, type Rgb } from './planet-surface';

/**
 * Super-earths: massive rocky worlds with heavier relief than Earth, dark basalt
 * plains, no open oceans and no cloud deck, and frost capping the poles.
 * Mirrored on the GPU by super-earth-shader.ts; parity is covered by tests.
 */
export const SUPER_EARTH_GENERATOR_VERSION = 'super-earth-v1';

const POLAR_FROST_START = 0.7;
const POLAR_FROST_END = 0.86;

export function superEarthElevation(x: number, y: number, z: number, climate: PlanetClimate): number {
  const seed = climate.seed;
  const plates = fbm3(x * 2.2, y * 2.2, z * 2.2, seed, 5);
  const uplands = smoothstep(0.42, 0.66, plates);
  const ranges = ridged3(x * 7, y * 7, z * 7, seed ^ 0x27d4eb2f, 5);
  const scarps = ridged3(x * 18, y * 18, z * 18, seed ^ 0x1f83d9ab, 3);
  const grit = fbm3(x * 48, y * 48, z * 48, seed ^ 0x71a3b925, 2);
  return 0.28 + uplands * 0.22 + ranges * (0.1 + uplands * 0.2) + scarps * 0.05 + (grit - 0.5) * 0.02;
}

export function superEarthAlbedo(elevation: number, sinLatitude: number): Rgb {
  const uplands = smoothstep(0.42, 0.66, elevation);
  const peaks = smoothstep(0.68, 0.84, elevation);
  const frost = smoothstep(POLAR_FROST_START, POLAR_FROST_END, Math.abs(sinLatitude));
  const r = lerp(lerp(lerp(0.13, 0.42, uplands), 0.56, peaks), 0.86, frost);
  const g = lerp(lerp(lerp(0.12, 0.35, uplands), 0.53, peaks), 0.88, frost);
  const b = lerp(lerp(lerp(0.115, 0.29, uplands), 0.49, peaks), 0.9, frost);
  return [r, g, b];
}

export function superEarthMaterial(elevation: number, sinLatitude: number): Rgb {
  const uplands = smoothstep(0.42, 0.66, elevation);
  const frost = smoothstep(POLAR_FROST_START, POLAR_FROST_END, Math.abs(sinLatitude));
  return [1, lerp(lerp(0.8, 0.95, uplands), 0.62, frost), 0];
}
