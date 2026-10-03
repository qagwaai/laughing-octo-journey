import { Color, PointLight } from 'three';
import { deriveStarProfile } from '../../model/star/star-profile';
import type { MiningQuality } from '../mining-splash-state';
import { linearStarColor } from './star-photosphere-material';
import { createStar, type StarHandle } from './star';

/** Splash sphere radius, matching the terran and gas-giant splash bodies. */
export const SPLASH_STAR_RADIUS = 4;
const SPLASH_STAR_LIGHT_INTENSITY = 2.4;

export interface SplashStarOptions {
  bodyId: string;
  spectralClass: string | null;
  quality: MiningQuality;
  flareActivity: number;
}

/**
 * Builds the splash star and a point light in its colour, so the splash
 * debris is lit by the star rather than only by the neutral key light.
 */
export function createSplashStar(options: SplashStarOptions): StarHandle {
  const profile = deriveStarProfile(options.bodyId, options.spectralClass);
  const standard = options.quality === 'standard';
  const star = createStar(profile, {
    radius: SPLASH_STAR_RADIUS,
    widthSegments: standard ? 96 : 48,
    heightSegments: standard ? 64 : 32,
    flareActivity: options.flareActivity,
  });
  // Tempered so a magenta T dwarf tints the debris without turning the scene neon.
  const color = linearStarColor(profile.color).lerp(new Color(1, 1, 1), 0.35);
  const light = new PointLight(color, SPLASH_STAR_LIGHT_INTENSITY * Math.min(profile.emission, 1.5), 0, 0);
  light.name = 'star-light';
  star.group.add(light);
  return star;
}

/** Swaps a star in place, keeping its splash placement, and disposes the old one. */
export function replaceSplashStar(previous: StarHandle, next: StarHandle): StarHandle {
  const parent = previous.group.parent;
  next.group.position.copy(previous.group.position);
  next.group.rotation.copy(previous.group.rotation);
  next.group.scale.copy(previous.group.scale);
  parent?.add(next.group);
  previous.group.removeFromParent();
  previous.dispose();
  return next;
}
