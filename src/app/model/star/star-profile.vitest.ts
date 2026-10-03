import { describe, expect, it } from 'vitest';
import { STELLAR_CLASS_LETTERS } from './spectral-class';
import {
  deriveStarProfile,
  resolveSpectralClass,
  resolveTemperatureK,
  STAR_MAX_SPOTS,
} from './star-profile';

describe('resolveSpectralClass', () => {
  it('falls back to Sol for missing or unreadable values', () => {
    expect(resolveSpectralClass(null).label).toBe('G2V');
    expect(resolveSpectralClass('X9').label).toBe('G2V');
  });

  it('fills a missing subtype and luminosity from class defaults', () => {
    const resolved = resolveSpectralClass('K');
    expect(resolved.letter).toBe('K');
    expect(resolved.subtype).not.toBeNull();
    expect(resolved.luminosityClass).toBe('V');
  });

  it('labels exotic classes without a luminosity suffix', () => {
    expect(resolveSpectralClass('DA2').label).toBe('DA2');
    expect(resolveSpectralClass('WC8').label).toBe('WC8');
    expect(resolveSpectralClass('T6').label).toBe('T6');
    expect(resolveSpectralClass('C-N5').label).toBe('C-N5III');
  });
});

describe('resolveTemperatureK', () => {
  it('cools across subtypes within a class', () => {
    expect(resolveTemperatureK('G', 0)).toBeGreaterThan(resolveTemperatureK('G', 9));
  });

  it('reads white dwarf subtypes as a 50400 / T index', () => {
    expect(resolveTemperatureK('D', 2)).toBe(25200);
  });
});

describe('deriveStarProfile', () => {
  it('is deterministic per body id', () => {
    expect(deriveStarProfile('sol', 'G2V')).toEqual(deriveStarProfile('sol', 'G2V'));
    expect(deriveStarProfile('sol', 'G2V').noiseOffset).not.toEqual(
      deriveStarProfile('alpha-cen-a', 'G2V').noiseOffset,
    );
  });

  it('is hotter for B than M', () => {
    expect(deriveStarProfile('a', 'B2V').temperatureK).toBeGreaterThan(deriveStarProfile('a', 'M4V').temperatureK);
  });

  it('shifts temperature and colour with subtype', () => {
    const early = deriveStarProfile('a', 'K0V');
    const late = deriveStarProfile('a', 'K9V');
    expect(early.temperatureK).toBeGreaterThan(late.temperatureK);
    expect(early.color).not.toEqual(late.color);
  });

  it('gives giants coarser granulation and a larger corona', () => {
    const dwarf = deriveStarProfile('a', 'K1V');
    const giant = deriveStarProfile('a', 'K1III');
    expect(giant.granulationScale).toBeLessThan(dwarf.granulationScale);
    expect(giant.coronaScale).toBeGreaterThan(dwarf.coronaScale);
  });

  it('prefers an explicit colour over the class colour', () => {
    expect(deriveStarProfile('a', 'G2V', { colorHex: '#ff0000' }).color).toEqual([1, 0, 0]);
    expect(deriveStarProfile('a', 'G2V', { colorHex: 'nope' }).color).toEqual(
      deriveStarProfile('a', 'G2V').color,
    );
  });

  it('builds a valid profile for every class', () => {
    for (const letter of STELLAR_CLASS_LETTERS) {
      const profile = deriveStarProfile(`star-${letter}`, letter);
      expect(profile.spectralClass.letter).toBe(letter);
      expect(profile.temperatureK).toBeGreaterThan(0);
      expect(profile.color.every((channel) => channel >= 0 && channel <= 1)).toBe(true);
      expect(profile.spots.length).toBeLessThanOrEqual(STAR_MAX_SPOTS);
      for (const spot of profile.spots) {
        expect(Math.hypot(...spot.direction)).toBeCloseTo(1, 4);
      }
      expect(profile.rotationPeriodSeconds).toBeGreaterThan(0);
    }
  });
});
