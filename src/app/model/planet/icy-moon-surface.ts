import { fbm3, lerp, lowbias32, ridged3 } from './planet-noise';
import type { PlanetClimate } from './planet-seed';
import { smoothstep, type Rgb } from './planet-surface';

export const ICY_MOON_GENERATOR_VERSION = 'icy-moon-v1';
export const ICY_MOON_CRATER_COUNT = 24;

/** Spherical coordinates keep fractures and impact basins continuous across the UV seam. */
export function icyMoonElevation(x: number, y: number, z: number, climate: PlanetClimate): number {
  const seed = climate.seed;
  const frost = fbm3(x * 3, y * 3, z * 3, seed, 3);
  const warp = (frost - 0.5) * 1.4;
  const plates = fbm3(x * 5 + warp, y * 5 - warp, z * 5, seed ^ 0x71a3b925, 3);
  const cracks = 1 - smoothstep(0.008, 0.035, Math.abs(plates - 0.5));
  const branches = fbm3(x * 11, y * 11, z * 11 + warp, seed ^ 0x35f91a7d, 2);
  const fineCracks = (1 - smoothstep(0.004, 0.018, Math.abs(branches - 0.5))) * cracks;
  const mountains = ridged3(x * 9, y * 9, z * 9, seed ^ 0x27d4eb2f, 3);
  const mountainMask = smoothstep(0.48, 0.7, frost);
  let elevation = 0.52 + (frost - 0.5) * 0.07 + mountains * mountainMask * 0.09;
  elevation -= cracks * 0.075 + fineCracks * 0.025;

  for (let index = 0; index < ICY_MOON_CRATER_COUNT; index += 1) {
    const hash = lowbias32((seed + Math.imul(index + 1, 0x9e3779b1)) >>> 0);
    const cy = ((hash >>> 16) / 65536) * 2 - 1;
    const angle = ((lowbias32(hash) >>> 16) / 65536) * Math.PI * 2;
    const radial = Math.sqrt(1 - cy * cy);
    const dot = x * radial * Math.cos(angle) + y * cy + z * radial * Math.sin(angle);
    const radius = 0.055 + ((lowbias32(hash ^ 0x68bc21eb) >>> 16) / 65536) * 0.13;
    const distance = Math.sqrt(Math.max(0, 2 - 2 * dot)) / radius;
    const bowl = (1 - smoothstep(0, 0.86, distance)) * 0.065;
    const rim = (1 - smoothstep(0.06, 0.24, Math.abs(distance - 1))) * 0.035;
    elevation += rim - bowl;
  }
  return elevation;
}

export function icyMoonAlbedo(elevation: number): Rgb {
  const frozen = smoothstep(0.42, 0.515, elevation);
  const snow = smoothstep(0.515, 0.59, elevation);
  return [
    lerp(lerp(0.29, 0.72, frozen), 0.94, snow),
    lerp(lerp(0.25, 0.83, frozen), 0.96, snow),
    lerp(lerp(0.23, 0.9, frozen), 0.98, snow),
  ];
}

export function icyMoonMaterial(elevation: number): Rgb {
  return [1, lerp(0.48, 0.88, smoothstep(0.44, 0.57, elevation)), 0];
}
