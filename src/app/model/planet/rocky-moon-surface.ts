import { fbm3, lerp, lowbias32, ridged3 } from './planet-noise';
import type { PlanetClimate } from './planet-seed';
import { smoothstep, type Rgb } from './planet-surface';

export const ROCKY_MOON_GENERATOR_VERSION = 'rocky-moon-v1';
export const ROCKY_MOON_CRATER_COUNT = 48;

/** Broad, smooth lowlands contrast with ridged highlands and overlapping spherical impacts. */
export function rockyMoonElevation(x: number, y: number, z: number, climate: PlanetClimate): number {
  const seed = climate.seed;
  const regions = fbm3(x * 2.8, y * 2.8, z * 2.8, seed, 4);
  const highlands = smoothstep(0.38, 0.62, regions);
  const mountains = ridged3(x * 12, y * 12, z * 12, seed ^ 0x27d4eb2f, 4);
  const regolith = fbm3(x * 42, y * 42, z * 42, seed ^ 0x71a3b925, 2);
  let elevation = 0.34 + highlands * 0.19 + mountains * highlands * 0.15 + (regolith - 0.5) * 0.018;

  for (let index = 0; index < ROCKY_MOON_CRATER_COUNT; index += 1) {
    const hash = lowbias32((seed + Math.imul(index + 1, 0x9e3779b1)) >>> 0);
    // Avoid trig approximation shifting narrow crater rims between CPU and GPU.
    const cx = ((hash >>> 16) / 65536) * 2 - 1;
    const cy = ((lowbias32(hash) >>> 16) / 65536) * 2 - 1;
    const cz = ((lowbias32(hash ^ 0x51e3f9ad) >>> 16) / 65536) * 2 - 1;
    const length = Math.max(Math.hypot(cx, cy, cz), 0.000001);
    const dot = (x * cx + y * cy + z * cz) / length;
    const size = (lowbias32(hash ^ 0x68bc21eb) >>> 16) / 65536;
    const radius = index < 6 ? 0.2 + size * 0.18 : 0.035 + size * 0.105;
    const distance = Math.sqrt(Math.max(0, 2 - 2 * dot)) / radius;
    const bowl = (1 - smoothstep(0.12, 0.92, distance)) * 0.11;
    const rim = (1 - smoothstep(0.04, 0.22, Math.abs(distance - 1))) * 0.06;
    const peak = index < 6 ? (1 - smoothstep(0, 0.22, distance)) * 0.045 : 0;
    elevation += rim + peak - bowl;
  }
  return elevation;
}

export function rockyMoonAlbedo(elevation: number): Rgb {
  const highlands = smoothstep(0.34, 0.6, elevation);
  const rims = smoothstep(0.6, 0.72, elevation);
  return [
    lerp(lerp(0.22, 0.57, highlands), 0.7, rims),
    lerp(lerp(0.215, 0.55, highlands), 0.68, rims),
    lerp(lerp(0.21, 0.52, highlands), 0.65, rims),
  ];
}

export function rockyMoonMaterial(elevation: number): Rgb {
  return [1, lerp(0.88, 0.98, smoothstep(0.34, 0.65, elevation)), 0];
}
