/**
 * Per-class look traits for procedural stars.
 *
 * Each spectral class gets a small, art-directed set of numbers that feed the
 * shared star renderer: temperature range, colour range, surface texture,
 * spots, corona and flare rate. Subtype interpolates within a class and the
 * luminosity class scales the result; see `star-profile.ts`.
 *
 * Colours are sRGB hex. They follow blackbody hues for O to M, but brown dwarfs
 * and the exotic families are pushed toward their observed or conventional
 * appearance (methane T dwarfs read magenta, carbon stars deep red) because a
 * pure blackbody would render a 400 K Y dwarf black.
 */
import type { LuminosityClass, StellarClassLetter } from './spectral-class';

export type StarFamily = 'main-sequence' | 'brown-dwarf' | 'white-dwarf' | 'wolf-rayet' | 'carbon' | 's-type';

/**
 * Plain labels for the dominant surface look. The shader is parameter-driven,
 * so this is for tests and diagnostics rather than a shader switch.
 */
export type StarSurfaceStyle = 'plasma' | 'convective' | 'banded' | 'degenerate' | 'wind' | 'sooty';

export interface StarClassTraits {
  letter: StellarClassLetter;
  family: StarFamily;
  surfaceStyle: StarSurfaceStyle;
  /** Effective temperature at subtype 0 and subtype 9. */
  temperatureK: readonly [number, number];
  /** Photosphere colour at subtype 0 and subtype 9. */
  colors: readonly [string, string];
  /** The class colour used when only the letter is known (lighting, legends). */
  representativeColor: string;
  defaultSubtype: number;
  defaultLuminosityClass: LuminosityClass;
  /** Convection cell frequency on the unit sphere; higher is finer. */
  granulationScale: number;
  /** 0..1 brightness difference between cell centres and lanes. */
  granulationContrast: number;
  /** 0..1 domain warp, which turns tidy cells into churning plasma. */
  turbulence: number;
  /** 0..1 strength of latitudinal cloud bands. */
  bandStrength: number;
  /** 0..1 coverage of dark soot clouds. */
  sootCoverage: number;
  /** 0..1 expected starspot coverage; scales the seeded spot count. */
  spotCoverage: number;
  /** 0..1 limb darkening coefficient. */
  limbDarkening: number;
  /** Emission multiplier; values above 1 rely on tone mapping for a hot white core. */
  emission: number;
  /** Corona outer radius in star radii. */
  coronaScale: number;
  /** 0..1 corona brightness. */
  coronaIntensity: number;
  /** 0..1 radial streamer strength in the corona; stellar wind for Wolf-Rayet stars. */
  streamerStrength: number;
  /** Expected flare and prominence events per minute at default activity. */
  flaresPerMinute: number;
  /** Visual spin period; not a physical rotation period. */
  rotationPeriodSeconds: number;
}

export const STAR_CLASS_TRAITS: Readonly<Record<StellarClassLetter, StarClassTraits>> = {
  O: {
    letter: 'O',
    family: 'main-sequence',
    surfaceStyle: 'plasma',
    temperatureK: [50000, 31000],
    colors: ['#90a6ff', '#a4b8ff'],
    representativeColor: '#9bb0ff',
    defaultSubtype: 6,
    defaultLuminosityClass: 'V',
    granulationScale: 14,
    granulationContrast: 0.18,
    turbulence: 0.55,
    bandStrength: 0,
    sootCoverage: 0,
    spotCoverage: 0,
    limbDarkening: 0.35,
    emission: 1.7,
    coronaScale: 2.6,
    coronaIntensity: 0.95,
    streamerStrength: 0.55,
    flaresPerMinute: 1.2,
    rotationPeriodSeconds: 70,
  },
  B: {
    letter: 'B',
    family: 'main-sequence',
    surfaceStyle: 'plasma',
    temperatureK: [30000, 10500],
    colors: ['#a2b6ff', '#bccdff'],
    representativeColor: '#aabfff',
    defaultSubtype: 5,
    defaultLuminosityClass: 'V',
    granulationScale: 15,
    granulationContrast: 0.2,
    turbulence: 0.45,
    bandStrength: 0,
    sootCoverage: 0,
    spotCoverage: 0,
    limbDarkening: 0.4,
    emission: 1.6,
    coronaScale: 2.4,
    coronaIntensity: 0.85,
    streamerStrength: 0.45,
    flaresPerMinute: 1,
    rotationPeriodSeconds: 60,
  },
  A: {
    letter: 'A',
    family: 'main-sequence',
    surfaceStyle: 'plasma',
    temperatureK: [10000, 7500],
    colors: ['#c2d2ff', '#dde6ff'],
    representativeColor: '#cad8ff',
    defaultSubtype: 1,
    defaultLuminosityClass: 'V',
    granulationScale: 17,
    granulationContrast: 0.24,
    turbulence: 0.35,
    bandStrength: 0,
    sootCoverage: 0,
    spotCoverage: 0.05,
    limbDarkening: 0.5,
    emission: 1.5,
    coronaScale: 2.2,
    coronaIntensity: 0.75,
    streamerStrength: 0.35,
    flaresPerMinute: 1.2,
    rotationPeriodSeconds: 55,
  },
  F: {
    letter: 'F',
    family: 'main-sequence',
    surfaceStyle: 'convective',
    temperatureK: [7400, 6050],
    colors: ['#eceeff', '#fff6ec'],
    representativeColor: '#f8f7ff',
    defaultSubtype: 5,
    defaultLuminosityClass: 'V',
    granulationScale: 19,
    granulationContrast: 0.32,
    turbulence: 0.3,
    bandStrength: 0,
    sootCoverage: 0,
    spotCoverage: 0.25,
    limbDarkening: 0.58,
    emission: 1.4,
    coronaScale: 2,
    coronaIntensity: 0.65,
    streamerStrength: 0.4,
    flaresPerMinute: 1.6,
    rotationPeriodSeconds: 50,
  },
  G: {
    letter: 'G',
    family: 'main-sequence',
    surfaceStyle: 'convective',
    temperatureK: [5950, 5300],
    colors: ['#fff6ea', '#ffe6c4'],
    representativeColor: '#fff4e8',
    defaultSubtype: 2,
    defaultLuminosityClass: 'V',
    granulationScale: 22,
    granulationContrast: 0.42,
    turbulence: 0.25,
    bandStrength: 0,
    sootCoverage: 0,
    spotCoverage: 0.45,
    limbDarkening: 0.62,
    emission: 1.3,
    coronaScale: 1.9,
    coronaIntensity: 0.6,
    streamerStrength: 0.5,
    flaresPerMinute: 2,
    rotationPeriodSeconds: 45,
  },
  K: {
    letter: 'K',
    family: 'main-sequence',
    surfaceStyle: 'convective',
    temperatureK: [5250, 3950],
    colors: ['#ffdcb4', '#ffbe80'],
    representativeColor: '#ffd2a1',
    defaultSubtype: 3,
    defaultLuminosityClass: 'V',
    granulationScale: 22,
    granulationContrast: 0.46,
    turbulence: 0.25,
    bandStrength: 0,
    sootCoverage: 0,
    spotCoverage: 0.6,
    limbDarkening: 0.68,
    emission: 1.15,
    coronaScale: 1.8,
    coronaIntensity: 0.55,
    streamerStrength: 0.45,
    flaresPerMinute: 2.4,
    rotationPeriodSeconds: 40,
  },
  M: {
    letter: 'M',
    family: 'main-sequence',
    surfaceStyle: 'convective',
    temperatureK: [3850, 2400],
    colors: ['#ffc07a', '#ff9450'],
    representativeColor: '#ffb46b',
    defaultSubtype: 4,
    defaultLuminosityClass: 'V',
    granulationScale: 18,
    granulationContrast: 0.5,
    turbulence: 0.3,
    bandStrength: 0,
    sootCoverage: 0,
    spotCoverage: 0.85,
    limbDarkening: 0.72,
    emission: 1,
    coronaScale: 1.7,
    coronaIntensity: 0.5,
    streamerStrength: 0.35,
    // M dwarfs are the classic flare stars.
    flaresPerMinute: 4,
    rotationPeriodSeconds: 35,
  },
  L: {
    letter: 'L',
    family: 'brown-dwarf',
    surfaceStyle: 'banded',
    temperatureK: [2200, 1350],
    colors: ['#ff7442', '#d8452e'],
    representativeColor: '#f05a36',
    defaultSubtype: 3,
    defaultLuminosityClass: 'V',
    granulationScale: 9,
    granulationContrast: 0.3,
    turbulence: 0.5,
    bandStrength: 0.45,
    sootCoverage: 0,
    spotCoverage: 0.3,
    limbDarkening: 0.6,
    emission: 0.85,
    coronaScale: 1.45,
    coronaIntensity: 0.32,
    streamerStrength: 0.1,
    flaresPerMinute: 1.2,
    rotationPeriodSeconds: 24,
  },
  T: {
    letter: 'T',
    family: 'brown-dwarf',
    surfaceStyle: 'banded',
    temperatureK: [1300, 600],
    colors: ['#c4508c', '#86398a'],
    representativeColor: '#b04a8e',
    defaultSubtype: 6,
    defaultLuminosityClass: 'V',
    granulationScale: 7,
    granulationContrast: 0.24,
    turbulence: 0.6,
    bandStrength: 0.7,
    sootCoverage: 0,
    spotCoverage: 0.15,
    limbDarkening: 0.55,
    emission: 0.7,
    coronaScale: 1.35,
    coronaIntensity: 0.25,
    streamerStrength: 0.05,
    flaresPerMinute: 0.4,
    rotationPeriodSeconds: 20,
  },
  Y: {
    letter: 'Y',
    family: 'brown-dwarf',
    surfaceStyle: 'banded',
    temperatureK: [550, 300],
    colors: ['#7e3c72', '#55304f'],
    representativeColor: '#6e3866',
    defaultSubtype: 1,
    defaultLuminosityClass: 'V',
    granulationScale: 6,
    granulationContrast: 0.2,
    turbulence: 0.65,
    bandStrength: 0.85,
    sootCoverage: 0,
    spotCoverage: 0.1,
    limbDarkening: 0.5,
    emission: 0.6,
    coronaScale: 1.25,
    coronaIntensity: 0.18,
    streamerStrength: 0,
    flaresPerMinute: 0,
    rotationPeriodSeconds: 18,
  },
  D: {
    letter: 'D',
    family: 'white-dwarf',
    surfaceStyle: 'degenerate',
    // White dwarf subtypes are a temperature index (50400 / T), so this range is a fallback only.
    temperatureK: [50400, 5600],
    colors: ['#c6d6ff', '#fff1e2'],
    representativeColor: '#e6eeff',
    defaultSubtype: 2,
    defaultLuminosityClass: 'VII',
    granulationScale: 40,
    granulationContrast: 0.06,
    turbulence: 0.1,
    bandStrength: 0,
    sootCoverage: 0,
    spotCoverage: 0,
    limbDarkening: 0.25,
    emission: 2,
    coronaScale: 1.6,
    coronaIntensity: 0.9,
    streamerStrength: 0,
    flaresPerMinute: 0.2,
    rotationPeriodSeconds: 12,
  },
  W: {
    letter: 'W',
    family: 'wolf-rayet',
    surfaceStyle: 'wind',
    temperatureK: [140000, 40000],
    colors: ['#8aa6ff', '#b4c6ff'],
    representativeColor: '#9cb4ff',
    defaultSubtype: 6,
    defaultLuminosityClass: 'Ia',
    granulationScale: 10,
    granulationContrast: 0.3,
    turbulence: 0.9,
    bandStrength: 0,
    sootCoverage: 0,
    spotCoverage: 0,
    limbDarkening: 0.2,
    emission: 1.9,
    coronaScale: 3.2,
    coronaIntensity: 1,
    // The defining Wolf-Rayet feature: a dense, fast stellar wind.
    streamerStrength: 1,
    flaresPerMinute: 2.5,
    rotationPeriodSeconds: 80,
  },
  C: {
    letter: 'C',
    family: 'carbon',
    surfaceStyle: 'sooty',
    temperatureK: [4500, 2400],
    colors: ['#ff8a4a', '#e2482a'],
    representativeColor: '#ff7a3a',
    defaultSubtype: 5,
    defaultLuminosityClass: 'III',
    granulationScale: 8,
    granulationContrast: 0.55,
    turbulence: 0.45,
    bandStrength: 0,
    sootCoverage: 0.45,
    spotCoverage: 0.2,
    limbDarkening: 0.75,
    emission: 0.95,
    coronaScale: 2.1,
    coronaIntensity: 0.4,
    streamerStrength: 0.25,
    flaresPerMinute: 0.6,
    rotationPeriodSeconds: 90,
  },
  S: {
    letter: 'S',
    family: 's-type',
    surfaceStyle: 'convective',
    temperatureK: [3600, 2400],
    colors: ['#ffac6c', '#ff8244'],
    representativeColor: '#ffa060',
    defaultSubtype: 4,
    defaultLuminosityClass: 'III',
    granulationScale: 9,
    granulationContrast: 0.5,
    turbulence: 0.4,
    bandStrength: 0,
    sootCoverage: 0.15,
    spotCoverage: 0.4,
    limbDarkening: 0.72,
    emission: 1,
    coronaScale: 2,
    coronaIntensity: 0.45,
    streamerStrength: 0.3,
    flaresPerMinute: 0.8,
    rotationPeriodSeconds: 85,
  },
};

export interface LuminosityModifiers {
  /** Multiplies granulation frequency; giants have far larger convection cells. */
  granulation: number;
  corona: number;
  flares: number;
  /** Multiplies the visual spin period; bloated stars turn slowly. */
  spin: number;
}

export const LUMINOSITY_MODIFIERS: Readonly<Record<LuminosityClass, LuminosityModifiers>> = {
  '0': { granulation: 0.3, corona: 1.35, flares: 0.35, spin: 2.2 },
  Ia: { granulation: 0.38, corona: 1.3, flares: 0.45, spin: 2 },
  Iab: { granulation: 0.42, corona: 1.25, flares: 0.5, spin: 1.9 },
  Ib: { granulation: 0.48, corona: 1.2, flares: 0.55, spin: 1.8 },
  II: { granulation: 0.58, corona: 1.15, flares: 0.6, spin: 1.6 },
  III: { granulation: 0.7, corona: 1.1, flares: 0.7, spin: 1.4 },
  IV: { granulation: 0.88, corona: 1.05, flares: 0.85, spin: 1.15 },
  V: { granulation: 1, corona: 1, flares: 1, spin: 1 },
  VI: { granulation: 1.1, corona: 0.95, flares: 1.1, spin: 0.9 },
  VII: { granulation: 1, corona: 1, flares: 1, spin: 1 },
};
