import { describe, expect, it } from 'vitest';
import { SPLASH_STAR_CLASSES } from '../planet/splash-planet-rotation';
import { isStarSpectralClassChoice, resolveStarSpectralClassChoice, StarSettings } from './star-settings';

describe('StarSettings spectral class choice', () => {
  it('starts seeded', () => {
    expect(new StarSettings().spectralClass()).toBe('seeded');
  });

  it('keeps the seeded class when the choice is seeded', () => {
    expect(resolveStarSpectralClassChoice('seeded', 'L3')).toBe('L3');
    expect(resolveStarSpectralClassChoice('seeded', null)).toBeNull();
  });

  it('overrides the seeded class with an explicit choice', () => {
    expect(resolveStarSpectralClassChoice('G2V', 'L3')).toBe('G2V');
  });

  it('accepts seeded and every splash class, and rejects anything else', () => {
    expect(isStarSpectralClassChoice('seeded')).toBe(true);
    for (const spectralClass of SPLASH_STAR_CLASSES) expect(isStarSpectralClassChoice(spectralClass)).toBe(true);
    expect(isStarSpectralClassChoice('G')).toBe(false);
    expect(isStarSpectralClassChoice('K5III')).toBe(false);
  });
});
