/**
 * CPU bake of a gas giant's banded cloud deck.
 *
 * Bands are looked up by latitude, but the lookup latitude is perturbed by
 * horizontally stretched noise, strongest along band edges, which produces the
 * festoons and eddies seen where zones meet belts. Fine latitudinal streaks and
 * polar haze are layered on top. Noise is sampled on the unit sphere, so the
 * texture has no longitude seam.
 */
import {
  ClampToEdgeWrapping,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from 'three';
import {
  findBandIndex,
  type GasGiantBand,
  type GasGiantProfile,
  type GasGiantRgb,
  vToLatitude,
} from '../../model/planet/gas-giant-profile';
import { fbm3 } from '../../model/planet/planet-noise';
import { smoothstep } from '../../model/planet/planet-surface';

export interface GasGiantBandSize {
  width: number;
  height: number;
}

const BAND_EDGE_SOFTNESS = 0.14;

function mixInto(target: number[], from: GasGiantRgb, to: GasGiantRgb, t: number): void {
  target[0] = from[0] + (to[0] - from[0]) * t;
  target[1] = from[1] + (to[1] - from[1]) * t;
  target[2] = from[2] + (to[2] - from[2]) * t;
}

/** Colour at a latitude, softly blended with the neighbouring band near each edge. */
export function sampleBandColor(bands: readonly GasGiantBand[], latitude: number, out: number[] = [0, 0, 0]): number[] {
  const index = findBandIndex(bands, latitude);
  const band = bands[index];
  const t = (latitude - band.start) / Math.max(band.end - band.start, 1e-6);
  if (t < BAND_EDGE_SOFTNESS && index > 0) {
    mixInto(out, bands[index - 1].color, band.color, 0.5 + 0.5 * smoothstep(0, BAND_EDGE_SOFTNESS, t));
  } else if (t > 1 - BAND_EDGE_SOFTNESS && index < bands.length - 1) {
    mixInto(out, bands[index + 1].color, band.color, 0.5 + 0.5 * smoothstep(0, BAND_EDGE_SOFTNESS, 1 - t));
  } else {
    mixInto(out, band.color, band.color, 0);
  }
  return out;
}

/** 0 mid-band, 1 on an edge between bands. */
function edgeProximity(bands: readonly GasGiantBand[], latitude: number): number {
  const band = bands[findBandIndex(bands, latitude)];
  const half = (band.end - band.start) / 2;
  const fromEdge = Math.min(latitude - band.start, band.end - latitude);
  return 1 - Math.max(0, Math.min(1, fromEdge / Math.max(half, 1e-6)));
}

export function rasterizeGasGiantBands(profile: GasGiantProfile, { width, height }: GasGiantBandSize): Uint8Array {
  const pixels = new Uint8Array(width * height * 4);
  const { bands, turbulence, polarColor } = profile;
  const warpSeed = profile.seed ^ 0x27d4eb2f;
  const eddySeed = profile.seed ^ 0x165667b1;
  const streakSeed = profile.seed ^ 0x61c88647;
  const color = [0, 0, 0];
  const sinLongitude = new Float64Array(width);
  const cosLongitude = new Float64Array(width);
  for (let x = 0; x < width; x++) {
    const longitude = ((x + 0.5) / width - 0.5) * Math.PI * 2;
    sinLongitude[x] = Math.sin(longitude);
    cosLongitude[x] = Math.cos(longitude);
  }

  for (let y = 0; y < height; y++) {
    const latitude = vToLatitude((y + 0.5) / height);
    const sinLatitude = Math.sin(latitude);
    const cosLatitude = Math.cos(latitude);
    const proximity = edgeProximity(bands, latitude);
    const edgeBoost = 0.3 + 1.2 * proximity * proximity;
    const polar = smoothstep(0.95, 1.4, Math.abs(latitude)) * 0.7;
    const beltWeight = bands[findBandIndex(bands, latitude)].kind === 'belt' ? 1 : 0.45;
    for (let x = 0; x < width; x++) {
      const dx = cosLatitude * sinLongitude[x];
      const dz = cosLatitude * cosLongitude[x];
      const dy = sinLatitude;
      // Stretched along longitude so eddies smear into jets; kept well under a band width.
      const warp = fbm3(dx * 4, dy * 16, dz * 4, warpSeed, 3) - 0.5;
      const eddy = fbm3(dx * 12, dy * 34, dz * 12, eddySeed, 3) - 0.5;
      const warped = latitude + (warp * 0.075 + eddy * 0.03) * turbulence * edgeBoost;
      sampleBandColor(bands, Math.max(-Math.PI / 2, Math.min(Math.PI / 2, warped)), color);
      const streak = fbm3(dx * 1.6, dy * 70, dz * 1.6, streakSeed, 3) - 0.5;
      const filament = fbm3(dx * 5, dy * 40, dz * 5, streakSeed ^ 0x9e3779b9, 2) - 0.5;
      const shade = 1 + streak * 0.32 + eddy * 0.18 * turbulence + filament * 0.3 * beltWeight * turbulence;
      const index = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        const value = color[channel] * shade;
        const hazed = value + (polarColor[channel] - value) * polar;
        pixels[index + channel] = Math.max(0, Math.min(255, Math.round(hazed * 255)));
      }
      pixels[index + 3] = 255;
    }
  }
  return pixels;
}

export function createGasGiantBandTexture(profile: GasGiantProfile, size: GasGiantBandSize): DataTexture {
  const texture = new DataTexture(
    rasterizeGasGiantBands(profile, size),
    size.width,
    size.height,
    RGBAFormat,
    UnsignedByteType,
  );
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}
