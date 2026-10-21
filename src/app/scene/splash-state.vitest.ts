import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appLogger } from '../services/logger';
import { SplashState } from './splash-state';
import { SPLASH_PLANET_ROTATION } from './planet/splash-planet-rotation';

const entry = (id: string) => SPLASH_PLANET_ROTATION.find((candidate) => candidate.id === id)!;

describe('SplashState body picker', () => {
  let state: SplashState;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    state = TestBed.inject(SplashState);
    state.planet.set(entry('nova-splash-world-02'));
  });

  afterEach(() => vi.restoreAllMocks());

  it('derives body fields from the planet signal', () => {
    state.chooseBody('nova-splash-star-g');
    expect(state.planetBodyId()).toBe('nova-splash-star-g');
    expect(state.planetKind()).toBe('star');
    expect(state.planetSpectralClass()).toBe('G2V');
    expect(state.pickerBody()).toBe('nova-splash-star-g');
  });

  it('switches foreground assets and diagnostics without changing the chosen body or quality', () => {
    state.supported.set(true);
    state.status.set('ready');
    state.chooseCategory('sol');
    state.chooseBody('sol-earth');
    const planet = state.planet();
    state.quality.set('standard');
    state.chooseForeground('station');
    expect(state.stationSplash()).toBe(true);
    expect(state.triangleCount()).toBe(149_944);
    expect(state.modelAsset().url).toContain('sol-mars-orbit-station-150k.glb');
    expect(state.posterUrl()).toContain('sol-mars-orbit-station-poster.webp');
    expect(state.planet()).toBe(planet);
    expect(state.pickerCategory()).toBe('sol');
    expect(state.pickerBody()).toBe('sol-earth');
    state.switchQuality('low');
    expect(state.triangleCount()).toBe(74_984);
    expect(state.modelAsset().url).toContain('sol-mars-orbit-station-75k.glb');
    state.chooseForeground('asteroid-mining-rig');
    expect(state.stationSplash()).toBe(false);
    expect(state.quality()).toBe('low');
    expect(state.triangleCount()).toBe(50_239);
    expect(state.modelAsset().url).toContain('asteroid-mining-rig.low.glb');
    expect(state.posterUrl()).toContain('models/mining-splash-poster.webp');
    expect(state.planet()).toBe(planet);
    expect(state.pickerBody()).toBe('sol-earth');
  });

  it('draws a different body from the chosen category', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    state.chooseCategory('sol');
    expect(state.pickerCategory()).toBe('sol');
    expect(state.pickerBody()).toBe('random');
    expect(state.planet()).toEqual({ id: 'sol-earth', kind: 'sol', solKey: 'earth' });
    state.reroll();
    expect(state.planetBodyId()).toBe('sol-luna');
  });

  it('re-rolls within the category when the body list is set back to random', () => {
    state.chooseCategory('gas-giant');
    state.chooseBody('nova-splash-giant-04');
    state.chooseBody('random');
    expect(state.pickerBody()).toBe('random');
    expect(state.planetKind()).toBe('gas-giant');
    expect(state.planetBodyId()).not.toBe('nova-splash-giant-04');
  });

  it('rejects unknown body ids', () => {
    expect(() => state.chooseBody('nope')).toThrow('Unknown splash body: nope');
  });

  it.each(['icy-moon', 'rocky-moon'] as const)('selects and shuffles %s through the dedicated category', (kind) => {
    state.chooseCategory(kind);
    expect(state.planetKind()).toBe(kind);
    state.chooseBody(`nova-splash-${kind}-01`);
    expect(state.planetSurfaceArchetype()).toBe(kind);
    expect(state.appearance()).toMatchObject({ valid: true, input: { renderer: kind } });
    state.reroll();
    expect(state.planetBodyId()).not.toBe(`nova-splash-${kind}-01`);
    expect(state.planetKind()).toBe(kind);
  });

  it('restores the displayed body and reports a failed swap', () => {
    vi.spyOn(appLogger, 'error').mockImplementation(() => undefined);
    const displayed = state.planet();
    state.chooseCategory('sol');
    state.chooseBody('sol-mars');
    state.rejectPlanet(displayed, entry('sol-mars'), new Error('404'));
    expect(state.planet()).toBe(displayed);
    expect(state.bodySwapError()).toBe('sol-mars');
    expect(state.pickerBody()).toBe('random');
    state.chooseBody('sol-io');
    expect(state.bodySwapError()).toBeNull();
  });
});
