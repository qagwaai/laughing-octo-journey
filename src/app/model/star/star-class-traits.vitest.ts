import { describe, expect, it } from 'vitest';
import { LUMINOSITY_CLASSES, STELLAR_CLASS_LETTERS } from './spectral-class';
import { LUMINOSITY_MODIFIERS, STAR_CLASS_TRAITS } from './star-class-traits';

describe('STAR_CLASS_TRAITS', () => {
  it('covers every spectral class letter', () => {
    for (const letter of STELLAR_CLASS_LETTERS) {
      const traits = STAR_CLASS_TRAITS[letter];
      expect(traits.letter).toBe(letter);
      expect(traits.colors.every((color) => /^#[0-9a-f]{6}$/i.test(color))).toBe(true);
      expect(traits.representativeColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(traits.coronaScale).toBeGreaterThan(1);
    }
  });

  it('orders the main sequence from hot to cool', () => {
    const sequence = ['O', 'B', 'A', 'F', 'G', 'K', 'M', 'L', 'T', 'Y'] as const;
    for (let index = 1; index < sequence.length; index++) {
      expect(STAR_CLASS_TRAITS[sequence[index]].temperatureK[0]).toBeLessThan(
        STAR_CLASS_TRAITS[sequence[index - 1]].temperatureK[0],
      );
    }
  });

  it('gives every luminosity class a modifier', () => {
    for (const luminosityClass of LUMINOSITY_CLASSES) {
      expect(LUMINOSITY_MODIFIERS[luminosityClass]).toBeDefined();
    }
  });

  it('makes giants coarser and larger-coronaed than dwarfs', () => {
    expect(LUMINOSITY_MODIFIERS.III.granulation).toBeLessThan(LUMINOSITY_MODIFIERS.V.granulation);
    expect(LUMINOSITY_MODIFIERS.III.corona).toBeGreaterThan(LUMINOSITY_MODIFIERS.V.corona);
  });
});
