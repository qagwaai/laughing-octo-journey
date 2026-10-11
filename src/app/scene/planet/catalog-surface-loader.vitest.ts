import { ClampToEdgeWrapping, NoColorSpace, RepeatWrapping, SRGBColorSpace, Texture, TextureLoader } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  estimateCatalogSurfaceBytes,
  loadCatalogSurface,
  type CatalogSurfaceLoadRequest,
} from './catalog-surface-loader';
import { resolvePlanetSurfaceSource } from './planet-surface-resolver';

function request(variant: 'preview' | 'low' | 'standard', key = 'earth'): CatalogSurfaceLoadRequest {
  const selection = resolvePlanetSurfaceSource(
    {
      id: key,
      bodyType: key === 'luna' ? 'moon' : 'planet',
      surfaceArchetype: key === 'luna' ? 'rocky-moon' : 'rocky',
      catalogIdentity: { namespace: 'sol', key },
    },
    variant === 'preview' ? 'l0' : 'l1',
  );
  if (selection?.kind !== 'catalog') throw new Error('Catalog request missing');
  return { ...selection.request, variant, estimatedBytes: estimateCatalogSurfaceBytes(selection.request, variant) };
}

function image(width: number, height: number): Texture<HTMLImageElement> {
  const element = document.createElement('img');
  element.width = width;
  element.height = height;
  const texture = new Texture(element);
  vi.spyOn(texture, 'dispose');
  return texture;
}

afterEach(() => vi.restoreAllMocks());

describe('catalog surface loader', () => {
  it('loads a same-origin preview with correct albedo upload orientation and wrapping', async () => {
    const albedo = image(512, 256);
    const load = vi.spyOn(TextureLoader.prototype, 'loadAsync').mockResolvedValue(albedo);
    const surface = await loadCatalogSurface(request('preview'));
    expect(load).toHaveBeenCalledExactlyOnceWith('textures/sol/earth-july-v2/earth-july-preview-albedo.jpg');
    expect(surface.source).toBe('catalog');
    expect(surface.normal).toBeUndefined();
    expect(surface.material).toBeUndefined();
    expect(albedo.colorSpace).toBe(SRGBColorSpace);
    expect(albedo.flipY).toBe(true);
    expect(albedo.wrapS).toBe(RepeatWrapping);
    expect(albedo.wrapT).toBe(ClampToEdgeWrapping);
    surface.dispose();
    expect(albedo.dispose).toHaveBeenCalledOnce();
  });

  it('loads only the selected detail tier and preserves linear normal semantics', async () => {
    const albedo = image(2048, 1024);
    const normal = image(1024, 512);
    const load = vi
      .spyOn(TextureLoader.prototype, 'loadAsync')
      .mockResolvedValueOnce(albedo)
      .mockResolvedValueOnce(normal);
    const surface = await loadCatalogSurface(request('low', 'mars'));
    expect(load.mock.calls.map(([url]) => url)).toEqual([
      'textures/sol/mars-v2/mars-low-albedo.jpg',
      'textures/sol/mars-v2/mars-low-normal.png',
    ]);
    expect(normal.colorSpace).toBe(NoColorSpace);
    expect(normal.flipY).toBe(true);
    expect(normal.wrapS).toBe(RepeatWrapping);
    expect(normal.wrapT).toBe(ClampToEdgeWrapping);
    surface.dispose();
    expect(albedo.dispose).toHaveBeenCalledOnce();
    expect(normal.dispose).toHaveBeenCalledOnce();
  });

  it('uses the accepted 1K Luna standard normal, not an invented 2K map', async () => {
    const load = vi
      .spyOn(TextureLoader.prototype, 'loadAsync')
      .mockResolvedValueOnce(image(4096, 2048))
      .mockResolvedValueOnce(image(1024, 512));
    const surface = await loadCatalogSurface(request('standard', 'luna'));
    expect(load.mock.calls[1][0]).toBe('textures/sol/luna-v3/luna-standard-normal.png');
    expect(surface.normal?.image.width).toBe(1024);
  });

  it('disposes a loaded albedo when the normal download fails and rejects explicitly', async () => {
    const albedo = image(2048, 1024);
    vi.spyOn(TextureLoader.prototype, 'loadAsync')
      .mockResolvedValueOnce(albedo)
      .mockRejectedValueOnce(new Error('HTTP 404'));
    await expect(loadCatalogSurface(request('low'))).rejects.toThrow('HTTP 404');
    expect(albedo.dispose).toHaveBeenCalledOnce();
  });

  it('rejects incorrect file dimensions and disposes the invalid texture', async () => {
    const bad = image(128, 64);
    vi.spyOn(TextureLoader.prototype, 'loadAsync').mockResolvedValueOnce(bad);
    await expect(loadCatalogSurface(request('preview'))).rejects.toThrow('Unexpected dimensions');
    expect(bad.dispose).toHaveBeenCalledOnce();
  });
});
