import { describe, expect, it } from 'vitest';
import { parseSpectralClass, spectralClassLetter, STELLAR_CLASS_LETTERS } from './spectral-class';

describe('parseSpectralClass', () => {
  it.each([
    ['G2V', { letter: 'G', subtype: 2, luminosityClass: 'V', variant: null }],
    ['M5.5Ve', { letter: 'M', subtype: 5.5, luminosityClass: 'V', variant: null }],
    ['B1Ia', { letter: 'B', subtype: 1, luminosityClass: 'Ia', variant: null }],
    ['K1III', { letter: 'K', subtype: 1, luminosityClass: 'III', variant: null }],
    ['DA2', { letter: 'D', subtype: 2, luminosityClass: 'VII', variant: 'A' }],
    ['WC8', { letter: 'W', subtype: 8, luminosityClass: null, variant: 'C' }],
    ['C-N5', { letter: 'C', subtype: 5, luminosityClass: null, variant: 'N' }],
    ['sdM3', { letter: 'M', subtype: 3, luminosityClass: 'VI', variant: null }],
    ['L3', { letter: 'L', subtype: 3, luminosityClass: null, variant: null }],
    ['T6.5', { letter: 'T', subtype: 6.5, luminosityClass: null, variant: null }],
    ['Y0', { letter: 'Y', subtype: 0, luminosityClass: null, variant: null }],
  ])('parses %s', (value, expected) => {
    expect(parseSpectralClass(value)).toEqual(expected);
  });

  it('reads the leading subtype of an S-type abundance class', () => {
    expect(parseSpectralClass('S4/2')).toMatchObject({ letter: 'S', subtype: 4 });
  });

  it('accepts a bare letter and lowercase input', () => {
    expect(parseSpectralClass('o')).toMatchObject({ letter: 'O', subtype: null, luminosityClass: null });
    expect(parseSpectralClass('g2v')).toMatchObject({ letter: 'G', subtype: 2, luminosityClass: 'V' });
  });

  it('returns null for unknown or empty values', () => {
    expect(parseSpectralClass('X')).toBeNull();
    expect(parseSpectralClass('')).toBeNull();
    expect(parseSpectralClass(null)).toBeNull();
    expect(parseSpectralClass(undefined)).toBeNull();
  });

  it('parses every supported letter', () => {
    for (const letter of STELLAR_CLASS_LETTERS) {
      expect(parseSpectralClass(`${letter}5`)?.letter).toBe(letter);
    }
  });
});

describe('spectralClassLetter', () => {
  it('ignores subdwarf prefixes instead of reading them as S', () => {
    expect(spectralClassLetter('sdM3')).toBe('M');
    expect(spectralClassLetter('S4')).toBe('S');
  });
});
