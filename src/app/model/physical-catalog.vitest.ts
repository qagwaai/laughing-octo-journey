import { describe, expect, it } from 'vitest';
import { resolveCatalogDiameterM, resolveCatalogMassKg, resolveCatalogRadiusKm } from './physical-catalog';

describe('physical catalog selection', () => {
  it('resolves display diameters in metres using catalog radius precedence before diameter estimates', () => {
    const catalog = { meanRadiusKm: 10, equatorialRadiusKm: 12, radiusKm: 14, estimatedDiameterM: 32_000 };
    const physical = { estimatedDiameterM: 40_000 };
    expect(resolveCatalogDiameterM(catalog, physical)).toBe(20_000);
    expect(resolveCatalogDiameterM({ ...catalog, meanRadiusKm: 0 }, physical)).toBe(24_000);
    expect(resolveCatalogDiameterM({ radiusKm: 14, estimatedDiameterM: 32_000 }, physical)).toBe(28_000);
    expect(resolveCatalogDiameterM({ estimatedDiameterM: 32_000 }, physical)).toBe(32_000);
    expect(resolveCatalogDiameterM(null, physical)).toBe(40_000);
    expect(catalog.meanRadiusKm).toBe(10);
    expect(physical.estimatedDiameterM).toBe(40_000);
  });

  it('skips invalid sizes and leaves missing or unrepresentable diameters unknown', () => {
    expect(resolveCatalogDiameterM({
      meanRadiusKm: Number.NaN,
      equatorialRadiusKm: Number.POSITIVE_INFINITY,
      radiusKm: -1,
      estimatedDiameterM: 0,
    }, { estimatedDiameterM: 4_000 })).toBe(4_000);
    expect(resolveCatalogDiameterM(undefined)).toBeNull();
    expect(resolveCatalogDiameterM({ radiusKm: 0 }, { estimatedDiameterM: 0 })).toBeNull();
    expect(resolveCatalogDiameterM({ meanRadiusKm: Number.MAX_VALUE })).toBeNull();
  });

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
