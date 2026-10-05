import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import type { PlanetBakeOptions, PlanetBakeResult } from './planet-bake';
import type { SurfaceArchetype } from '../../model/celestial-classification';
import type { ResolvablePlanetBody } from './planet-surface-resolver';
import { isTexturableBody, resolvePlanetSurface } from './planet-surface-resolver';
import {
  PLANET_CACHE_BAKE_FN,
  PLANET_CACHE_L1_LIMIT,
  PLANET_CACHE_SCHEDULER,
  PlanetTextureCache,
} from './planet-texture-cache';

/** Collects scheduler callbacks so tests can step the queue deterministically. */
class ManualScheduler {
  private readonly pending: (() => void)[] = [];

  readonly schedule = (callback: () => void): void => {
    this.pending.push(callback);
  };

  /** Runs queued ticks until the queue is empty, with a guard against runaway loops. */
  flush(maxTicks = 100): void {
    let ticks = 0;
    while (this.pending.length > 0 && ticks < maxTicks) {
      const next = this.pending.shift();
      next?.();
      ticks += 1;
    }
  }
}

function makeBody(id: string, bodyType = 'planet'): ResolvablePlanetBody {
  const surfaceArchetype: SurfaceArchetype =
    bodyType === 'star' ? 'star' : bodyType === 'moon' ? 'rocky-moon' : bodyType === 'asteroid' ? 'asteroid' : 'rocky';
  return { id, bodyType, surfaceArchetype, displayName: id };
}

interface Harness {
  cache: PlanetTextureCache;
  scheduler: ManualScheduler;
  disposed: string[];
  bake: ReturnType<typeof vi.fn>;
}

function setup(options: { failOn?: string; source?: PlanetBakeResult['source'] } = {}): Harness {
  const scheduler = new ManualScheduler();
  const disposed: string[] = [];

  const bake = vi.fn((bakeOptions: PlanetBakeOptions): PlanetBakeResult => {
    if (options.failOn && bakeOptions.bodyId === options.failOn) {
      throw new Error('bake failed');
    }
    return {
      albedo: { isTexture: true } as unknown as PlanetBakeResult['albedo'],
      source: options.source ?? 'gpu',
      climate: { archetype: 'terran' } as unknown as PlanetBakeResult['climate'],
      dispose: () => disposed.push(`${bakeOptions.bodyId}:${bakeOptions.tier}`),
    };
  });

  TestBed.configureTestingModule({
    providers: [
      { provide: PLANET_CACHE_BAKE_FN, useValue: bake },
      { provide: PLANET_CACHE_SCHEDULER, useValue: scheduler.schedule },
    ],
  });

  return { cache: TestBed.inject(PlanetTextureCache), scheduler, disposed, bake };
}

/** The cache downgrades to L0 without a WebGL2 renderer, so tests supply a stub. */
function gpuRenderer() {
  class FakeWebGL2RenderingContext {}
  vi.stubGlobal('WebGL2RenderingContext', FakeWebGL2RenderingContext);
  return { getContext: () => new FakeWebGL2RenderingContext() } as never;
}

describe('planet surface resolver', () => {
  it('treats planets and moons as texturable and everything else as not', () => {
    expect(isTexturableBody(makeBody('a', 'planet'))).toBe(true);
    expect(isTexturableBody(makeBody('b', 'moon'))).toBe(true);
    expect(isTexturableBody(makeBody('c', 'star'))).toBe(false);
    expect(isTexturableBody(makeBody('d', 'asteroid'))).toBe(false);
    expect(isTexturableBody(makeBody('e', 'station'))).toBe(false);
    expect(isTexturableBody(null)).toBe(false);
  });

  it('rejects noncanonical body types instead of inferring a renderer', () => {
    expect(isTexturableBody(makeBody('a', '  Planet '))).toBe(false);
  });

  it('builds keys that separate tiers and bodies', () => {
    const a = resolvePlanetSurface(makeBody('alpha'), 'l0');
    const b = resolvePlanetSurface(makeBody('alpha'), 'l1');
    const c = resolvePlanetSurface(makeBody('beta'), 'l0');

    expect(a?.key).not.toEqual(b?.key);
    expect(a?.key).not.toEqual(c?.key);
    expect(a?.key).toContain('alpha');
  });

  it('builds keys that separate archetypes for the same body and tier', () => {
    const rocky = resolvePlanetSurface(
      { id: 'same-id', bodyType: 'planet', surfaceArchetype: 'rocky' },
      'l0',
    );
    const ocean = resolvePlanetSurface(
      { id: 'same-id', bodyType: 'planet', surfaceArchetype: 'ocean' },
      'l0',
    );

    expect(rocky?.key).not.toBe(ocean?.key);
    expect(ocean?.fallbackReason).toContain('ocean');
  });

  it('returns null for untexturable bodies and bodies without an id', () => {
    expect(resolvePlanetSurface(makeBody('sun', 'star'), 'l0')).toBeNull();
    expect(resolvePlanetSurface({ id: '', bodyType: 'planet' }, 'l0')).toBeNull();
  });
});

describe('planet texture cache', () => {
  it('bakes queued bodies and exposes them once the scheduler runs', () => {
    const { cache, scheduler } = setup();

    expect(cache.request(makeBody('alpha'), 'l0')).toBeNull();
    expect(cache.get(makeBody('alpha'), 'l0')).toBeNull();

    scheduler.flush();

    expect(cache.get(makeBody('alpha'), 'l0')).not.toBeNull();
  });

  it('does not bake untexturable bodies', () => {
    const { cache, scheduler, bake } = setup();

    cache.requestMany([makeBody('sun', 'star'), makeBody('rock', 'asteroid')], 'l0');
    scheduler.flush();

    expect(bake).not.toHaveBeenCalled();
  });

  it('bakes a given body only once across repeated requests', () => {
    const { cache, scheduler, bake } = setup();

    cache.request(makeBody('alpha'), 'l0');
    cache.request(makeBody('alpha'), 'l0');
    scheduler.flush();
    cache.request(makeBody('alpha'), 'l0');
    scheduler.flush();

    expect(bake).toHaveBeenCalledTimes(1);
  });

  it('reports progress across a batch and settles at idle', () => {
    const { cache, scheduler } = setup();

    expect(cache.progress()).toBe(1);
    expect(cache.isBaking()).toBe(false);

    cache.requestMany([makeBody('a'), makeBody('b'), makeBody('c')], 'l0');

    expect(cache.isBaking()).toBe(true);
    expect(cache.pending()).toBe(3);
    expect(cache.progress()).toBeLessThan(1);

    scheduler.flush();

    expect(cache.isBaking()).toBe(false);
    expect(cache.progress()).toBe(1);
  });

  it('evicts and disposes the least recently used L1 entry beyond the limit', () => {
    const { cache, scheduler, disposed } = setup();
    const renderer = gpuRenderer();

    const ids = ['p1', 'p2', 'p3', 'p4'];
    for (const id of ids) {
      cache.request(makeBody(id), 'l1', renderer);
      scheduler.flush();
    }

    expect(PLANET_CACHE_L1_LIMIT).toBe(3);
    expect(disposed).toEqual(['p1:l1']);
    expect(cache.get(makeBody('p1'), 'l1')).toBeNull();
    expect(cache.get(makeBody('p4'), 'l1')).not.toBeNull();
  });

  it('keeps a recently read entry resident by refreshing its LRU position', () => {
    const { cache, scheduler, disposed } = setup();
    const renderer = gpuRenderer();

    for (const id of ['p1', 'p2', 'p3']) {
      cache.request(makeBody(id), 'l1', renderer);
      scheduler.flush();
    }

    // Reading p1 should make p2 the least recently used instead.
    cache.get(makeBody('p1'), 'l1');

    cache.request(makeBody('p4'), 'l1', renderer);
    scheduler.flush();

    expect(disposed).toEqual(['p2:l1']);
    expect(cache.get(makeBody('p1'), 'l1')).not.toBeNull();
  });

  it('does not evict L0 entries when L1 is under pressure', () => {
    const { cache, scheduler, disposed } = setup();
    const renderer = gpuRenderer();

    cache.requestMany([makeBody('a'), makeBody('b'), makeBody('c'), makeBody('d')], 'l0', renderer);
    scheduler.flush();
    for (const id of ['p1', 'p2', 'p3', 'p4']) {
      cache.request(makeBody(id), 'l1', renderer);
      scheduler.flush();
    }

    expect(disposed).toEqual(['p1:l1']);
    expect(cache.get(makeBody('a'), 'l0')).not.toBeNull();
  });

  it('falls back to the L0 surface while an L1 bake is still pending', () => {
    const { cache, scheduler } = setup();
    const renderer = gpuRenderer();

    cache.request(makeBody('alpha'), 'l0', renderer);
    scheduler.flush();

    expect(cache.get(makeBody('alpha'), 'l1')).not.toBeNull();
  });

  it('downgrades to L0 when no WebGL2 renderer is available', () => {
    const { cache, scheduler, bake } = setup();
    vi.stubGlobal('WebGL2RenderingContext', undefined);

    cache.request(makeBody('alpha'), 'l1', null);
    scheduler.flush();

    expect(bake).toHaveBeenCalledTimes(1);
    expect(bake.mock.calls[0][0].tier).toBe('l0');
  });

  it('survives a failing bake without wedging the queue or retrying forever', () => {
    const { cache, scheduler, bake } = setup({ failOn: 'broken' });

    cache.requestMany([makeBody('broken'), makeBody('healthy')], 'l0');
    scheduler.flush();

    expect(cache.get(makeBody('broken'), 'l0')).toBeNull();
    expect(cache.get(makeBody('healthy'), 'l0')).not.toBeNull();
    expect(cache.isBaking()).toBe(false);

    const callsAfterFirstPass = bake.mock.calls.length;
    cache.request(makeBody('broken'), 'l0');
    scheduler.flush();
    expect(bake).toHaveBeenCalledTimes(callsAfterFirstPass);
  });

  it('publishes a new map identity per completion so templates recompute', () => {
    const { cache, scheduler } = setup();

    const initial = cache.ready();
    cache.request(makeBody('alpha'), 'l0');
    scheduler.flush();

    expect(cache.ready()).not.toBe(initial);
    expect(cache.ready().size).toBe(1);
  });

  it('disposes everything on clear', () => {
    const { cache, scheduler, disposed } = setup();

    cache.requestMany([makeBody('a'), makeBody('b')], 'l0');
    scheduler.flush();
    cache.clear();

    expect(disposed).toEqual(['a:l0', 'b:l0']);
    expect(cache.ready().size).toBe(0);
    expect(cache.get(makeBody('a'), 'l0')).toBeNull();
  });

  // Each <ngt-canvas> owns its own WebGL context. Reusing a GPU texture across
  // that boundary renders the body pure black, which is silent at runtime.
  it('discards GPU textures when a different renderer takes over', () => {
    const { cache, scheduler, disposed, bake } = setup();

    cache.request(makeBody('alpha'), 'l0', gpuRenderer());
    scheduler.flush();
    expect(cache.get(makeBody('alpha'), 'l0')).not.toBeNull();
    expect(bake).toHaveBeenCalledTimes(1);

    cache.request(makeBody('alpha'), 'l0', gpuRenderer());

    expect(disposed).toEqual(['alpha:l0']);
    expect(cache.get(makeBody('alpha'), 'l0')).toBeNull();

    scheduler.flush();

    expect(bake).toHaveBeenCalledTimes(2);
    expect(cache.get(makeBody('alpha'), 'l0')).not.toBeNull();
  });

  it('keeps CPU textures across a renderer change', () => {
    const { cache, scheduler, disposed, bake } = setup({ source: 'cpu' });

    cache.request(makeBody('alpha'), 'l0', gpuRenderer());
    scheduler.flush();

    cache.request(makeBody('alpha'), 'l0', gpuRenderer());

    expect(disposed).toEqual([]);
    expect(bake).toHaveBeenCalledTimes(1);
    expect(cache.get(makeBody('alpha'), 'l0')).not.toBeNull();
  });

  it('retains textures while the renderer stays the same', () => {
    const { cache, scheduler, disposed, bake } = setup();
    const renderer = gpuRenderer();

    cache.request(makeBody('alpha'), 'l0', renderer);
    scheduler.flush();
    cache.request(makeBody('alpha'), 'l0', renderer);
    scheduler.flush();

    expect(disposed).toEqual([]);
    expect(bake).toHaveBeenCalledTimes(1);
  });
});
