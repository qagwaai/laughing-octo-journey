import { describe, expect, it } from 'vitest';
import { deriveGasGiantProfile } from '../../model/planet/gas-giant-profile';
import {
  GAS_GIANT_MATERIAL_CACHE_KEY,
  gasGiantMaterialCacheKey,
  resolveGasGiantVariantShading,
  thermalGlowColor,
  thermalGlowStrength,
} from './gas-giant-material';

describe('gas-giant variant shading', () => {
  it('leaves classic giants untouched', () => {
    const shading = resolveGasGiantVariantShading({ variant: 'classic', meanTemperatureK: 2000 });
    expect(shading.defines).toEqual([]);
    expect(gasGiantMaterialCacheKey(shading)).toBe(GAS_GIANT_MATERIAL_CACHE_KEY);
  });

  it('hazes sub-Neptunes more strongly than hot Neptunes, which also glow on the day side', () => {
    const sub = resolveGasGiantVariantShading({ variant: 'sub-neptune', meanTemperatureK: 400 });
    const hot = resolveGasGiantVariantShading({ variant: 'hot-neptune', meanTemperatureK: 1200 });
    expect(sub.defines).toEqual(['GG_VARIANT_HAZE']);
    expect(sub.glowStrength).toBe(0);
    expect(hot.defines).toEqual(['GG_VARIANT_HAZE', 'GG_VARIANT_DAYGLOW']);
    expect(sub.hazeStrength).toBeGreaterThan(hot.hazeStrength);
    expect(hot.glowStrength).toBeGreaterThan(0);
  });

  it('scales hot-Jupiter night glow with temperature and assumes 1500 K when unknown', () => {
    const cool = resolveGasGiantVariantShading({ variant: 'hot-jupiter', meanTemperatureK: 1000 });
    const hot = resolveGasGiantVariantShading({ variant: 'hot-jupiter', meanTemperatureK: 2500 });
    const unknown = resolveGasGiantVariantShading({ variant: 'hot-jupiter', meanTemperatureK: null });
    expect(hot.defines).toEqual(['GG_VARIANT_NIGHTGLOW']);
    expect(cool.glowStrength).toBeCloseTo(0.15, 6);
    expect(hot.glowStrength).toBeCloseTo(0.6, 6);
    expect(unknown.glowStrength).toBeCloseTo(thermalGlowStrength(1500), 6);
  });

  it('only lights super-Jupiters that are at least 1000 K', () => {
    expect(resolveGasGiantVariantShading({ variant: 'super-jupiter', meanTemperatureK: null }).defines).toEqual([]);
    expect(resolveGasGiantVariantShading({ variant: 'super-jupiter', meanTemperatureK: 600 }).defines).toEqual([]);
    expect(resolveGasGiantVariantShading({ variant: 'super-jupiter', meanTemperatureK: 1400 }).defines).toEqual([
      'GG_VARIANT_UNIFORMGLOW',
    ]);
  });

  it('shifts the glow from deep red toward orange-white as temperature rises', () => {
    expect(thermalGlowColor(900)).toEqual([0.6, 0.1, 0.02]);
    const mid = thermalGlowColor(2000);
    expect(mid[0]).toBeCloseTo(1, 6);
    expect(mid[1]).toBeCloseTo(0.35, 6);
    const white = thermalGlowColor(3500);
    expect(white).toEqual([1, 0.6, 0.3]);
  });

  it('gives each variant program its own cache key', () => {
    const keys = new Set(
      (['sub-neptune', 'hot-neptune', 'hot-jupiter'] as const).map((variant) =>
        gasGiantMaterialCacheKey(
          resolveGasGiantVariantShading(deriveGasGiantProfile(`exo-${variant}`, { surfaceArchetype: variant })),
        ),
      ),
    );
    expect(keys.size).toBe(3);
    expect(keys.has(GAS_GIANT_MATERIAL_CACHE_KEY)).toBe(false);
  });
});