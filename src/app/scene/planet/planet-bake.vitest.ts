import { DataTexture, NoColorSpace, RepeatWrapping, SRGBColorSpace, type Texture } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlanetLodPreset } from '../../model/planet/planet-texture';
import { bakePlanetTextures, supportsGpuBake } from './planet-bake';

/** Keeps these tests off the multi-second 2048x1024 L0/L1 raster; PLANET_LOD sizes are asserted in the model suite. */
const NORMAL_PRESET: PlanetLodPreset = {
  width: 64,
  height: 32,
  includeNormal: true,
  includeMaterial: true,
  normalScale: 0.5,
};

interface TextureImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** three types `Texture.image` as unknown; the CPU path always yields raw pixel data. */
function imageOf(texture: Texture): TextureImage {
  return texture.image as TextureImage;
}

const originalWebGL2 = (globalThis as Record<string, unknown>)['WebGL2RenderingContext'];

afterEach(() => {
  (globalThis as Record<string, unknown>)['WebGL2RenderingContext'] = originalWebGL2;
});

describe('planet bake capability detection', () => {
  it('reports no GPU support without a renderer', () => {
    expect(supportsGpuBake(undefined)).toBe(false);
    expect(supportsGpuBake(null)).toBe(false);
  });

  it('reports no GPU support when the context is not WebGL2', () => {
    class FakeWebGL2Context {}
    (globalThis as Record<string, unknown>)['WebGL2RenderingContext'] = FakeWebGL2Context;
    const renderer = { getContext: () => ({}) } as never;

    expect(supportsGpuBake(renderer)).toBe(false);
  });

  it('reports GPU support for a WebGL2 context', () => {
    class FakeWebGL2Context {}
    (globalThis as Record<string, unknown>)['WebGL2RenderingContext'] = FakeWebGL2Context;
    const renderer = { getContext: () => new FakeWebGL2Context() } as never;

    expect(supportsGpuBake(renderer)).toBe(true);
  });
});

describe('planet bake CPU fallback', () => {
  it('falls back to the CPU reference when WebGL2 is unavailable', () => {
    const result = bakePlanetTextures({ bodyId: 'fallback-body', tier: 'l0' });

    expect(result.source).toBe('cpu');
    expect(result.albedo).toBeInstanceOf(DataTexture);
    expect(imageOf(result.albedo).width).toBe(256);
    expect(imageOf(result.albedo).height).toBe(128);
    expect(result.normal).toBeUndefined();
    result.dispose();
  });

  it('configures the albedo texture for equirectangular sampling', () => {
    const result = bakePlanetTextures({ bodyId: 'sampling-body', tier: 'l0' });

    expect(result.albedo.colorSpace).toBe(SRGBColorSpace);
    expect(result.albedo.wrapS).toBe(RepeatWrapping);
    expect(result.albedo.generateMipmaps).toBe(true);
    result.dispose();
  });

  it('exposes the derived climate alongside the textures', () => {
    const result = bakePlanetTextures({ bodyId: 'climate-body', tier: 'l0' });

    expect(result.climate.archetype).toBe('terran');
    expect(result.climate.seed).toBeGreaterThan(0);
    result.dispose();
  });

  it('is deterministic for a given body id', () => {
    const first = bakePlanetTextures({ bodyId: 'repeat-body', tier: 'l0' });
    const second = bakePlanetTextures({ bodyId: 'repeat-body', tier: 'l0' });

    expect(Array.from(imageOf(second.albedo).data)).toEqual(Array.from(imageOf(first.albedo).data));
    first.dispose();
    second.dispose();
  });

  it('releases both textures on dispose', () => {
    const result = bakePlanetTextures({ bodyId: 'dispose-body', preset: NORMAL_PRESET });
    const albedoSpy = vi.spyOn(result.albedo, 'dispose');
    const normalSpy = vi.spyOn(result.normal as DataTexture, 'dispose');

    result.dispose();

    expect(albedoSpy).toHaveBeenCalledOnce();
    expect(normalSpy).toHaveBeenCalledOnce();
  });

  it('bakes a half-resolution linear normal map when the preset asks for one', () => {
    const result = bakePlanetTextures({ bodyId: 'detail-body', preset: NORMAL_PRESET });
    const normal = result.normal;
    if (!normal) throw new Error('expected a normal map');

    expect(imageOf(result.albedo).width).toBe(64);
    expect(imageOf(normal).width).toBe(32);
    expect(imageOf(normal).height).toBe(16);
    expect(normal.colorSpace).toBe(NoColorSpace);
    result.dispose();
  });
});
