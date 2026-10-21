import { TestBed } from '@angular/core/testing';
import { NGT_STORE } from 'angular-three';
import { Box3, BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ViewerBody } from '../../model/solar-system-get';
import { appLogger } from '../../services/logger';
import { STATION_MODEL_LOAD, StationModel } from './station-model';
import {
  hasDedicatedStationModel,
  MARS_STATION_ASSETS,
  resolveStationModel,
  STATION_MODELS,
} from './station-model-assets';
import { loadStationModel, normalizeStationModel } from './station-model-loader';

function body(overrides: Partial<ViewerBody> = {}): ViewerBody {
  return {
    id: 'sol-mars-orbit',
    bodyType: 'station',
    stationKind: 'market',
    displayName: 'Mars Station',
    spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 1, y: 2, z: 3 }, epochMs: 0 },
    ...overrides,
  };
}

function model() {
  const root = new Group();
  const mesh = new Mesh(new BoxGeometry(4, 2, 1), new MeshStandardMaterial());
  mesh.position.set(5, 3, 2);
  root.add(mesh);
  return { root, mesh };
}

afterEach(() => {
  TestBed.resetTestingModule();
  vi.restoreAllMocks();
});

describe('station identity catalog', () => {
  it('selects only an explicitly registered station ID in its system', () => {
    expect(resolveStationModel(body())).toBe(STATION_MODELS['sol-mars-orbit']);
    expect(resolveStationModel(body({ id: 'another-mars-station' }))).toBeNull();
    expect(resolveStationModel(body({ bodyType: 'planet' }))).toBeNull();
    expect(resolveStationModel(body({ spatial: { ...body().spatial, solarSystemId: 'other' } }))).toBeNull();
    expect(hasDedicatedStationModel(null)).toBe(false);
    // Labels and generic family membership do not select a station-specific asset.
    expect(resolveStationModel(body({ id: 'earth-station', displayName: 'Mars Station' }))).toBeNull();
    expect(resolveStationModel(body({ displayName: 'Renamed Station' }))).not.toBeNull();
  });

  it('shares the accepted standard/low assets with the splash', () => {
    expect(STATION_MODELS['sol-mars-orbit']?.assets).toBe(MARS_STATION_ASSETS);
    expect(MARS_STATION_ASSETS.standard.triangleCount).toBe(149_944);
    expect(MARS_STATION_ASSETS.low.triangleCount).toBe(74_984);
  });
});

describe('station model normalization', () => {
  it('centers all geometry and fits the largest dimension to a unit diameter', () => {
    const { root } = model();
    const normalized = normalizeStationModel(root);
    const bounds = new Box3().setFromObject(normalized);
    expect(bounds.getCenter(new Vector3()).length()).toBeCloseTo(0);
    expect(bounds.getSize(new Vector3()).toArray()).toEqual([2, 1, 0.5]);
  });

  it('rejects an empty model instead of rendering invalid coordinates', () => {
    expect(() => normalizeStationModel(new Group())).toThrow('Station model has invalid bounds.');
  });
});

describe('station model ownership and loading', () => {
  function setup() {
    const load = vi.fn<typeof loadStationModel>();
    const invalidate = vi.fn();
    TestBed.configureTestingModule({
      imports: [StationModel],
      providers: [
        { provide: NGT_STORE, useValue: { snapshot: { gl: {}, invalidate } } },
        { provide: STATION_MODEL_LOAD, useValue: load },
      ],
    }).overrideComponent(StationModel, { set: { template: '' } });
    const fixture = TestBed.createComponent(StationModel);
    fixture.componentRef.setInput('bodyId', 'sol-mars-orbit');
    fixture.componentRef.setInput('quality', 'standard');
    const statuses: string[] = [];
    fixture.componentInstance.statusChange.subscribe((status) => statuses.push(status.state));
    return { fixture, load, statuses };
  }

  it('loads one tier, restores highlight materials, and disposes the owned model on teardown', async () => {
    const { fixture, load, statuses } = setup();
    const { root, mesh } = model();
    const dispose = vi.spyOn(mesh.geometry, 'dispose');
    const originalColor = mesh.material.emissive.clone();
    load.mockResolvedValue(root);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(load).toHaveBeenCalledOnce();
    expect(load.mock.calls[0][0]).toBe(MARS_STATION_ASSETS.standard.url);
    expect(statuses).toEqual(['loading', 'ready']);
    fixture.componentRef.setInput('highlight', '#8f0000');
    fixture.detectChanges();
    expect(mesh.material.emissive.getHexString()).toBe('8f0000');
    fixture.componentRef.setInput('highlight', null);
    fixture.detectChanges();
    expect(mesh.material.emissive).toEqual(originalColor);
    fixture.destroy();
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('disposes a late load after navigation without reporting ready', async () => {
    const { fixture, load, statuses } = setup();
    let resolve!: (model: Group) => void;
    load.mockReturnValue(
      new Promise<Group>((done) => {
        resolve = done;
      }),
    );
    fixture.detectChanges();
    fixture.destroy();
    const { root, mesh } = model();
    const dispose = vi.spyOn(mesh.geometry, 'dispose');
    resolve(root);
    await Promise.resolve();
    expect(dispose).toHaveBeenCalledOnce();
    expect(statuses).toEqual(['loading']);
  });

  it('reports a failed load and retries the same tier explicitly', async () => {
    const { fixture, load, statuses } = setup();
    vi.spyOn(appLogger, 'error').mockImplementation(() => undefined);
    load.mockRejectedValueOnce(new Error('network-failure')).mockResolvedValueOnce(model().root);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(statuses).toEqual(['loading', 'error']);
    expect(appLogger.error).toHaveBeenCalled();
    fixture.componentRef.setInput('attempt', 1);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(statuses).toEqual(['loading', 'error', 'loading', 'ready']);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('releases the previous tier and loads only the newly selected quality', async () => {
    const { fixture, load } = setup();
    const first = model();
    const dispose = vi.spyOn(first.mesh.geometry, 'dispose');
    load.mockResolvedValueOnce(first.root).mockResolvedValueOnce(model().root);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentRef.setInput('quality', 'low');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(dispose).toHaveBeenCalledOnce();
    expect(load.mock.calls.map(([url]) => url)).toEqual([
      MARS_STATION_ASSETS.standard.url,
      MARS_STATION_ASSETS.low.url,
    ]);
  });
});
