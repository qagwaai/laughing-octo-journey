import { describe, expect, it } from 'vitest';
import {
  GAS_GIANT_MAX_OVALS,
  GAS_GIANT_PALETTES,
  deriveGasGiantProfile,
  findBandIndex,
  latitudeToV,
  sampleBandFlow,
  vToLatitude,
} from './gas-giant-profile';

const IDS = Array.from({ length: 40 }, (_, index) => `giant-test-${index}`);

describe('deriveGasGiantProfile', () => {
  it('is deterministic per body id', () => {
    expect(deriveGasGiantProfile('jupiter')).toEqual(deriveGasGiantProfile('jupiter'));
    expect(deriveGasGiantProfile('jupiter').seed).not.toBe(deriveGasGiantProfile('saturn').seed);
  });

  it('separates canonical gas and ice giant appearance seeds', () => {
    const gas = deriveGasGiantProfile('same-body', { surfaceArchetype: 'gas-giant' });
    const ice = deriveGasGiantProfile('same-body', { surfaceArchetype: 'ice-giant', palette: 'ice' });
    expect(gas.seed).not.toBe(ice.seed);
    expect(ice.palette).toBe('ice');
  });

  it('tiles bands contiguously from pole to pole with an equatorial zone', () => {
    for (const id of IDS) {
      const { bands } = deriveGasGiantProfile(id);
      expect(bands[0].start).toBeCloseTo(-Math.PI / 2, 5);
      expect(bands[bands.length - 1].end).toBeCloseTo(Math.PI / 2, 5);
      for (let index = 1; index < bands.length; index++) {
        expect(bands[index].start).toBe(bands[index - 1].end);
        expect(bands[index].end).toBeGreaterThan(bands[index].start);
      }
      expect(bands[findBandIndex(bands, 0)].kind).toBe('zone');
      for (const band of bands) {
        expect(band.flow).toBeGreaterThanOrEqual(-1);
        expect(band.flow).toBeLessThanOrEqual(1);
        for (const channel of band.color) {
          expect(channel).toBeGreaterThanOrEqual(0);
          expect(channel).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('keeps storms on the sphere and within shader limits', () => {
    for (const id of IDS) {
      const profile = deriveGasGiantProfile(id);
      expect(profile.ovals.length).toBeLessThanOrEqual(GAS_GIANT_MAX_OVALS);
      for (const vortex of [...profile.ovals, ...(profile.anticyclone ? [profile.anticyclone] : [])]) {
        expect(vortex.u).toBeGreaterThanOrEqual(0);
        expect(vortex.u).toBeLessThan(1);
        expect(vortex.v).toBeGreaterThan(0);
        expect(vortex.v).toBeLessThan(1);
      }
    }
  });

  it('produces every palette and both ringed and ringless giants across seeds', () => {
    const profiles = IDS.map((id) => deriveGasGiantProfile(id));
    expect(new Set(profiles.map((profile) => profile.palette))).toEqual(new Set(GAS_GIANT_PALETTES));
    expect(profiles.some((profile) => profile.rings)).toBe(true);
    expect(profiles.some((profile) => !profile.rings)).toBe(true);
  });

  it('applies overrides without reshuffling unrelated features', () => {
    const base = deriveGasGiantProfile('override-test');
    const ringed = deriveGasGiantProfile('override-test', { rings: true });
    const bare = deriveGasGiantProfile('override-test', { rings: false });
    expect(ringed.rings).not.toBeNull();
    expect(bare.rings).toBeNull();
    expect(ringed.bands).toEqual(base.bands);
    expect(bare.anticyclone).toEqual(base.anticyclone);

    for (const palette of GAS_GIANT_PALETTES) {
      expect(deriveGasGiantProfile('override-test', { palette }).palette).toBe(palette);
    }
  });

  it('builds rings outside the planet with gaps inside the ring span', () => {
    for (const id of IDS) {
      const { rings } = deriveGasGiantProfile(id, { rings: true });
      expect(rings).not.toBeNull();
      expect(rings!.innerRadius).toBeGreaterThan(1.1);
      expect(rings!.outerRadius).toBeGreaterThan(rings!.innerRadius);
      for (const gap of rings!.gaps) {
        expect(gap.center).toBeGreaterThan(0);
        expect(gap.center).toBeLessThan(1);
      }
    }
  });
});

describe('band helpers', () => {
  it('converts between latitude and v', () => {
    expect(latitudeToV(-Math.PI / 2)).toBeCloseTo(0);
    expect(latitudeToV(Math.PI / 2)).toBeCloseTo(1);
    expect(vToLatitude(latitudeToV(0.4))).toBeCloseTo(0.4);
  });

  it('clamps band lookup at the poles', () => {
    const { bands } = deriveGasGiantProfile('lookup-test');
    expect(findBandIndex(bands, -Math.PI)).toBe(0);
    expect(findBandIndex(bands, Math.PI)).toBe(bands.length - 1);
  });

  it('smooths flow across band edges', () => {
    const { bands } = deriveGasGiantProfile('flow-test');
    for (let index = 1; index < bands.length; index++) {
      const edge = bands[index].start;
      const below = sampleBandFlow(bands, edge - 1e-4);
      const above = sampleBandFlow(bands, edge + 1e-4);
      expect(Math.abs(above - below)).toBeLessThan(0.02);
    }
  });
});
