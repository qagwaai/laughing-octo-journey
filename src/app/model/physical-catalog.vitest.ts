import { describe, expect, it } from 'vitest';
import { resolveCatalogMassKg, resolveCatalogRadiusKm } from './physical-catalog';

describe('physical catalog selection', () => {
  it('selects the first positive scalar radius in the documented order and converts units', () => {
    expect(resolveCatalogRadiusKm({
      meanRadiusKm: 10,
      equatorialRadiusKm: 12,
      radiusKm: 14,
      estimatedDiameterM: 32_000,
    })).toBe(10);
    expect(resolveCatalogRadiusKm({ meanRadiusKm: 0, equatorialRadiusKm: 12 })).toBe(12);
    expect(resolveCatalogRadiusKm({ estimatedDiameterM: 32_000 })).toBe(16);
    expect(resolveCatalogRadiusKm(null, { estimatedDiameterM: 4_000 })).toBe(2);
    expect(resolveCatalogRadiusKm({ radiusKm: 0 }, { estimatedDiameterM: 0 })).toBeNull();
  });

  it('selects catalog mass before gameplay estimates without merging provenance', () => {
    expect(resolveCatalogMassKg({ massKg: 4, estimatedMassKg: 5 }, { estimatedMassKg: 6 })).toBe(4);
    expect(resolveCatalogMassKg({ massKg: 0, estimatedMassKg: 5 }, { estimatedMassKg: 6 })).toBe(5);
    expect(resolveCatalogMassKg(null, { estimatedMassKg: 6 })).toBe(6);
  });
});
