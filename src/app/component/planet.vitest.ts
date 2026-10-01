import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import * as THREE from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanetBakeOptions, PlanetBakeResult } from '../scene/planet/planet-bake';
import { BEFORE_RENDER_FN, PLANET_BAKE_FN, Planet } from './planet';

function makeBakeResult(): PlanetBakeResult {
  return {
    albedo: new THREE.Texture(),
    normal: new THREE.Texture(),
    source: 'cpu',
    climate: {
      archetype: 'terran',
      seed: 1,
      waterFraction: 0.5,
      iceLatitudeDeg: 70,
      continentFrequency: 2,
      warpStrength: 0.3,
      mountainAmplitude: 0.4,
      aridity: 0.5,
      hueBias: 0,
      seaLevel: 0.5,
      oceanSpan: 0.4,
      landSpan: 0.4,
    },
    dispose: vi.fn(),
  };
}

describe('Planet', () => {
  let fixture: ComponentFixture<Planet>;
  let component: Planet;
  let bakeSpy: ReturnType<typeof vi.fn>;
  let beforeRenderSpy: ReturnType<typeof vi.fn>;
  let beforeRenderCallbacks: Array<(state: { delta: number }) => void>;
  let results: PlanetBakeResult[];

  beforeEach(async () => {
    beforeRenderCallbacks = [];
    results = [];
    beforeRenderSpy = vi.fn().mockImplementation((callback: (state: { delta: number }) => void) => {
      beforeRenderCallbacks.push(callback);
      return () => {};
    });
    bakeSpy = vi.fn().mockImplementation(() => {
      const result = makeBakeResult();
      results.push(result);
      return result;
    });

    await TestBed.configureTestingModule({
      imports: [Planet],
      providers: [
        { provide: BEFORE_RENDER_FN, useValue: beforeRenderSpy },
        { provide: PLANET_BAKE_FN, useValue: bakeSpy },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(Planet);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('bodyId', 'alpha');
  });

  it('bakes from the body id rather than loading an image', () => {
    fixture.detectChanges();

    expect(bakeSpy).toHaveBeenCalledTimes(1);
    const options = bakeSpy.mock.calls[0][0] as PlanetBakeOptions;
    expect(options.bodyId).toBe('alpha');
    expect(options.archetype).toBe('terran');
    expect(options.tier).toBe('l1');
  });

  it('exposes the baked albedo and normal maps to the material', () => {
    fixture.detectChanges();

    const textures = (component as unknown as { textures: () => PlanetBakeResult | null }).textures();
    expect(textures?.albedo).toBe(results[0].albedo);
    expect(textures?.normal).toBe(results[0].normal);
  });

  it('re-bakes and releases the previous textures when the body id changes', () => {
    fixture.detectChanges();
    fixture.componentRef.setInput('bodyId', 'beta');
    fixture.detectChanges();

    expect(bakeSpy).toHaveBeenCalledTimes(2);
    expect((bakeSpy.mock.calls[1][0] as PlanetBakeOptions).bodyId).toBe('beta');
    expect(results[0].dispose).toHaveBeenCalledTimes(1);
    expect(results[1].dispose).not.toHaveBeenCalled();
  });

  it('honours the requested tier and archetype', () => {
    fixture.componentRef.setInput('tier', 'l0');
    fixture.componentRef.setInput('archetype', 'terran');
    fixture.detectChanges();

    const options = bakeSpy.mock.calls[0][0] as PlanetBakeOptions;
    expect(options.tier).toBe('l0');
  });

  it('releases its textures on destroy', () => {
    fixture.detectChanges();
    fixture.destroy();

    expect(results[0].dispose).toHaveBeenCalledTimes(1);
  });

  it('spins the mesh at the configured rate', () => {
    fixture.detectChanges();
    const mesh = new THREE.Mesh();
    (component as unknown as { meshRef: () => { nativeElement: THREE.Mesh } }).meshRef = () => ({
      nativeElement: mesh,
    });

    beforeRenderCallbacks[0]({ delta: 2 });

    expect(mesh.rotation.y).toBeCloseTo(0.4);
  });

  it('does not throw when the mesh is not yet available', () => {
    fixture.detectChanges();
    (component as unknown as { meshRef: () => null }).meshRef = () => null;

    expect(() => beforeRenderCallbacks[0]({ delta: 1 })).not.toThrow();
  });

  it('is declared as app-planet with the custom element schema', () => {
    const metadata = (Planet as unknown as { ɵcmp: { selectors: string[][]; schemas: unknown[] } }).ɵcmp;
    expect(metadata.selectors[0][0]).toBe('app-planet');
    expect(metadata.schemas).toContain(CUSTOM_ELEMENTS_SCHEMA);
  });
});
