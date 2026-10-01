/**
 * Splash planet configuration.
 *
 * The mining splash used to hot-link a third-party Earth photograph. It now
 * bakes its planet from the procedural generator, so the splash ships with no
 * third-party texture request and no committed image asset.
 */
import type { WebGLRenderer } from 'three';
import type { PlanetLodPreset } from '../../model/planet/planet-texture';
import type { MiningQuality } from '../mining-splash-state';
import { bakePlanetTextures, type PlanetBakeResult, supportsGpuBake } from './planet-bake';

import { SPLASH_PLANET_BODY_ID } from './splash-planet-rotation';

/** Mirrors the sizes the splash already chose for the downsized photograph. */
export const SPLASH_PLANET_PRESETS: Readonly<Record<MiningQuality, PlanetLodPreset>> = {
  standard: { width: 2048, height: 1024, includeNormal: true, includeMaterial: true, normalScale: 0.5 },
  low: { width: 1024, height: 512, includeNormal: false, includeMaterial: true, normalScale: 0.5 },
};

/**
 * The CPU reference needs seconds at splash resolutions and would block the main
 * thread, so a renderer-less bake drops to the cheap system-view size instead.
 */
export const SPLASH_PLANET_CPU_PRESET: PlanetLodPreset = {
  width: 256,
  height: 128,
  includeNormal: false,
  includeMaterial: false,
  normalScale: 1,
};

export function selectSplashPlanetPreset(quality: MiningQuality, renderer?: WebGLRenderer | null): PlanetLodPreset {
  return supportsGpuBake(renderer) ? SPLASH_PLANET_PRESETS[quality] : SPLASH_PLANET_CPU_PRESET;
}

export function bakeSplashPlanet(
  quality: MiningQuality,
  renderer?: WebGLRenderer | null,
  bodyId: string = SPLASH_PLANET_BODY_ID,
): PlanetBakeResult {
  return bakePlanetTextures({
    bodyId,
    preset: selectSplashPlanetPreset(quality, renderer),
    renderer,
  });
}
