import { describe, expect, it } from 'vitest';
import { SPLASH_PLANET_BODY_ID, SPLASH_PLANET_ROTATION, selectSplashPlanetBodyId } from './splash-planet-rotation';

describe('selectSplashPlanetBodyId', () => {
  it('keeps the original splash planet first and every entry unique', () => {
    expect(SPLASH_PLANET_ROTATION[0]).toBe(SPLASH_PLANET_BODY_ID);
    expect(SPLASH_PLANET_ROTATION).toHaveLength(25);
    expect(new Set(SPLASH_PLANET_ROTATION).size).toBe(SPLASH_PLANET_ROTATION.length);
  });

  it('maps the random draw across the whole rotation', () => {
    expect(selectSplashPlanetBodyId('', () => 0)).toBe(SPLASH_PLANET_ROTATION[0]);
    expect(selectSplashPlanetBodyId('', () => 0.5)).toBe(SPLASH_PLANET_ROTATION[12]);
    expect(selectSplashPlanetBodyId('', () => 0.999999)).toBe(SPLASH_PLANET_ROTATION[24]);
    expect(selectSplashPlanetBodyId('', () => 1)).toBe(SPLASH_PLANET_ROTATION[24]);
  });

  it('honours a pinned planet, including ids outside the rotation', () => {
    expect(selectSplashPlanetBodyId('?splashPlanet=nova-splash-world-07', () => 0)).toBe('nova-splash-world-07');
    expect(selectSplashPlanetBodyId('?other=1&splashPlanet=preview-me', () => 0)).toBe('preview-me');
  });

  it('ignores blank or oversized pins', () => {
    expect(selectSplashPlanetBodyId('?splashPlanet=%20%20', () => 0)).toBe(SPLASH_PLANET_ROTATION[0]);
    expect(selectSplashPlanetBodyId(`?splashPlanet=${'x'.repeat(65)}`, () => 0)).toBe(SPLASH_PLANET_ROTATION[0]);
  });

  it('falls back to the original planet when the rotation is empty', () => {
    expect(selectSplashPlanetBodyId('', () => 0.4, [])).toBe(SPLASH_PLANET_BODY_ID);
  });
});
