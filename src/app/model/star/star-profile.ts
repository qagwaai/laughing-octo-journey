/**
 * Deterministic description of a star, derived from its body id and spectral class.
 *
 * The profile is the single source of seeded choices (spots, tilt, spin, noise
 * offset) and class-driven parameters (colour, granulation, corona, flare rate)
 * consumed by the photosphere shader, the corona and the flare scheduler, so
 * every view of the same star agrees. It reads only fields the contract
 * already carries; see `spectral-class.ts`.
 */
import { createSeededRng, fnv1a32 } from '../planet/planet-seed';
import {
  parseSpectralClass,
  type LuminosityClass,
  type ParsedSpectralClass,
  type StellarClassLetter,
} from './spectral-class';
import {
  LUMINOSITY_MODIFIERS,
  STAR_CLASS_TRAITS,
  type StarFamily,
  type StarSurfaceStyle,
} from './star-class-traits';

export const STAR_GENERATOR_VERSION = 'star-v1';
export const STAR_MAX_SPOTS = 8;
/** Sol's class, used when a body carries no readable spectral class. */
export const DEFAULT_SPECTRAL_CLASS = 'G2V';

/** sRGB, 0..1. */
export type StarRgb = readonly [number, number, number];

export interface StarSpot {
  /** Unit direction in the star's local frame. */
  direction: readonly [number, number, number];
  /** Angular radius in radians, penumbra included. */
  radius: number;
}

export interface ResolvedSpectralClass {
  letter: StellarClassLetter;
  subtype: number;
  luminosityClass: LuminosityClass;
  variant: string | null;
  /** Canonical short form such as `G2V`, `DA2` or `WC8`. */
  label: string;
}

export interface StarProfile {
  bodyId: string;
  seed: number;
  spectralClass: ResolvedSpectralClass;
  family: StarFamily;
  surfaceStyle: StarSurfaceStyle;
  temperatureK: number;
  color: StarRgb;
  /** Shader noise offset so stars of the same class do not share a surface. */
  noiseOffset: readonly [number, number, number];
  granulationScale: number;
  granulationContrast: number;
  turbulence: number;
  bandStrength: number;
  sootCoverage: number;
  limbDarkening: number;
  emission: number;
  spots: readonly StarSpot[];
  coronaScale: number;
  coronaIntensity: number;
  streamerStrength: number;
  flaresPerMinute: number;
  /** Prominence loop height relative to a Sun-like star. */
  prominenceScale: number;
  rotationPeriodSeconds: number;
  axialTilt: number;
}

/** Degenerate and substellar surfaces hold only small, low loops. */
const PROMINENCE_SCALE_BY_FAMILY: Readonly<Record<StarFamily, number>> = {
  'main-sequence': 1,
  'brown-dwarf': 0.45,
  'white-dwarf': 0.5,
  'wolf-rayet': 0.7,
  carbon: 0.9,
  's-type': 0.9,
};

export interface StarProfileOverrides {
  /** Explicit art direction, such as `visualization.colorHex`; wins over the class colour. */
  colorHex?: string | null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function quantize(value: number): number {
  return Number(value.toFixed(6));
}

export function hexToStarRgb(hex: string): StarRgb | null {
  const value = hex.trim().replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  return [
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
  ];
}

function mixRgb(a: StarRgb, b: StarRgb, t: number): StarRgb {
  return [quantize(lerp(a[0], b[0], t)), quantize(lerp(a[1], b[1], t)), quantize(lerp(a[2], b[2], t))];
}

/**
 * Where the subtype sits between the class's hot (0) and cool (1) ends.
 *
 * White dwarf subtypes are a temperature index of `50400 / T`, roughly 1 to 9,
 * so they are mapped on that scale rather than the usual 0..9.
 */
export function subtypeFraction(letter: StellarClassLetter, subtype: number): number {
  if (letter === 'D') return clamp((subtype - 1) / 8, 0, 1);
  return clamp(subtype / 9, 0, 1);
}

export function resolveTemperatureK(letter: StellarClassLetter, subtype: number): number {
  if (letter === 'D') return Math.round(50400 / clamp(subtype, 0.5, 13));
  const [hot, cool] = STAR_CLASS_TRAITS[letter].temperatureK;
  return Math.round(lerp(hot, cool, subtypeFraction(letter, subtype)));
}

function formatLabel(parsed: ParsedSpectralClass, subtype: number, luminosityClass: LuminosityClass): string {
  const variant = parsed.variant ?? '';
  const separator = parsed.letter === 'C' && variant ? '-' : '';
  // White dwarfs, Wolf-Rayet stars and brown dwarfs are not given MK luminosity classes.
  const showLuminosity = !['D', 'W', 'L', 'T', 'Y'].includes(parsed.letter);
  return `${parsed.letter}${separator}${variant}${subtype}${showLuminosity ? luminosityClass : ''}`;
}

/** Fills missing subtype and luminosity with the class defaults. */
export function resolveSpectralClass(value: string | null | undefined): ResolvedSpectralClass {
  const parsed = parseSpectralClass(value) ?? parseSpectralClass(DEFAULT_SPECTRAL_CLASS)!;
  const traits = STAR_CLASS_TRAITS[parsed.letter];
  const subtype = parsed.subtype ?? traits.defaultSubtype;
  const luminosityClass = parsed.luminosityClass ?? traits.defaultLuminosityClass;
  return {
    letter: parsed.letter,
    subtype,
    luminosityClass,
    variant: parsed.variant,
    label: formatLabel(parsed, subtype, luminosityClass),
  };
}

/** Class colour at the given subtype, before any art-direction override. */
export function resolveSpectralColor(spectralClass: ResolvedSpectralClass): StarRgb {
  const traits = STAR_CLASS_TRAITS[spectralClass.letter];
  const hot = hexToStarRgb(traits.colors[0])!;
  const cool = hexToStarRgb(traits.colors[1])!;
  return mixRgb(hot, cool, subtypeFraction(spectralClass.letter, spectralClass.subtype));
}

function seedSpots(random: () => number, coverage: number, sizeScale: number): StarSpot[] {
  const count = clamp(Math.round(coverage * STAR_MAX_SPOTS * (0.5 + random())), 0, STAR_MAX_SPOTS);
  return Array.from({ length: count }, () => {
    // Spots sit in the active mid-latitude belts, like the solar butterfly diagram.
    const hemisphere = random() < 0.5 ? -1 : 1;
    const latitude = hemisphere * lerp(0.08, 0.66, random());
    const longitude = random() * Math.PI * 2;
    const cosLat = Math.cos(latitude);
    return {
      direction: [
        quantize(cosLat * Math.cos(longitude)),
        quantize(Math.sin(latitude)),
        quantize(cosLat * Math.sin(longitude)),
      ] as const,
      radius: quantize(lerp(0.05, 0.13, random()) * sizeScale),
    };
  });
}

export function deriveStarProfile(
  bodyId: string,
  spectralClassValue?: string | null,
  overrides: StarProfileOverrides = {},
): StarProfile {
  const spectralClass = resolveSpectralClass(spectralClassValue);
  const traits = STAR_CLASS_TRAITS[spectralClass.letter];
  const modifiers = LUMINOSITY_MODIFIERS[spectralClass.luminosityClass];
  const seed = fnv1a32(`${STAR_GENERATOR_VERSION}|${bodyId}`);
  const random = createSeededRng(seed);
  const noiseOffset = [
    quantize(random() * 97),
    quantize(random() * 97),
    quantize(random() * 97),
  ] as const;
  const axialTilt = quantize((random() - 0.5) * 0.5);
  const spinJitter = lerp(0.9, 1.1, random());
  // Giants have bigger spots, in proportion to their bigger convection cells.
  const spots = seedSpots(random, traits.spotCoverage, 1 / Math.sqrt(modifiers.granulation));
  const explicit = overrides.colorHex ? hexToStarRgb(overrides.colorHex) : null;

  return {
    bodyId,
    seed,
    spectralClass,
    family: traits.family,
    surfaceStyle: traits.surfaceStyle,
    temperatureK: resolveTemperatureK(spectralClass.letter, spectralClass.subtype),
    color: explicit ?? resolveSpectralColor(spectralClass),
    noiseOffset,
    granulationScale: quantize(traits.granulationScale * modifiers.granulation),
    granulationContrast: traits.granulationContrast,
    turbulence: traits.turbulence,
    bandStrength: traits.bandStrength,
    sootCoverage: traits.sootCoverage,
    limbDarkening: traits.limbDarkening,
    emission: traits.emission,
    spots,
    coronaScale: quantize(traits.coronaScale * modifiers.corona),
    coronaIntensity: traits.coronaIntensity,
    streamerStrength: traits.streamerStrength,
    flaresPerMinute: quantize(traits.flaresPerMinute * modifiers.flares),
    prominenceScale: PROMINENCE_SCALE_BY_FAMILY[traits.family],
    rotationPeriodSeconds: quantize(traits.rotationPeriodSeconds * modifiers.spin * spinJitter),
    axialTilt,
  };
}
