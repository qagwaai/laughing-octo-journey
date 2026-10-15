import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { appLogger } from '../services/logger';
import { MiningSplashState } from './mining-splash-state';
import { SPLASH_PLANET_ROTATION } from './planet/splash-planet-rotation';

const entry = (id: string) => SPLASH_PLANET_ROTATION.find((candidate) => candidate.id === id)!;

describe('MiningSplashState body picker', () => {
  let state: MiningSplashState;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    state = TestBed.inject(MiningSplashState);
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
