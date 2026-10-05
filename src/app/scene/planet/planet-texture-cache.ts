/**
 * Shared cache and scheduler for baked planet surfaces.
 *
 * Two scenes consume generated surfaces: the system view, which needs a cheap
 * texture for every body at once, and the detail view, which needs one
 * expensive texture for whichever body has focus. Both go through this service
 * so a body baked in one view is still warm in the other.
 *
 * Bakes are time-sliced. Baking sixteen bodies in a single frame would trade
 * the shimmer problem the generator exists to solve for a hitch problem, so the
 * queue yields once it has spent its per-frame budget.
 */
import { computed, inject, Injectable, InjectionToken, signal } from '@angular/core';
import type { WebGLRenderer } from 'three';
import type { PlanetLodTier } from '../../model/planet/planet-texture';
import { appLogger } from '../../services/logger';
import { bakePlanetTextures as _bakePlanetTextures, type PlanetBakeResult, supportsGpuBake } from './planet-bake';
import { type PlanetSurfaceRequest, type ResolvablePlanetBody, resolvePlanetSurface } from './planet-surface-resolver';

export const PLANET_CACHE_BAKE_FN = new InjectionToken('PLANET_CACHE_BAKE_FN', {
  providedIn: 'root',
  factory: () => _bakePlanetTextures,
});

export type PlanetCacheScheduler = (callback: () => void) => void;

/**
 * Drives the queue. Injectable so tests can step the scheduler by hand instead
 * of waiting on animation frames.
 */
export const PLANET_CACHE_SCHEDULER = new InjectionToken<PlanetCacheScheduler>('PLANET_CACHE_SCHEDULER', {
  providedIn: 'root',
  factory: (): PlanetCacheScheduler => {
    if (typeof requestAnimationFrame === 'function') {
      return (callback) => {
        requestAnimationFrame(() => callback());
      };
    }
    return (callback) => {
      setTimeout(callback, 0);
    };
  },
});

/** Milliseconds of baking allowed per scheduler tick before yielding. */
export const PLANET_CACHE_FRAME_BUDGET_MS = 8;

/**
 * L0 is roughly 171 KiB with mipmaps, so this ceiling is about 11 MiB and
 * exists only to stop unbounded growth across many visited systems.
 */
export const PLANET_CACHE_L0_LIMIT = 64;

/** L1 is roughly 21 MiB per body, so only a few may be resident. */
export const PLANET_CACHE_L1_LIMIT = 3;

interface QueueEntry {
  request: PlanetSurfaceRequest;
  renderer: WebGLRenderer | null;
}

function limitForTier(tier: PlanetLodTier): number {
  return tier === 'l1' ? PLANET_CACHE_L1_LIMIT : PLANET_CACHE_L0_LIMIT;
}

@Injectable({ providedIn: 'root' })
export class PlanetTextureCache {
  private readonly bake = inject(PLANET_CACHE_BAKE_FN);
  private readonly schedule = inject(PLANET_CACHE_SCHEDULER);

  /** Insertion order is the LRU order; a cache hit re-inserts to mark it fresh. */
  private readonly entries = new Map<string, PlanetBakeResult>();
  private readonly queue: QueueEntry[] = [];
  private readonly queued = new Set<string>();
  private readonly failed = new Set<string>();
  private readonly reportedFallbacks = new Set<string>();
  private ticking = false;

  /**
   * The renderer that produced the resident GPU textures.
   *
   * Each `<ngt-canvas>` owns its own WebGLRenderer and therefore its own WebGL
   * context. A texture baked into one context is a dead handle in another, so
   * moving between the system view and the detail view must not reuse GPU
   * entries across that boundary — doing so renders the body pure black.
   */
  private gpuOwner: WebGLRenderer | null = null;

  private readonly readySignal = signal<ReadonlyMap<string, PlanetBakeResult>>(new Map());
  private readonly enqueuedCount = signal(0);
  private readonly settledCount = signal(0);

  /** Baked surfaces by cache key. A new map identity is published per completion. */
  readonly ready = this.readySignal.asReadonly();

  readonly pending = computed(() => Math.max(0, this.enqueuedCount() - this.settledCount()));
  readonly isBaking = computed(() => this.pending() > 0);

  /** 0 to 1 across the current batch; 1 when idle so consumers can hide the indicator. */
  readonly progress = computed(() => {
    const total = this.enqueuedCount();
    if (total <= 0) return 1;
    return Math.min(1, this.settledCount() / total);
  });

  /**
   * Without a WebGL2 renderer the bake runs on the CPU, where L1 costs seconds
   * and would block the main thread. Such callers are served L0 instead, which
   * is cheap enough to run inline. Resolving this before the cache key is built
   * keeps keys honest about what they actually hold.
   */
  private effectiveTier(tier: PlanetLodTier, renderer?: WebGLRenderer | null): PlanetLodTier {
    return supportsGpuBake(renderer) ? tier : 'l0';
  }

  /**
   * Returns the best surface currently resident for a body.
   *
   * Falls back to L0 when the requested tier is not ready, so the detail view
   * can show a body's cheap texture immediately while its L1 bake is still
   * queued, and so no-GPU callers still get the surface they were downgraded to.
   */
  get(body: ResolvablePlanetBody | null | undefined, tier: PlanetLodTier): PlanetBakeResult | null {
    const request = resolvePlanetSurface(body, tier);
    if (!request) return null;

    const exact = this.peek(request.key);
    if (exact) return exact;

    if (tier === 'l0') return null;
    const fallback = resolvePlanetSurface(body, 'l0');
    return fallback ? this.peek(fallback.key) : null;
  }

  /**
   * Queues a bake if the body is texturable and not already cached, queued or
   * known to have failed. Returns the cached result when one is already warm.
   */
  request(
    body: ResolvablePlanetBody | null | undefined,
    tier: PlanetLodTier,
    renderer?: WebGLRenderer | null,
  ): PlanetBakeResult | null {
    this.adoptRenderer(renderer ?? null);

    const request = resolvePlanetSurface(body, this.effectiveTier(tier, renderer));
    if (!request) return null;
    if (request.fallbackReason && !this.reportedFallbacks.has(request.key)) {
      this.reportedFallbacks.add(request.key);
      appLogger.warn('[celestial-appearance-fallback]', {
        bodyId: request.bodyId,
        surfaceArchetype: request.surfaceArchetype,
        renderer: request.archetype,
        reason: request.fallbackReason,
      });
    }

    const cached = this.peek(request.key);
    if (cached) return cached;

    if (this.queued.has(request.key) || this.failed.has(request.key)) {
      return null;
    }

    this.queued.add(request.key);
    this.queue.push({ request, renderer: renderer ?? null });
    this.enqueuedCount.update((count) => count + 1);
    this.startTicking();
    return null;
  }

  requestMany(bodies: readonly ResolvablePlanetBody[], tier: PlanetLodTier, renderer?: WebGLRenderer | null): void {
    for (const body of bodies) {
      this.request(body, tier, renderer);
    }
  }

  /** Test and teardown hook; disposes every resident texture. */
  clear(): void {
    for (const result of this.entries.values()) {
      result.dispose();
    }
    this.entries.clear();
    this.queue.length = 0;
    this.queued.clear();
    this.failed.clear();
    this.reportedFallbacks.clear();
    this.readySignal.set(new Map());
    this.enqueuedCount.set(0);
    this.settledCount.set(0);
    this.gpuOwner = null;
  }

  /**
   * Drops GPU entries owned by a previous renderer.
   *
   * CPU bakes are plain `DataTexture`s and survive a context change, so they
   * are kept. Queued work for the old renderer is dropped too: rendering into
   * a stale renderer would either throw or silently produce nothing.
   */
  private adoptRenderer(renderer: WebGLRenderer | null): void {
    if (!renderer || renderer === this.gpuOwner) {
      if (renderer) this.gpuOwner = renderer;
      return;
    }

    this.gpuOwner = renderer;

    for (const [key, result] of [...this.entries]) {
      if (result.source !== 'gpu') continue;
      result.dispose();
      this.entries.delete(key);
    }

    for (const entry of this.queue) {
      this.queued.delete(entry.request.key);
    }
    this.queue.length = 0;

    // Previously failed bakes may simply have hit a dying context, so let the
    // new one try again.
    this.failed.clear();
    this.readySignal.set(new Map(this.entries));
  }

  private peek(key: string): PlanetBakeResult | null {
    const cached = this.entries.get(key);
    if (!cached) return null;

    // Re-insert so this key becomes the most recently used.
    this.entries.delete(key);
    this.entries.set(key, cached);
    return cached;
  }

  private startTicking(): void {
    if (this.ticking) return;
    this.ticking = true;
    this.schedule(() => this.drain());
  }

  private drain(): void {
    const startedAt = Date.now();
    let published = false;

    // Always complete at least one entry so the queue cannot stall when a
    // single bake costs more than the whole frame budget.
    do {
      const entry = this.queue.shift();
      if (!entry) break;

      this.queued.delete(entry.request.key);
      if (this.runBake(entry)) {
        published = true;
      }
      this.settledCount.update((count) => count + 1);
    } while (this.queue.length > 0 && Date.now() - startedAt < PLANET_CACHE_FRAME_BUDGET_MS);

    if (published) {
      this.readySignal.set(new Map(this.entries));
    }

    if (this.queue.length > 0) {
      this.schedule(() => this.drain());
      return;
    }

    this.ticking = false;
    // The batch is done; reset the counters so the next batch reports from zero.
    this.enqueuedCount.set(0);
    this.settledCount.set(0);
  }

  private runBake(entry: QueueEntry): boolean {
    const { request, renderer } = entry;

    try {
      const result = this.bake({
        bodyId: request.bodyId,
        tier: request.tier,
        archetype: request.archetype,
        surfaceArchetype: request.surfaceArchetype,
        renderer,
      });
      this.entries.set(request.key, result);
      this.evict(request.tier);
      return true;
    } catch {
      // A failed bake must not wedge the queue or retry forever; the body keeps
      // its untextured material.
      this.failed.add(request.key);
      return false;
    }
  }

  private evict(tier: PlanetLodTier): void {
    const limit = limitForTier(tier);
    const keysForTier = [...this.entries.keys()].filter((key) => keyTier(key) === tier);

    let excess = keysForTier.length - limit;
    for (const key of keysForTier) {
      if (excess <= 0) break;
      const evicted = this.entries.get(key);
      if (evicted) {
        evicted.dispose();
        this.entries.delete(key);
      }
      excess -= 1;
    }
  }
}

/** Cache keys are `version|archetype|tier|bodyId`. */
function keyTier(key: string): string {
  return key.split('|')[2] ?? '';
}
