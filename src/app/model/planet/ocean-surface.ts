import { fbm3, ridged3 } from './planet-noise';
import type { PlanetClimate } from './planet-seed';
import { smoothstep, type Rgb } from './planet-surface';

export const OCEAN_GENERATOR_VERSION = 'ocean-v1';

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export function oceanAlbedo(
  elevation: number,
  _sinLatitude: number,
  climate: PlanetClimate,
  direction: readonly [number, number, number],
): Rgb {
  const [x, y, z] = direction;
  const shore = smoothstep(
    climate.seaLevel - climate.oceanSpan * 0.035,
    climate.seaLevel + climate.landSpan * 0.025,
    elevation,
  );
  const depth = smoothstep(climate.seaLevel - climate.oceanSpan * 0.72, climate.seaLevel, elevation);
  const waves = fbm3(x * 24, y * 24, z * 24, climate.seed ^ 0xa54ff53a, 4);
  const glints = smoothstep(0.76, 0.93, ridged3(x * 36, y * 36, z * 36, climate.seed ^ 0x510e527f, 3));
  const waterBrightness = 0.04 + waves * 0.08 + glints * 0.22;
  const deepWater: Rgb = [0.004, 0.025 + waterBrightness * 0.25, 0.12 + waterBrightness * 0.55];
  const brightWater: Rgb = [0.012, 0.13 + waterBrightness * 0.45, 0.32 + waterBrightness * 0.65];
  const water: Rgb = [
    lerp(deepWater[0], brightWater[0], depth),
    lerp(deepWater[1], brightWater[1], depth),
    lerp(deepWater[2], brightWater[2], depth),
  ];
  const islandHeight = smoothstep(climate.seaLevel, climate.seaLevel + climate.landSpan * 0.72, elevation);
  const island: Rgb = [
    lerp(0.12, 0.34, islandHeight),
    lerp(0.16, 0.3, islandHeight),
    lerp(0.17, 0.25, islandHeight),
  ];
  return [
    lerp(water[0], island[0], shore),
    lerp(water[1], island[1], shore),
    lerp(water[2], island[2], shore),
  ];
}

export function oceanMaterial(
  elevation: number,
  _sinLatitude: number,
  climate: PlanetClimate,
): Rgb {
  const shore = smoothstep(
    climate.seaLevel - climate.oceanSpan * 0.035,
    climate.seaLevel + climate.landSpan * 0.025,
    elevation,
  );
  return [1, lerp(0.18, 0.9, shore), lerp(0.025, 0, shore)];
}
