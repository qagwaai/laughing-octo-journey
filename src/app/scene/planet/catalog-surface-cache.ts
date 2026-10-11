import { computed, DestroyRef, inject, Injectable, InjectionToken, signal, untracked } from '@angular/core';
import type { WebGLRenderer } from 'three';
import type { PlanetLodTier } from '../../model/planet/planet-texture';
import { appLogger } from '../../services/logger';
import { selectRenderQuality, type RenderQuality } from '../render-quality';
import {
  estimateCatalogSurfaceBytes,
  loadCatalogSurface,
  type CatalogPlanetSurfaceResult,
  type CatalogSurfaceLoadRequest,
  type CatalogTextureVariant,
} from './catalog-surface-loader';
import {
  resolvePlanetSurfaceSource,
  type CatalogPlanetSurfaceRequest,
  type ResolvablePlanetBody,
} from './planet-surface-resolver';

export const CATALOG_SURFACE_LOAD = new InjectionToken('CATALOG_SURFACE_LOAD', {
  providedIn: 'root',
  factory: () => loadCatalogSurface,
});

function browserQuality(): RenderQuality {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'low';
  const connection: unknown = 'connection' in navigator ? navigator.connection : undefined;
  const saveData =
    typeof connection === 'object' && connection !== null && 'saveData' in connection && connection.saveData === true;
  return selectRenderQuality(window.innerWidth, navigator.hardwareConcurrency || 4, saveData);
}

export const CATALOG_SURFACE_QUALITY = new InjectionToken('CATALOG_SURFACE_QUALITY', {
  providedIn: 'root',
  factory: () => browserQuality,
});

export const CATALOG_SURFACE_BUDGET = { low: 32 * 1024 * 1024, standard: 96 * 1024 * 1024 } as const;

export interface CatalogSurfaceUse {
  body: ResolvablePlanetBody;
  tier: PlanetLodTier;
}

export interface CatalogSurfaceIssue {
  request: CatalogSurfaceLoadRequest;
  message: string;
  retryable: boolean;
}

interface PendingLoad {
  request: CatalogSurfaceLoadRequest;
}

@Injectable({ providedIn: 'root' })
export class CatalogSurfaceCache {
  private readonly load = inject(CATALOG_SURFACE_LOAD);
  private readonly chooseQuality = inject(CATALOG_SURFACE_QUALITY);
  readonly quality = signal(this.chooseQuality());
  private readonly entries = new Map<string, CatalogPlanetSurfaceResult>();
  private readonly loading = new Map<string, PendingLoad>();
  private readonly failures = new Map<string, CatalogSurfaceIssue>();
  private readonly leases = new Map<symbol, CatalogSurfaceLoadRequest[]>();
  private readonly revision = signal(0);
  private readonly readySignal = signal<ReadonlyMap<string, CatalogPlanetSurfaceResult>>(new Map());
  readonly ready = this.readySignal.asReadonly();
  readonly pending = computed(() => {
    this.revision();
    return this.loading.size;
  });
  readonly estimatedResidentBytes = computed(() => {
    this.ready();
    return this.residentBytes();
  });
  readonly active = computed(() => {
    this.revision();
    return [...new Map([...this.leases.values()].flat().map((request) => [request.key, request])).values()];
  });
  readonly issues = computed(() => {
    this.revision();
    const activeKeys = new Set(this.active().map((request) => request.key));
    return [...this.failures.values()].filter((issue) => activeKeys.has(issue.request.key));
  });
  readonly canRetry = computed(() => this.issues().some((issue) => issue.retryable));

  constructor() {
    if (typeof window !== 'undefined') {
      const resize = () => this.quality.set(this.chooseQuality());
      window.addEventListener('resize', resize);
      inject(DestroyRef).onDestroy(() => window.removeEventListener('resize', resize));
    }
    inject(DestroyRef).onDestroy(() => this.clear());
  }

  private resolve(
    body: ResolvablePlanetBody,
    tier: PlanetLodTier,
    renderer?: WebGLRenderer | null,
  ): CatalogSurfaceLoadRequest | null {
    const selection = resolvePlanetSurfaceSource(body, tier);
    if (selection?.kind !== 'catalog') return null;
    const maxSize = renderer?.capabilities?.maxTextureSize ?? 4096;
    const variant: CatalogTextureVariant =
      tier === 'l0' ? 'preview' : this.quality() === 'low' || maxSize < 4096 ? 'low' : 'standard';
    return this.withVariant(selection.request, variant);
  }

  private withVariant(request: CatalogPlanetSurfaceRequest, variant: CatalogTextureVariant): CatalogSurfaceLoadRequest {
    return {
      ...request,
      key: `catalog|${request.identity.namespace}|${request.identity.key}|${request.asset.assetVersion}|${variant}|${request.tier}`,
      variant,
      estimatedBytes: estimateCatalogSurfaceBytes(request, variant),
    };
  }

  retain(uses: readonly CatalogSurfaceUse[], renderer?: WebGLRenderer | null): () => void {
    const requests: CatalogSurfaceLoadRequest[] = [];
    for (const use of uses) {
      const request = this.resolve(use.body, use.tier, renderer);
      if (!request) continue;
      requests.push(request);
      if (use.tier === 'l1') {
        const preview = this.resolve(use.body, 'l0', renderer);
        if (preview) requests.push(preview);
        const low = this.withVariant(request, 'low');
        if (this.entries.has(low.key)) requests.push(low);
      }
    }
    const id = Symbol('catalog-surface-consumer');
    this.leases.set(id, requests);
    untracked(() => this.publish());
    return () => {
      this.leases.delete(id);
      const pins = this.pinnedKeys();
      for (const key of this.loading.keys()) {
        if (!pins.has(key)) this.loading.delete(key);
      }
      for (const key of this.failures.keys()) {
        if (!pins.has(key)) this.failures.delete(key);
      }
      this.makeRoom(0);
      this.publish();
    };
  }

  get(
    body: ResolvablePlanetBody,
    tier: PlanetLodTier,
    renderer?: WebGLRenderer | null,
  ): CatalogPlanetSurfaceResult | null {
    const request = this.resolve(body, tier, renderer);
    if (!request) return null;
    const exact = this.peek(request.key);
    if (exact || tier === 'l0') return exact;
    const low = this.peek(this.withVariant(request, 'low').key);
    const preview = this.resolve(body, 'l0', renderer);
    return low ?? (preview ? this.peek(preview.key) : null);
  }

  request(
    body: ResolvablePlanetBody,
    tier: PlanetLodTier,
    renderer?: WebGLRenderer | null,
  ): CatalogPlanetSurfaceResult | null {
    const request = this.resolve(body, tier, renderer);
    if (!request) return null;
    if (tier === 'l1') this.request(body, 'l0', renderer);
    if (
      (renderer?.capabilities?.maxTextureSize ?? 4096) <
      (request.variant === 'preview' ? 512 : request.variant === 'low' ? 2048 : 4096)
    ) {
      this.fail(request, new Error('Renderer maximum texture size is insufficient for the selected surface'), false);
    } else {
      this.enqueue(request);
    }
    return this.get(body, tier, renderer);
  }

  retryActive(): void {
    const active = this.active();
    for (const request of active) {
      if (!this.failures.get(request.key)?.retryable) continue;
      if (!this.failures.delete(request.key)) continue;
      this.enqueue(request);
    }
    this.publish();
  }

  clear(): void {
    this.loading.clear();
    this.failures.clear();
    this.leases.clear();
    for (const result of this.entries.values()) result.dispose();
    this.entries.clear();
    this.publish();
  }

  private enqueue(request: CatalogSurfaceLoadRequest): void {
    if (this.entries.has(request.key) || this.loading.has(request.key) || this.failures.has(request.key)) return;
    if (!this.makeRoom(request.estimatedBytes)) {
      this.fail(request, new Error('Catalog surface residency budget is exhausted by active textures'));
      return;
    }
    const pending: PendingLoad = { request };
    this.loading.set(request.key, pending);
    this.publish();
    // Regular image textures can upload independently into a new renderer.
    // A completion after its final consumer leaves must never repopulate the cache.
    Promise.resolve()
      .then(() => (this.loading.get(request.key) === pending ? this.load(request) : null))
      .then(
        (result) => {
          if (!result) return;
          if (this.loading.get(request.key) !== pending) {
            result.dispose();
            return;
          }
          this.loading.delete(request.key);
          this.entries.set(request.key, result);
          this.publish();
        },
        (error: unknown) => {
          if (this.loading.get(request.key) !== pending) return;
          this.loading.delete(request.key);
          this.fail(request, error);
        },
      );
  }

  private fail(request: CatalogSurfaceLoadRequest, error: unknown, retryable = true): void {
    if (this.failures.has(request.key)) return;
    const message = error instanceof Error ? error.message : String(error);
    appLogger.error('[catalog-surface-load]', { key: request.key, bodyId: request.bodyId, message });
    this.failures.set(request.key, { request, message, retryable });
    this.publish();
  }

  private pinnedKeys(): Set<string> {
    return new Set([...this.leases.values()].flat().map((request) => request.key));
  }

  private residentBytes(): number {
    return [...this.entries.values()].reduce((bytes, result) => bytes + result.request.estimatedBytes, 0);
  }

  private makeRoom(incoming: number): boolean {
    const pins = this.pinnedKeys();
    const reserved = [...this.loading.values()].reduce((bytes, pending) => bytes + pending.request.estimatedBytes, 0);
    const budget = CATALOG_SURFACE_BUDGET[this.quality()];
    for (const [key, result] of this.entries) {
      if (this.residentBytes() + reserved + incoming <= budget) break;
      if (pins.has(key)) continue;
      result.dispose();
      this.entries.delete(key);
    }
    return this.residentBytes() + reserved + incoming <= budget;
  }

  private peek(key: string): CatalogPlanetSurfaceResult | null {
    const result = this.entries.get(key);
    if (!result) return null;
    this.entries.delete(key);
    this.entries.set(key, result);
    return result;
  }

  private publish(): void {
    this.readySignal.set(new Map(this.entries));
    this.revision.update((value) => value + 1);
  }
}
