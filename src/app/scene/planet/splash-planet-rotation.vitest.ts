import { describe, expect, it } from 'vitest';
import { deriveGasGiantProfile, GAS_GIANT_PALETTES } from '../../model/planet/gas-giant-profile';
import {
  selectSplashPlanet,
  selectSplashPlanetBodyId,
  SPLASH_PLANET_BODY_ID,
  SPLASH_PLANET_ROTATION,
} from './splash-planet-rotation';

const ids = SPLASH_PLANET_ROTATION.map((entry) => entry.id);
const last = SPLASH_PLANET_ROTATION.length - 1;

describe('selectSplashPlanetBodyId', () => {
  it('keeps the original splash planet first and every entry unique', () => {
    expect(SPLASH_PLANET_ROTATION[0]).toEqual({ id: SPLASH_PLANET_BODY_ID, kind: 'terran' });
    expect(SPLASH_PLANET_ROTATION.filter((entry) => entry.kind === 'terran')).toHaveLength(25);
    expect(SPLASH_PLANET_ROTATION.filter((entry) => entry.kind === 'gas-giant')).toHaveLength(10);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('maps the random draw across the whole rotation', () => {
    expect(selectSplashPlanetBodyId('', () => 0)).toBe(ids[0]);
    expect(selectSplashPlanetBodyId('', () => 0.5)).toBe(ids[Math.floor(0.5 * ids.length)]);
    expect(selectSplashPlanetBodyId('', () => 0.999999)).toBe(ids[last]);
    expect(selectSplashPlanetBodyId('', () => 1)).toBe(ids[last]);
  });

  it('honours a pinned planet, including ids outside the rotation', () => {
    expect(selectSplashPlanetBodyId('?splashPlanet=nova-splash-world-07', () => 0)).toBe('nova-splash-world-07');
    expect(selectSplashPlanetBodyId('?other=1&splashPlanet=preview-me', () => 0)).toBe('preview-me');
  });

  it('ignores blank or oversized pins', () => {
    expect(selectSplashPlanetBodyId('?splashPlanet=%20%20', () => 0)).toBe(ids[0]);
    expect(selectSplashPlanetBodyId(`?splashPlanet=${'x'.repeat(65)}`, () => 0)).toBe(ids[0]);
  });

  it('falls back to the original planet when the rotation is empty', () => {
    expect(selectSplashPlanetBodyId('', () => 0.4, [])).toBe(SPLASH_PLANET_BODY_ID);
  });
});

describe('selectSplashPlanet kinds', () => {
  it('uses the declared kind for listed pins, even when splashKind disagrees', () => {
    expect(selectSplashPlanet('?splashPlanet=nova-splash-giant-03')).toEqual({
      id: 'nova-splash-giant-03',
      kind: 'gas-giant',
    });
    expect(selectSplashPlanet('?splashPlanet=nova-splash-world-03&splashKind=gas-giant').kind).toBe('terran');
  });

  it('lets splashKind choose the kind for unlisted pins', () => {
    expect(selectSplashPlanet('?splashPlanet=preview-me').kind).toBe('terran');
    expect(selectSplashPlanet('?splashPlanet=preview-me&splashKind=gas-giant').kind).toBe('gas-giant');
    expect(selectSplashPlanet('?splashPlanet=preview-me&splashKind=bogus').kind).toBe('terran');
  });

  it('seeds giants that cover every palette and include ringed and ringless worlds', () => {
    const profiles = SPLASH_PLANET_ROTATION.filter((entry) => entry.kind === 'gas-giant').map((entry) =>
      deriveGasGiantProfile(entry.id),
    );
    expect(new Set(profiles.map((profile) => profile.palette))).toEqual(new Set(GAS_GIANT_PALETTES));
    expect(profiles.filter((profile) => profile.rings).length).toBeGreaterThanOrEqual(3);
    expect(profiles.some((profile) => !profile.rings)).toBe(true);
    expect(profiles.some((profile) => profile.anticyclone)).toBe(true);
  });
});
