/**
 * Equirectangular rasterizer for the CPU reference path.
 *
 * Elevation is evaluated once per texel and reused for both the albedo and the
 * normal map, which halves the noise work compared with independent passes.
 */
import { clamp01 } from './planet-noise';
import type { PlanetClimate } from './planet-seed';
import { directionFromEquirect, planetAlbedo, planetElevation, planetMaterial } from './planet-surface';

export type PlanetLodTier = 'l0' | 'l1';

export interface PlanetLodPreset {
  width: number;
  height: number;
  includeNormal: boolean;
  /** Roughness/metalness map, baked at the same size as the normal map. */
  includeMaterial: boolean;
  /** Normal maps are stored at half the albedo resolution; see the VRAM budget in the design doc. */
  normalScale: number;
}

/** Budgets are justified in docs/procedural-planets-2026-09-28.md. */
export const PLANET_LOD: Readonly<Record<PlanetLodTier, PlanetLodPreset>> = {
  l0: { width: 256, height: 128, includeNormal: false, includeMaterial: false, normalScale: 1 },
  l1: { width: 2048, height: 1024, includeNormal: true, includeMaterial: true, normalScale: 0.5 },
};

export interface PlanetRaster {
  width: number;
  height: number;
  albedo: Uint8ClampedArray;
  normal?: Uint8ClampedArray;
  material?: Uint8ClampedArray;
  normalWidth?: number;
  normalHeight?: number;
  signature: string;
}

const NORMAL_RELIEF_SCALE = 6;
const MIN_LATITUDE_COSINE = 0.15;

function buildElevationGrid(climate: PlanetClimate, width: number, height: number): Float32Array {
  const grid = new Float32Array(width * height);

  for (let y = 0; y < height; y += 1) {
    const v = (y + 0.5) / height;
    for (let x = 0; x < width; x += 1) {
      const u = (x + 0.5) / width;
      const [dx, dy, dz] = directionFromEquirect(u, v);
      grid[y * width + x] = planetElevation(dx, dy, dz, climate);
    }
  }

  return grid;
}

function encodeAlbedo(
  climate: PlanetClimate,
  elevation: Float32Array,
  width: number,
  height: number,
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const v = (y + 0.5) / height;
    const sinLatitude = Math.sin((0.5 - v) * Math.PI);
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const [r, g, b] = planetAlbedo(elevation[index], sinLatitude, climate);
      const offset = index * 4;
      pixels[offset] = Math.round(r * 255);
      pixels[offset + 1] = Math.round(g * 255);
      pixels[offset + 2] = Math.round(b * 255);
      pixels[offset + 3] = 255;
    }
  }

  return pixels;
}

/**
 * Encodes the roughness/metalness map in the channels three.js samples:
 * red is ambient occlusion, green roughness, blue metalness.
 */
function encodeMaterial(
  climate: PlanetClimate,
  elevation: Float32Array,
  width: number,
  height: number,
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    const v = (y + 0.5) / height;
    const sinLatitude = Math.sin((0.5 - v) * Math.PI);
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      const [ao, roughness, metalness] = planetMaterial(elevation[index], sinLatitude, climate);
      const offset = index * 4;
      pixels[offset] = Math.round(ao * 255);
      pixels[offset + 1] = Math.round(roughness * 255);
      pixels[offset + 2] = Math.round(metalness * 255);
      pixels[offset + 3] = 255;
    }
  }

  return pixels;
}

/**
 * Encodes a tangent-space normal map from the elevation grid.
 *
 * Elevation is clamped up to sea level first: an ocean is an equipotential
 * surface, so however rough the seafloor is, the water above it is flat.
 * Without this the bathymetry is embossed onto the water and the oceans read
 * as bumpy.
 */
function encodeNormal(
  elevation: Float32Array,
  width: number,
  height: number,
  seaLevel: number,
): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  const surfaceAt = (index: number): number => Math.max(elevation[index], seaLevel);

  for (let y = 0; y < height; y += 1) {
    const v = (y + 0.5) / height;
    const cosLatitude = Math.max(Math.cos((0.5 - v) * Math.PI), MIN_LATITUDE_COSINE);
    const up = Math.max(y - 1, 0);
    const down = Math.min(y + 1, height - 1);

    for (let x = 0; x < width; x += 1) {
      const left = (x - 1 + width) % width;
      const right = (x + 1) % width;

      const dx = ((surfaceAt(y * width + right) - surfaceAt(y * width + left)) * NORMAL_RELIEF_SCALE) / cosLatitude;
      const dy = (surfaceAt(down * width + x) - surfaceAt(up * width + x)) * NORMAL_RELIEF_SCALE;

      const length = Math.hypot(-dx, -dy, 1);
      const offset = (y * width + x) * 4;
      pixels[offset] = Math.round((-dx / length) * 0.5 * 255 + 127.5);
      pixels[offset + 1] = Math.round((-dy / length) * 0.5 * 255 + 127.5);
      pixels[offset + 2] = Math.round((1 / length) * 0.5 * 255 + 127.5);
      pixels[offset + 3] = 255;
    }
  }

  return pixels;
}

/** Decimated so the digest stays cheap while remaining sensitive to drift. */
export function signatureOf(pixels: Uint8ClampedArray): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < pixels.length; index += 401) {
    hash ^= pixels[index];
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function rasterizePlanet(climate: PlanetClimate, preset: PlanetLodPreset): PlanetRaster {
  const { width, height } = preset;
  const elevation = buildElevationGrid(climate, width, height);
  const albedo = encodeAlbedo(climate, elevation, width, height);

  const raster: PlanetRaster = {
    width,
    height,
    albedo,
    signature: signatureOf(albedo),
  };

  if (preset.includeNormal || preset.includeMaterial) {
    const normalWidth = Math.max(1, Math.round(width * preset.normalScale));
    const normalHeight = Math.max(1, Math.round(height * preset.normalScale));
    const detailElevation =
      normalWidth === width && normalHeight === height
        ? elevation
        : buildElevationGrid(climate, normalWidth, normalHeight);

    if (preset.includeNormal) {
      raster.normal = encodeNormal(detailElevation, normalWidth, normalHeight, climate.seaLevel);
    }
    if (preset.includeMaterial) {
      raster.material = encodeMaterial(climate, detailElevation, normalWidth, normalHeight);
    }
    raster.normalWidth = normalWidth;
    raster.normalHeight = normalHeight;
  }

  return raster;
}

/** Sampled for the GPU parity comparison, which cannot assert exact equality. */
export function sampleAlbedoAt(climate: PlanetClimate, u: number, v: number): readonly [number, number, number] {
  const [dx, dy, dz] = directionFromEquirect(u, v);
  const elevation = planetElevation(dx, dy, dz, climate);
  const [r, g, b] = planetAlbedo(elevation, dy, climate);
  return [clamp01(r), clamp01(g), clamp01(b)];
}

/** Samples the ORM triple at one equirect coordinate, for parity testing against the shader. */
export function sampleMaterialAt(climate: PlanetClimate, u: number, v: number): readonly [number, number, number] {
  const [dx, dy, dz] = directionFromEquirect(u, v);
  const elevation = planetElevation(dx, dy, dz, climate);
  const [r, g, b] = planetMaterial(elevation, dy, climate);
  return [clamp01(r), clamp01(g), clamp01(b)];
}
