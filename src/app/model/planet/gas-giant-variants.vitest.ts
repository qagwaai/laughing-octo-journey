import { describe, expect, it } from 'vitest';
import { GAS_GIANT_TYPE_VARIANTS, deriveGasGiantProfile } from './gas-giant-profile';

const IDS = Array.from({ length: 30 }, (_, index) => `exo-variant-${index}`);

describe('deriveGasGiantProfile type variants', () => {
  it.each(GAS_GIANT_TYPE_VARIANTS)('locks %s to its own palette and variant', (variant) => {
    for (const id of IDS.slice(0, 5)) {
      const profile = deriveGasGiantProfile(id, { surfaceArchetype: variant, palette: 'jovian' });
      expect(profile.variant).toBe(variant);
      expect(profile.palette).toBe(variant);
    }
    expect(deriveGasGiantProfile('exo-a', { surfaceArchetype: variant }).seed).not.toBe(
      deriveGasGiantProfile('exo-a', { surfaceArchetype: 'gas-giant' }).seed,
    );
  });

  it('keeps classic giants on the classic variant', () => {
    expect(deriveGasGiantProfile('classic-1').variant).toBe('classic');
    expect(deriveGasGiantProfile('classic-1', { surfaceArchetype: 'ice-giant' }).variant).toBe('classic');
  });

  it.each(['hot-neptune', 'hot-jupiter'] as const)('never gives %s rings, even when asked', (variant) => {
    const ringGeometry = { innerRadius: 1.3, outerRadius: 2.5, color: [0.8, 0.7, 0.6] as const, opacity: 0.6 };
    for (const id of IDS) {
      expect(deriveGasGiantProfile(id, { surfaceArchetype: variant, rings: true, ringGeometry }).rings).toBeNull();
    }
  });

  it('applies server ring geometry and tilt verbatim', () => {
    const profile = deriveGasGiantProfile('exo-koi-351-g', {
      surfaceArchetype: 'super-jupiter',
      ringGeometry: { innerRadius: 1.4, outerRadius: 3.2, color: [0.75, 0.68, 0.55], opacity: 0.45 },
      axialTiltDeg: 26.7,
    });
    expect(profile.rings).toMatchObject({ innerRadius: 1.4, outerRadius: 3.2, color: [0.75, 0.68, 0.55], opacity: 0.45 });
    expect(profile.axialTilt).toBeCloseTo((26.7 * Math.PI) / 180, 6);
  });

  it('carries the equilibrium temperature and keys the cache on it', () => {
    const cool = deriveGasGiantProfile('exo-hot', { surfaceArchetype: 'hot-jupiter' });
    const hot = deriveGasGiantProfile('exo-hot', { surfaceArchetype: 'hot-jupiter', meanTemperatureK: 2200 });
    expect(cool.meanTemperatureK).toBeNull();
    expect(hot.meanTemperatureK).toBe(2200);
    expect(hot.bands).toEqual(cool.bands);
  });
});