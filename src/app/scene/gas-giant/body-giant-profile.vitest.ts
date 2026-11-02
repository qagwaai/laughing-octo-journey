import { describe, expect, it } from 'vitest';
import { deriveBodyGasGiantProfile, isGasGiantSurfaceArchetype, resolveBodyGasGiantOverrides } from './body-giant-profile';

const exo = {
  id: 'exo-koi-351-g',
  surfaceArchetype: 'super-jupiter',
  catalogSource: 'exoplanet-catalog',
  physicalCatalog: { meanRadiusKm: 50000, meanTemperatureK: 180, axialTiltDeg: 12 },
};

describe('body gas-giant overrides', () => {
  it('recognises every giant archetype', () => {
    for (const value of ['gas-giant', 'ice-giant', 'sub-neptune', 'hot-neptune', 'hot-jupiter', 'super-jupiter']) {
      expect(isGasGiantSurfaceArchetype(value)).toBe(true);
    }
    expect(isGasGiantSurfaceArchetype('super-earth')).toBe(false);
    expect(isGasGiantSurfaceArchetype(null)).toBe(false);
  });

  it('converts server rings from km to planet radii and uses the ring tilt', () => {
    const overrides = resolveBodyGasGiantOverrides({
      ...exo,
      rings: { innerRadiusKm: 70000, outerRadiusKm: 150000, tiltDeg: 26, colorHex: '#ff8000', opacity: 0.4, approximate: true },
    });
    expect(overrides).toMatchObject({
      surfaceArchetype: 'super-jupiter',
      rings: true,
      axialTiltDeg: 26,
      meanTemperatureK: 180,
      ringGeometry: { innerRadius: 1.4, outerRadius: 3, opacity: 0.4 },
    });
    expect(overrides.ringGeometry?.color).toEqual([1, 128 / 255, 0]);
    const profile = deriveBodyGasGiantProfile({ ...exo, rings: { innerRadiusKm: 70000, outerRadiusKm: 150000, tiltDeg: 26, colorHex: '#ff8000', opacity: 0.4, approximate: true } });
    expect(profile.rings).toMatchObject({ innerRadius: 1.4, outerRadius: 3 });
  });

  it('gives ringless catalog exoplanets no rings and their catalog tilt', () => {
    expect(resolveBodyGasGiantOverrides(exo)).toMatchObject({ rings: false, axialTiltDeg: 12 });
    expect(deriveBodyGasGiantProfile(exo).rings).toBeNull();
  });

  it('keeps seeded rings and dev overrides for curated giants and forces the ice palette', () => {
    const overrides = resolveBodyGasGiantOverrides({ id: 'sol-neptune', surfaceArchetype: 'ice-giant' }, { rings: true });
    expect(overrides).toEqual({ rings: true, surfaceArchetype: 'ice-giant', palette: 'ice' });
    expect(resolveBodyGasGiantOverrides({ id: 'x', surfaceArchetype: 'rocky' }).surfaceArchetype).toBe('gas-giant');
  });

  it('ignores malformed ring data', () => {
    const overrides = resolveBodyGasGiantOverrides({
      ...exo,
      rings: { innerRadiusKm: 90000, outerRadiusKm: 80000, tiltDeg: 5, colorHex: 'red', opacity: 0.4, approximate: true },
    });
    expect(overrides.rings).toBe(false);
    expect(overrides.ringGeometry).toBeUndefined();
  });
});