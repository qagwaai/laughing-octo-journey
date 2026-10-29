import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import type { ViewerBody } from '../../model/solar-system-get';
import { appLogger } from '../../services/logger';
import { isCygnusX1BlackHole } from '../viewer/cygnus-x1-viewer-profile';
import { mapBodiesToRendered } from '../viewer/viewer-system-scene';
import { isTexturableBody, resolvePlanetSurface, resolvePlanetSurfaceSource } from './planet-surface-resolver';
import { PLANET_CACHE_BAKE_FN, PLANET_CACHE_SCHEDULER, PlanetTextureCache } from './planet-texture-cache';

describe('black-hole surface exclusion', () => {
  it.each([
    { namespace: 'cygnus-x1', key: 'black-hole' },
    { namespace: 'unsupported', key: 'black-hole' },
    null,
    undefined,
  ])('never bakes planetary terrain for catalog identity %j', (catalogIdentity) => {
    const body: ViewerBody = {
      id: 'cygnus-x1-black-hole',
      displayName: 'Cygnus X-1',
      bodyType: 'black-hole',
      surfaceArchetype: 'black-hole',
      catalogIdentity,
      orbitalElements: null,
      spatial: {
        solarSystemId: 'cygnus-x1',
        frame: 'barycentric',
        positionKm: { x: 0, y: 0, z: 0 },
        epochMs: 0,
      },
    };
    const bake = vi.fn();
    const scheduled: (() => void)[] = [];
    const schedule = vi.fn((callback: () => void) => scheduled.push(callback));
    TestBed.configureTestingModule({
      providers: [
        { provide: PLANET_CACHE_BAKE_FN, useValue: bake },
        { provide: PLANET_CACHE_SCHEDULER, useValue: schedule },
      ],
    });
    const cache = TestBed.inject(PlanetTextureCache);
    const warn = vi.spyOn(appLogger, 'warn');
    try {
      expect(isTexturableBody(body)).toBe(false);
      for (const tier of ['l0', 'l1'] as const) {
        expect(resolvePlanetSurface(body, tier)).toBeNull();
        expect(resolvePlanetSurfaceSource(body, tier)).toBeNull();
        const release = cache.retain([{ body, tier }]);
        cache.requestMany([body], tier);
        expect(cache.request(body, tier)).toBeNull();
        expect(cache.get(body, tier)).toBeNull();
        release();
      }
      // Lease release may schedule cache maintenance even without a bake.
      // Drain those ticks and verify no terrain work was actually queued.
      for (let tick = 0; scheduled.length && tick < 10; tick++) scheduled.shift()?.();
      expect(scheduled).toHaveLength(0);
      expect(bake).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
      expect(isCygnusX1BlackHole(body)).toBe(catalogIdentity?.namespace === 'cygnus-x1');
      // Unsupported identities retain selectable generic geometry, not the
      // Cygnus ray profile or a bogus terrain surface.
      expect(mapBodiesToRendered([body])[0]).toMatchObject({ geometryKind: 'sphere', isStar: false });
    } finally {
      warn.mockRestore();
    }
  });
});
