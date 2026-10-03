/**
 * Parses spectral class strings from the solar-system contract.
 *
 * The contract carries `spectralClass` as free text such as `G2V`, `M5.5Ve`,
 * `B1Ia`, `DA2`, `WC8`, `C-N5` or `sdM3`. Rendering only needs the class
 * letter, the numeric subtype and the luminosity class, so everything else
 * (peculiarity suffixes, uncertainty marks) is ignored. Nothing here changes
 * the contract; it only reads what Forge already sends.
 */

export type StellarClassLetter = 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M' | 'L' | 'T' | 'Y' | 'D' | 'W' | 'C' | 'S';

/** Hot to cool main sequence, then brown dwarfs, then the exotic families. */
export const STELLAR_CLASS_LETTERS: readonly StellarClassLetter[] = [
  'O',
  'B',
  'A',
  'F',
  'G',
  'K',
  'M',
  'L',
  'T',
  'Y',
  'D',
  'W',
  'C',
  'S',
];

/**
 * Morgan-Keenan luminosity classes. `0` covers hypergiants (`0` and `Ia+`),
 * `VI` subdwarfs (`sd` prefix) and `VII` white dwarfs.
 */
export type LuminosityClass = '0' | 'Ia' | 'Iab' | 'Ib' | 'II' | 'III' | 'IV' | 'V' | 'VI' | 'VII';

export const LUMINOSITY_CLASSES: readonly LuminosityClass[] = [
  '0',
  'Ia',
  'Iab',
  'Ib',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
];

export interface ParsedSpectralClass {
  letter: StellarClassLetter;
  /** Numeric subtype, `0` hottest; decimals such as `5.5` are kept. Null when absent. */
  subtype: number | null;
  luminosityClass: LuminosityClass | null;
  /**
   * Family-specific sub-letter: the white dwarf atmosphere (`DA` gives `A`),
   * the Wolf-Rayet sequence (`WC` gives `C`) or the carbon star type (`C-N` gives `N`).
   */
  variant: string | null;
}

const LETTER_SET = new Set<string>(STELLAR_CLASS_LETTERS);
const SUBDWARF_PREFIX = /^(?:e|u)?sd(?=[OBAFGKML])/i;
const SUBTYPE = /^(\d+(?:\.\d+)?)/;
// Longest numerals first so `III` and `IV` are not read as `I`.
const LUMINOSITY = /^(VII|VI|V|IV|III|II|Iab|Ia\+|Ia|Ib|I|0)/i;
const WHITE_DWARF_VARIANTS = /^[ABOQZCX]+/;
const WOLF_RAYET_VARIANTS = /^[NCO]/;
const CARBON_VARIANTS = /^-?(R|N|J|Hd|H)/i;

function canonicalLuminosity(token: string): LuminosityClass {
  switch (token.toUpperCase()) {
    case '0':
    case 'IA+':
      return '0';
    case 'IA':
      return 'Ia';
    case 'IAB':
    case 'I':
      return 'Iab';
    case 'IB':
      return 'Ib';
    default:
      return token.toUpperCase() as LuminosityClass;
  }
}

function readSubtype(rest: string): { subtype: number | null; rest: string } {
  const match = SUBTYPE.exec(rest);
  if (!match) return { subtype: null, rest };
  return { subtype: Number(match[1]), rest: rest.slice(match[0].length) };
}

function readLuminosity(rest: string): LuminosityClass | null {
  const match = LUMINOSITY.exec(rest.trimStart());
  return match ? canonicalLuminosity(match[1]) : null;
}

/** Returns null when the string has no recognisable class letter. */
export function parseSpectralClass(value: string | null | undefined): ParsedSpectralClass | null {
  if (typeof value !== 'string') return null;
  let text = value.trim();
  if (!text) return null;

  let prefixLuminosity: LuminosityClass | null = null;
  const subdwarf = SUBDWARF_PREFIX.exec(text);
  if (subdwarf) {
    prefixLuminosity = 'VI';
    text = text.slice(subdwarf[0].length);
  }

  const letter = text.charAt(0).toUpperCase();
  if (!LETTER_SET.has(letter)) return null;
  let rest = text.slice(1);
  let variant: string | null = null;

  if (letter === 'D') {
    const match = WHITE_DWARF_VARIANTS.exec(rest.toUpperCase());
    if (match) {
      variant = match[0].charAt(0);
      rest = rest.slice(match[0].length);
    }
    return { letter, subtype: readSubtype(rest).subtype, luminosityClass: 'VII', variant };
  }

  if (letter === 'W') {
    const match = WOLF_RAYET_VARIANTS.exec(rest.toUpperCase());
    if (match) {
      variant = match[0];
      rest = rest.slice(1);
    }
    return { letter, subtype: readSubtype(rest).subtype, luminosityClass: null, variant };
  }

  if (letter === 'C') {
    const match = CARBON_VARIANTS.exec(rest);
    if (match) {
      variant = match[1].toUpperCase() === 'HD' ? 'Hd' : match[1].toUpperCase();
      rest = rest.slice(match[0].length);
    }
  }

  const parsed = readSubtype(rest);
  return {
    letter: letter as StellarClassLetter,
    subtype: parsed.subtype,
    luminosityClass: prefixLuminosity ?? readLuminosity(parsed.rest),
    variant,
  };
}

/** Class letter only, for callers that just need a colour family. */
export function spectralClassLetter(value: string | null | undefined): StellarClassLetter | null {
  return parseSpectralClass(value)?.letter ?? null;
}
