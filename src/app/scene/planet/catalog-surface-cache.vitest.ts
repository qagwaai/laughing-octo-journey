import { TestBed } from '@angular/core/testing';
import { Texture, type WebGLRenderer } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CATALOG_SURFACE_BUDGET,
  CATALOG_SURFACE_LOAD,
  CATALOG_SURFACE_QUALITY,
  CatalogSurfaceCache,
} from './catalog-surface-cache';
import type { CatalogPlanetSurfaceResult, CatalogSurfaceLoadRequest } from './catalog-surface-loader';
import { estimateCatalogSurfaceBytes } from './catalog-surface-loader';
import type { ResolvablePlanetBody } from './planet-surface-resolver';
import { resolvePlanetSurfaceSource } from './planet-surface-resolver';
import { PLANET_CACHE_BAKE_FN, PlanetTextureCache } from './planet-texture-cache';

function body(key = 'earth', id = key): ResolvablePlanetBody {
  return {
    id,
    bodyType: key === 'luna' ? 'moon' : 'planet',
    surfaceArchetype: key === 'luna' ? 'rocky-moon' : 'rocky',
    catalogIdentity: { namespace: 'sol', key },
  };
}

function result(request: CatalogSurfaceLoadRequest): CatalogPlanetSurfaceResult {
  const albedo = new Texture<HTMLImageElement>();
  const normal = request.variant === 'preview' ? undefined : new Texture<HTMLImageElement>();
  return {
    source: 'catalog',
    request,
    albedo,
    normal,
    dispose: vi.fn(() => {
      albedo.dispose();
      normal?.dispose();
    }),
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function renderer(maxTextureSize: number): WebGLRenderer {
  return { capabilities: { maxTextureSize } } as WebGLRenderer;
}

function setup(quality: 'standard' | 'low' = 'standard') {
  const jobs: {
    request: CatalogSurfaceLoadRequest;
    deferred: ReturnType<typeof deferred<CatalogPlanetSurfaceResult>>;
  }[] = [];
  const load = vi.fn((request: CatalogSurfaceLoadRequest) => {
    const job = { request, deferred: deferred<CatalogPlanetSurfaceResult>() };
    jobs.push(job);
    return job.deferred.promise;
  });
  const bake = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: CATALOG_SURFACE_LOAD, useValue: load },
      { provide: CATALOG_SURFACE_QUALITY, useValue: () => quality },
      { provide: PLANET_CACHE_BAKE_FN, useValue: bake },
    ],
  });
  return { cache: TestBed.inject(CatalogSurfaceCache), facade: TestBed.inject(PlanetTextureCache), jobs, load, bake };
}

async function started() {
  await Promise.resolve();
}
async function settled() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

afterEach(() => TestBed.resetTestingModule());

describe('catalog surface cache', () => {
  it('loads only three previews for system view and bypasses procedural generation', async () => {
    const { cache, facade, jobs, bake } = setup();
    const bodies = [body('earth'), body('luna'), body('mars')];
    cache.retain(bodies.map((body) => ({ body, tier: 'l0' })));
    facade.requestMany(bodies, 'l0');
    await started();
    expect(jobs.map((job) => job.request.variant)).toEqual(['preview', 'preview', 'preview']);
    expect(bake).not.toHaveBeenCalled();
    for (const job of jobs) job.deferred.resolve(result(job.request));
    await settled();
    expect(facade.pending()).toBe(0);
    expect(facade.ready().size).toBe(3);
    expect(facade.get(bodies[0], 'l0')?.source).toBe('catalog');
  });

  it.each(['standard', 'low'] as const)('loads preview and only selected %s detail', async (quality) => {
    const { cache, jobs } = setup(quality);
    cache.retain([{ body: body(), tier: 'l1' }]);
    cache.request(body(), 'l1');
    await started();
    expect(jobs.map((job) => job.request.variant)).toEqual(['preview', quality]);
    expect(jobs[1].request.key).toContain(`earth-july-v3|${quality}|l1`);
    expect(cache.pending()).toBe(2);
  });

  it('downgrades standard to low when the renderer supports only 2K textures', async () => {
    const { cache, jobs } = setup();
    cache.request(body(), 'l1', renderer(2048));
    await started();
    expect(jobs.map((job) => job.request.variant)).toEqual(['preview', 'low']);
  });

  it('shows an explicit unsupported-dimension error while retaining the preview', async () => {
    const { cache, jobs } = setup();
    const gl = renderer(1024);
    cache.retain([{ body: body(), tier: 'l1' }], gl);
    cache.request(body(), 'l1', gl);
    await started();
    expect(jobs).toHaveLength(1);
    jobs[0].deferred.resolve(result(jobs[0].request));
    await settled();
    expect(cache.get(body(), 'l1', gl)?.request.variant).toBe('preview');
    expect(cache.issues()[0]).toMatchObject({ retryable: false });
    expect(cache.canRetry()).toBe(false);
  });

  it('deduplicates astronomical imagery without merging game body identities', async () => {
    const { cache, jobs } = setup();
    const a = body('earth', 'game-a');
    const b = body('earth', 'game-b');
    const releaseA = cache.retain([{ body: a, tier: 'l0' }]);
    cache.retain([{ body: b, tier: 'l0' }]);
    cache.request(a, 'l0');
    cache.request(b, 'l0');
    await started();
    expect(jobs).toHaveLength(1);
    releaseA();
    const image = result(jobs[0].request);
    jobs[0].deferred.resolve(image);
    await settled();
    expect(cache.get(a, 'l0')).toBe(image);
    expect(cache.get(b, 'l0')).toBe(image);
    expect(a.id).not.toBe(b.id);
  });

  it('keeps preview after detail failure and retries only the failed operation', async () => {
    const { cache, jobs, load } = setup();
    cache.retain([{ body: body(), tier: 'l1' }]);
    cache.request(body(), 'l1');
    await started();
    const preview = result(jobs[0].request);
    jobs[0].deferred.resolve(preview);
    jobs[1].deferred.reject(new Error('normal download failed'));
    await settled();
    expect(cache.get(body(), 'l1')).toBe(preview);
    expect(cache.pending()).toBe(0);
    expect(cache.issues()).toHaveLength(1);
    cache.request(body(), 'l1');
    expect(load).toHaveBeenCalledTimes(2);
    cache.retryActive();
    await started();
    expect(load).toHaveBeenCalledTimes(3);
    expect(jobs[2].request.variant).toBe('standard');
    const detail = result(jobs[2].request);
    jobs[2].deferred.resolve(detail);
    await settled();
    expect(cache.get(body(), 'l1')).toBe(detail);
    expect(cache.issues()).toEqual([]);
  });

  it('initial imagery failure never falls through to procedural generation', async () => {
    const { cache, facade, jobs, bake } = setup();
    cache.retain([{ body: body(), tier: 'l0' }]);
    facade.request(body(), 'l0');
    await started();
    jobs[0].deferred.reject(new Error('image not found'));
    await settled();
    expect(facade.get(body(), 'l0')).toBeNull();
    expect(bake).not.toHaveBeenCalled();
    expect(cache.issues()).toHaveLength(1);
  });

  it('disposes late completions after the final lease leaves', async () => {
    const { cache, jobs } = setup();
    const release = cache.retain([{ body: body(), tier: 'l0' }]);
    cache.request(body(), 'l0');
    await started();
    release();
    const late = result(jobs[0].request);
    jobs[0].deferred.resolve(late);
    await settled();
    expect(late.dispose).toHaveBeenCalledOnce();
    expect(cache.ready().size).toBe(0);
    expect(cache.pending()).toBe(0);
  });

  it('does not even start a download if its lease leaves before the load microtask', async () => {
    const { cache, load } = setup();
    const release = cache.retain([{ body: body(), tier: 'l0' }]);
    cache.request(body(), 'l0');
    release();
    await settled();
    expect(load).not.toHaveBeenCalled();
  });

  it('ignores an older completion on route re-entry and retains the fresh result', async () => {
    const { cache, jobs } = setup();
    const release = cache.retain([{ body: body(), tier: 'l0' }]);
    cache.request(body(), 'l0');
    await started();
    release();
    cache.retain([{ body: body(), tier: 'l0' }]);
    cache.request(body(), 'l0');
    await started();
    const stale = result(jobs[0].request);
    const fresh = result(jobs[1].request);
    jobs[0].deferred.resolve(stale);
    jobs[1].deferred.resolve(fresh);
    await settled();
    expect(stale.dispose).toHaveBeenCalledOnce();
    expect(cache.get(body(), 'l0')).toBe(fresh);
  });

  it('reuses ordinary image textures across renderer contexts without disposing active consumers', async () => {
    const { cache, jobs, load } = setup();
    cache.retain([{ body: body(), tier: 'l0' }], renderer(8192));
    cache.request(body(), 'l0', renderer(8192));
    await started();
    const image = result(jobs[0].request);
    jobs[0].deferred.resolve(image);
    await settled();
    cache.retain([{ body: body(), tier: 'l0' }], renderer(4096));
    expect(cache.request(body(), 'l0', renderer(4096))).toBe(image);
    expect(load).toHaveBeenCalledOnce();
    expect(image.dispose).not.toHaveBeenCalled();
  });

  it('evicts unused LRU detail using estimated bytes, not compressed file size', async () => {
    const { cache, jobs } = setup();
    const release = cache.retain([{ body: body('earth'), tier: 'l1' }]);
    cache.request(body('earth'), 'l1');
    await started();
    const earth = result(jobs[1].request);
    jobs.forEach((job) => job.deferred.resolve(job.request.variant === 'standard' ? earth : result(job.request)));
    await settled();
    release();
    cache.retain([{ body: body('mars'), tier: 'l1' }]);
    cache.request(body('mars'), 'l1');
    await started();
    expect(earth.dispose).toHaveBeenCalledOnce();
    jobs.slice(2).forEach((job) => job.deferred.resolve(result(job.request)));
    await settled();
    expect(cache.estimatedResidentBytes()).toBeLessThanOrEqual(CATALOG_SURFACE_BUDGET.standard);
    expect(cache.get(body('mars'), 'l1')?.request.variant).toBe('standard');
  });

  it('refuses a second active 4K set instead of disposing textures still used by another scene', async () => {
    const { cache, jobs } = setup();
    cache.retain([{ body: body('earth'), tier: 'l1' }]);
    cache.request(body('earth'), 'l1');
    await started();
    const earth = result(jobs[1].request);
    jobs[0].deferred.resolve(result(jobs[0].request));
    jobs[1].deferred.resolve(earth);
    await settled();
    cache.retain([{ body: body('mars'), tier: 'l1' }]);
    cache.request(body('mars'), 'l1');
    await started();
    expect(earth.dispose).not.toHaveBeenCalled();
    expect(jobs).toHaveLength(3); // Mars preview only.
    expect(cache.issues()[0].message).toContain('budget');
    expect(cache.estimatedResidentBytes()).toBeLessThanOrEqual(CATALOG_SURFACE_BUDGET.standard);
  });

  it('counts actual Luna normal dimensions and both preview/detail mip chains', () => {
    const selection = resolvePlanetSurfaceSource(body('luna'), 'l1');
    if (selection?.kind !== 'catalog') throw new Error('Luna catalog selection missing');
    expect(estimateCatalogSurfaceBytes(selection.request, 'standard')).toBe(
      Math.ceil((4096 * 2048 * 4 * 4) / 3) + Math.ceil((1024 * 512 * 4 * 4) / 3),
    );
  });

  it('clears resident entries and rejects in-flight publication on service teardown', async () => {
    const { cache, jobs } = setup();
    cache.request(body(), 'l1');
    await started();
    const preview = result(jobs[0].request);
    jobs[0].deferred.resolve(preview);
    await settled();
    cache.clear();
    const late = result(jobs[1].request);
    jobs[1].deferred.resolve(late);
    await settled();
    expect(preview.dispose).toHaveBeenCalledOnce();
    expect(late.dispose).toHaveBeenCalledOnce();
    expect(cache.ready().size).toBe(0);
    expect(cache.pending()).toBe(0);
  });
});
