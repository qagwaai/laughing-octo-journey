import { fbm3, ridged3 } from './planet-noise';
import type { PlanetClimate } from './planet-seed';
import { smoothstep, type Rgb } from './planet-surface';

export const LAVA_GENERATOR_VERSION = 'lava-v1';

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function crackMask(x: number, y: number, z: number, seed: number): number {
  const veins = ridged3(x * 12, y * 12, z * 12, seed ^ 0x6a09e667, 4);
  return smoothstep(0.78, 0.94, veins);
}

export function lavaElevation(x: number, y: number, z: number, climate: PlanetClimate): number {
  const plates = fbm3(x * 2.6, y * 2.6, z * 2.6, climate.seed, 5);
  const ridges = ridged3(x * 5, y * 5, z * 5, climate.seed ^ 0xbb67ae85, 4);
  const cracks = crackMask(x, y, z, climate.seed);
  const grain = fbm3(x * 28, y * 28, z * 28, climate.seed ^ 0x3c6ef372, 2);
  return 0.24 + plates * 0.18 + ridges * 0.04 - cracks * 0.15 + (grain - 0.5) * 0.006;
}

export function lavaAlbedo(
  elevation: number,
  _sinLatitude: number,
  climate: PlanetClimate,
  direction: readonly [number, number, number],
): Rgb {
  const cracks = crackMask(...direction, climate.seed);
  const basalt = 0.018 + smoothstep(0.28, 0.5, elevation) * 0.045;
  const magma: Rgb = [0.96, 0.17, 0.018];
  const crust: Rgb = [basalt, basalt * 0.92, basalt * 0.9];
  const intensity = cracks * 0.9;
  return [
    lerp(crust[0], magma[0], intensity),
    lerp(crust[1], magma[1], intensity),
    lerp(crust[2], magma[2], intensity),
  ];
}

export function lavaMaterial(
  _elevation: number,
  _sinLatitude: number,
  climate: PlanetClimate,
  direction: readonly [number, number, number],
): Rgb {
  const cracks = crackMask(...direction, climate.seed);
  return [1, lerp(0.94, 0.32, cracks), 0];
}

export function lavaEmissive(
  _elevation: number,
  _sinLatitude: number,
  climate: PlanetClimate,
  direction: readonly [number, number, number],
): Rgb {
  const cracks = crackMask(...direction, climate.seed);
  return [cracks, cracks * 0.2, cracks * 0.025];
}
