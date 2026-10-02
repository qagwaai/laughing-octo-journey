/**
 * Deterministic description of a gas giant, derived entirely from its body id.
 *
 * Gas giants have no solid surface or elevation model: the visible "planet" is
 * a banded cloud deck. This profile is the single source of seeded choices
 * (palette, bands, storms, rings, tilt) consumed by the band bake, the shader
 * and the ring builder, so every view of the same body agrees.
 *
 * Texture-space convention used throughout: `u` is longitude in [0, 1) and `v`
 * is 0 at the south pole and 1 at the north pole, matching three.js sphere UVs.
 */
import { createSeededRng, fnv1a32 } from './planet-seed';

export const GAS_GIANT_GENERATOR_VERSION = 'gas-giant-v1';

export type GasGiantPalette = 'jovian' | 'saturnian' | 'ice';
export const GAS_GIANT_PALETTES: readonly GasGiantPalette[] = ['jovian', 'saturnian', 'ice'];

export type GasGiantRgb = readonly [number, number, number];

export interface GasGiantBand {
  /** Southern edge latitude in radians. Bands tile -PI/2..PI/2 without gaps. */
  start: number;
  /** Northern edge latitude in radians. */
  end: number;
  /** Bright, high zones versus dark, low belts. */
  kind: 'zone' | 'belt';
  /** sRGB, 0..1. */
  color: GasGiantRgb;
  /** Relative zonal jet speed, -1..1; positive is prograde. */
  flow: number;
}

/** An elliptical vortex in texture space. */
export interface GasGiantVortex {
  u: number;
  v: number;
  /** Half-width in `u` (longitude fraction). */
  radiusU: number;
  /** Half-height in `v` (latitude fraction). */
  radiusV: number;
  /** +1 counter-clockwise, -1 clockwise, seen from outside. */
  direction: 1 | -1;
  /** sRGB, 0..1. */
  color: GasGiantRgb;
}

/** A spiral swirl reusing the terran storm shader: centre, radius and spin direction in UV space. */
export interface GasGiantSwirl {
  u: number;
  v: number;
  radius: number;
  direction: 1 | -1;
}

export interface GasGiantRingGap {
  /** Position across the ring span, 0 (inner edge) to 1 (outer edge). */
  center: number;
  width: number;
}

export type GasGiantRingStyle = 'broad' | 'narrow' | 'faint';

export interface GasGiantRingProfile {
  style: GasGiantRingStyle;
  /** Inner and outer edges in planet radii. */
  innerRadius: number;
  outerRadius: number;
  /** Peak opacity, 0..1. */
  opacity: number;
  /** sRGB, 0..1. */
  color: GasGiantRgb;
  gaps: readonly GasGiantRingGap[];
  seed: number;
}

export interface GasGiantProfile {
  bodyId: string;
  seed: number;
  palette: GasGiantPalette;
  bands: readonly GasGiantBand[];
  /** Axial tilt in radians, applied to the spin axis and the ring plane. */
  axialTilt: number;
  /** 0..1, strength of eddies and festoons along band edges. */
  turbulence: number;
  /** sRGB, 0..1; colour the high latitudes fade toward. */
  polarColor: GasGiantRgb;
  /** The persistent great storm (Jupiter's red spot, Neptune's dark spot), if any. */
  anticyclone: GasGiantVortex | null;
  /** Small band-confined storms. */
  ovals: readonly GasGiantVortex[];
  swirls: readonly GasGiantSwirl[];
  rings: GasGiantRingProfile | null;
}

export interface GasGiantProfileOverrides {
  palette?: GasGiantPalette;
  rings?: boolean;
}

/** Maximum vortices the shader accepts; the profile never exceeds it. */
export const GAS_GIANT_MAX_OVALS = 6;

interface PaletteSpec {
  zone: GasGiantRgb;
  belt: GasGiantRgb;
  altBelt: GasGiantRgb;
  polar: GasGiantRgb;
  bandCount: readonly [number, number];
  /** Fraction of a band's colour that may vary per band. */
  jitter: number;
  turbulence: readonly [number, number];
  anticycloneChance: number;
  anticycloneColor: GasGiantRgb;
  ovalColor: GasGiantRgb;
  ovalCount: readonly [number, number];
  ringChance: number;
  ringStyle: GasGiantRingStyle;
}

const PALETTES: Readonly<Record<GasGiantPalette, PaletteSpec>> = {
  jovian: {
    zone: [0.93, 0.87, 0.76],
    belt: [0.66, 0.45, 0.31],
    altBelt: [0.55, 0.38, 0.27],
    polar: [0.56, 0.52, 0.5],
    bandCount: [12, 16],
    jitter: 0.07,
    turbulence: [0.65, 1],
    anticycloneChance: 0.9,
    anticycloneColor: [0.8, 0.38, 0.24],
    ovalColor: [0.97, 0.95, 0.9],
    ovalCount: [3, 6],
    ringChance: 0.25,
    ringStyle: 'faint',
  },
  saturnian: {
    zone: [0.93, 0.86, 0.66],
    belt: [0.8, 0.69, 0.49],
    altBelt: [0.75, 0.63, 0.45],
    polar: [0.66, 0.65, 0.58],
    bandCount: [14, 20],
    jitter: 0.04,
    turbulence: [0.3, 0.55],
    anticycloneChance: 0.3,
    anticycloneColor: [0.96, 0.92, 0.8],
    ovalColor: [0.98, 0.96, 0.88],
    ovalCount: [1, 3],
    ringChance: 0.8,
    ringStyle: 'broad',
  },
  ice: {
    zone: [0.47, 0.67, 0.9],
    belt: [0.3, 0.47, 0.8],
    altBelt: [0.34, 0.53, 0.84],
    polar: [0.55, 0.72, 0.86],
    bandCount: [5, 8],
    jitter: 0.05,
    turbulence: [0.2, 0.45],
    anticycloneChance: 0.65,
    anticycloneColor: [0.13, 0.2, 0.48],
    ovalColor: [0.93, 0.97, 1],
    ovalCount: [1, 3],
    ringChance: 0.45,
    ringStyle: 'narrow',
  },
};

const HALF_PI = Math.PI / 2;

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

function round6(value: number): number {
  return Number(value.toFixed(6));
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

function jitterColor(base: GasGiantRgb, amount: number, random: () => number): GasGiantRgb {
  const shade = (random() - 0.5) * 2 * amount;
  return [
    round6(clamp01(base[0] + shade)),
    round6(clamp01(base[1] + shade * 0.9)),
    round6(clamp01(base[2] + shade * 0.8)),
  ];
}

function pickInt(random: () => number, [min, max]: readonly [number, number]): number {
  return min + Math.min(max - min, Math.floor(random() * (max - min + 1)));
}

/** Converts latitude in radians to the `v` texture coordinate (0 south, 1 north). */
export function latitudeToV(latitude: number): number {
  return latitude / Math.PI + 0.5;
}

export function vToLatitude(v: number): number {
  return (v - 0.5) * Math.PI;
}

function buildBands(palette: GasGiantPalette, spec: PaletteSpec, random: () => number): GasGiantBand[] {
  const count = pickInt(random, spec.bandCount);
  const step = Math.PI / count;
  const edges = [-HALF_PI];
  for (let index = 1; index < count; index++) {
    edges.push(-HALF_PI + index * step + (random() - 0.5) * step * 0.55);
  }
  edges.push(HALF_PI);

  // The equatorial band is always a bright zone, and kinds alternate outward from it.
  const equatorIndex = edges.findIndex((edge, index) => index < count && edge <= 0 && edges[index + 1] > 0);
  const bands: GasGiantBand[] = [];
  for (let index = 0; index < count; index++) {
    const kind = Math.abs(index - equatorIndex) % 2 === 0 ? 'zone' : 'belt';
    const base = kind === 'zone' ? spec.zone : random() < 0.35 ? spec.altBelt : spec.belt;
    const start = edges[index];
    const end = edges[index + 1];
    const centerLatitude = (start + end) / 2;
    bands.push({
      start: round6(start),
      end: round6(end),
      kind,
      color: jitterColor(base, spec.jitter, random),
      flow: round6(resolveBandFlow(palette, centerLatitude, kind, random)),
    });
  }
  return bands;
}

/**
 * Zonal jets: Jupiter and Saturn have a strong prograde equatorial jet with
 * alternating jets poleward; ice giants are retrograde at the equator and
 * prograde at high latitudes.
 */
function resolveBandFlow(
  palette: GasGiantPalette,
  latitude: number,
  kind: GasGiantBand['kind'],
  random: () => number,
): number {
  const absLatitude = Math.abs(latitude);
  if (palette === 'ice') {
    return Math.max(-1, Math.min(1, -Math.cos(latitude * 2.2) * 0.8 + (random() - 0.5) * 0.15));
  }
  const equatorial = Math.max(0, 1 - absLatitude / 0.3) * (palette === 'saturnian' ? 1 : 0.7);
  const alternating = (kind === 'zone' ? 0.35 : -0.35) * Math.cos(absLatitude);
  return Math.max(-1, Math.min(1, equatorial + alternating + (random() - 0.5) * 0.12));
}

function buildAnticyclone(spec: PaletteSpec, random: () => number): GasGiantVortex | null {
  if (random() >= spec.anticycloneChance) return null;
  const radiusU = lerp(0.04, 0.065, random());
  return {
    u: round6(random()),
    v: round6(latitudeToV(-lerp(0.3, 0.42, random()))),
    radiusU: round6(radiusU),
    // About 1.7 times wider than tall at that latitude, like the red spot.
    radiusV: round6(radiusU * 1.2),
    // Southern-hemisphere anticyclones turn counter-clockwise seen from outside.
    direction: 1,
    color: jitterColor(spec.anticycloneColor, 0.03, random),
  };
}

function buildOvals(spec: PaletteSpec, random: () => number, hasAnticyclone: boolean): GasGiantVortex[] {
  const count = Math.min(GAS_GIANT_MAX_OVALS, pickInt(random, spec.ovalCount));
  // White ovals share one storm band, as in Jupiter's south temperate belt.
  const bandLatitude = -lerp(0.52, 0.62, random()) * (hasAnticyclone || random() < 0.6 ? 1 : -1);
  const start = random();
  const ovals: GasGiantVortex[] = [];
  for (let index = 0; index < count; index++) {
    const radiusU = lerp(0.012, 0.022, random());
    ovals.push({
      u: round6((start + index / count + (random() - 0.5) * 0.08 + 1) % 1),
      v: round6(latitudeToV(bandLatitude + (random() - 0.5) * 0.04)),
      radiusU: round6(radiusU),
      radiusV: round6(radiusU * 1.5),
      direction: bandLatitude < 0 ? 1 : -1,
      color: jitterColor(spec.ovalColor, 0.02, random),
    });
  }
  return ovals;
}

function buildSwirls(random: () => number): GasGiantSwirl[] {
  const first = random();
  return [
    { u: round6(first), v: round6(latitudeToV(lerp(0.15, 0.3, random()))), radius: 0.05, direction: -1 },
    {
      u: round6((first + 0.4 + random() * 0.2) % 1),
      v: round6(latitudeToV(-lerp(0.7, 0.85, random()))),
      radius: 0.045,
      direction: 1,
    },
  ];
}

function buildRings(palette: GasGiantPalette, spec: PaletteSpec, random: () => number, seed: number) {
  const style = spec.ringStyle;
  const innerRadius = style === 'narrow' ? lerp(1.55, 1.75, random()) : lerp(1.2, 1.4, random());
  const outerRadius =
    style === 'narrow'
      ? innerRadius + lerp(0.25, 0.45, random())
      : style === 'faint'
        ? innerRadius + lerp(0.45, 0.7, random())
        : innerRadius + lerp(0.85, 1.15, random());
  const gaps: GasGiantRingGap[] = [];
  if (style === 'broad') {
    // A Cassini-like division plus a narrower Encke-like gap.
    gaps.push({ center: round6(lerp(0.55, 0.68, random())), width: round6(lerp(0.035, 0.06, random())) });
    gaps.push({ center: round6(lerp(0.86, 0.94, random())), width: round6(lerp(0.008, 0.016, random())) });
  } else if (style === 'faint') {
    gaps.push({ center: round6(lerp(0.3, 0.5, random())), width: round6(lerp(0.05, 0.1, random())) });
  }
  const tint: Readonly<Record<GasGiantPalette, GasGiantRgb>> = {
    jovian: [0.62, 0.52, 0.43],
    saturnian: [0.86, 0.79, 0.65],
    ice: [0.5, 0.52, 0.56],
  };
  return {
    style,
    innerRadius: round6(innerRadius),
    outerRadius: round6(outerRadius),
    opacity: round6(style === 'broad' ? lerp(0.75, 0.92, random()) : style === 'narrow' ? 0.85 : 0.18),
    color: jitterColor(tint[palette], 0.04, random),
    gaps,
    seed: (seed ^ 0x5bd1e995) >>> 0,
  } satisfies GasGiantRingProfile;
}

const profileCache = new Map<string, GasGiantProfile>();

export function deriveGasGiantProfile(bodyId: string, overrides: GasGiantProfileOverrides = {}): GasGiantProfile {
  const cacheKey = `${bodyId}|${overrides.palette ?? '*'}|${overrides.rings ?? '*'}`;
  const cached = profileCache.get(cacheKey);
  if (cached) return cached;

  const seed = fnv1a32(`${GAS_GIANT_GENERATOR_VERSION}|${bodyId}`);
  const random = createSeededRng(seed);
  const paletteRoll = random();
  const seededPalette: GasGiantPalette = paletteRoll < 0.4 ? 'jovian' : paletteRoll < 0.72 ? 'saturnian' : 'ice';
  const palette = overrides.palette ?? seededPalette;
  const spec = PALETTES[palette];
  const ringRoll = random();
  const hasRings = overrides.rings ?? ringRoll < spec.ringChance;

  // Each feature draws from its own stream so overriding one choice never reshuffles the others.
  const stream = (name: string) => createSeededRng(fnv1a32(`${GAS_GIANT_GENERATOR_VERSION}|${name}|${bodyId}`));
  const shape = stream('shape');
  const axialTilt = round6(lerp(0.03, palette === 'ice' ? 0.5 : 0.48, shape()));
  const turbulence = round6(lerp(spec.turbulence[0], spec.turbulence[1], shape()));
  const anticyclone = buildAnticyclone(spec, stream('anticyclone'));

  const profile: GasGiantProfile = {
    bodyId,
    seed,
    palette,
    bands: buildBands(palette, spec, stream('bands')),
    axialTilt,
    turbulence,
    polarColor: spec.polar,
    anticyclone,
    ovals: buildOvals(spec, stream('ovals'), anticyclone !== null),
    swirls: buildSwirls(stream('swirls')),
    rings: hasRings ? buildRings(palette, spec, stream('rings'), seed) : null,
  };
  profileCache.set(cacheKey, profile);
  return profile;
}

/** Index of the band containing `latitude`, clamped to the poles. */
export function findBandIndex(bands: readonly GasGiantBand[], latitude: number): number {
  let low = 0;
  let high = bands.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (latitude >= bands[middle].end) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** Relative jet speed at a latitude, smoothed across band edges so shear stays bounded. */
export function sampleBandFlow(bands: readonly GasGiantBand[], latitude: number): number {
  const index = findBandIndex(bands, latitude);
  const band = bands[index];
  const width = band.end - band.start;
  const t = (latitude - band.start) / Math.max(width, 1e-6);
  const edge = 0.2;
  if (t < edge && index > 0) {
    const blend = 0.5 + (t / edge) * 0.5;
    return lerp(bands[index - 1].flow, band.flow, blend);
  }
  if (t > 1 - edge && index < bands.length - 1) {
    const blend = 0.5 + ((1 - t) / edge) * 0.5;
    return lerp(bands[index + 1].flow, band.flow, blend);
  }
  return band.flow;
}
