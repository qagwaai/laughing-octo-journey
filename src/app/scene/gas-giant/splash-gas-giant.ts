import { Color, Vector3 } from 'three';
import type { GasGiantSurfaceArchetype } from '../../model/planet/gas-giant-profile';
import type { SplashQuality } from '../splash-state';
import { deriveBodyGasGiantProfile } from './body-giant-profile';
import { createGasGiant, type GasGiantHandle } from './gas-giant';
import { toProfileOverrides, type GasGiantPaletteChoice, type GasGiantRingChoice } from './gas-giant-settings';

/** Splash sphere radius, matching the terran splash planet. */
export const SPLASH_GAS_GIANT_RADIUS = 4;
/** The splash key light sits at (3, 4, 4) in world space. */
export const SPLASH_GAS_GIANT_LIGHT_DIRECTION = new Vector3(3, 4, 4).normalize();
/** Rings use their own light model, so they need a boost to sit alongside the multi-light planet. */
const SPLASH_RING_LIGHT = new Color('#fff2e0').multiplyScalar(2.2);

export interface SplashGasGiantOptions {
  bodyId: string;
  surfaceArchetype?: GasGiantSurfaceArchetype;
  quality: SplashQuality;
  palette: GasGiantPaletteChoice;
  rings: GasGiantRingChoice;
  stormActivity: number;
}

export function createSplashGasGiant(options: SplashGasGiantOptions): GasGiantHandle {
  const profile = deriveBodyGasGiantProfile(
    { id: options.bodyId, surfaceArchetype: options.surfaceArchetype ?? 'gas-giant' },
    toProfileOverrides(options.palette, options.rings),
  );
  const standard = options.quality === 'standard';
  const giant = createGasGiant(profile, {
    radius:
      profile.canonical === 'saturn'
        ? SPLASH_GAS_GIANT_RADIUS / (profile.rings?.outerRadius ?? 1)
        : SPLASH_GAS_GIANT_RADIUS,
    textureSize: standard ? { width: 1024, height: 512 } : { width: 512, height: 256 },
    widthSegments: standard ? 96 : 64,
    heightSegments: standard ? 64 : 40,
  });
  giant.setLightDirection(SPLASH_GAS_GIANT_LIGHT_DIRECTION);
  giant.setLightColor(SPLASH_RING_LIGHT);
  giant.setStormActivity(options.stormActivity);
  return giant;
}

/** Swaps a giant in place, keeping its splash placement, and disposes the old one. */
export function replaceSplashGasGiant(previous: GasGiantHandle, next: GasGiantHandle): GasGiantHandle {
  const parent = previous.group.parent;
  next.group.position.copy(previous.group.position);
  next.group.rotation.copy(previous.group.rotation);
  next.group.scale.copy(previous.group.scale);
  next.planet.rotation.y = previous.planet.rotation.y;
  parent?.add(next.group);
  previous.group.removeFromParent();
  previous.dispose();
  return next;
}
