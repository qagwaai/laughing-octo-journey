import { describe, expect, it } from 'vitest';
import { initialStationSplashPlanet, isStationSplashMarket, STATION_SPLASH_ASSETS } from './station-splash-assets';

describe('station splash asset selection', () => {
  it('recognizes only the associated Mars-orbit market', () => {
    expect(isStationSplashMarket('?market=sol-mars-orbit')).toBe(true);
    expect(isStationSplashMarket('?market=sol-mars')).toBe(false);
    expect(isStationSplashMarket('?market=unknown')).toBe(false);
  });

  it('defaults that market to Mars unless a splash body is explicitly pinned', () => {
    expect(initialStationSplashPlanet('?market=sol-mars-orbit')).toEqual({
      id: 'sol-mars',
      kind: 'sol',
      solKey: 'mars',
    });
    expect(initialStationSplashPlanet('?market=sol-mars-orbit&splashPlanet=sol-earth')).toBeNull();
    expect(initialStationSplashPlanet('?market=unknown')).toBeNull();
  });

  it('only exposes the accepted standard and low assets', () => {
    expect(Object.keys(STATION_SPLASH_ASSETS)).toEqual(['standard', 'low']);
    expect(STATION_SPLASH_ASSETS.standard).toEqual({
      triangleCount: 149_944,
      url: 'models/sol-mars-orbit-station-150k.glb?v=ffbe3535',
    });
    expect(STATION_SPLASH_ASSETS.low).toEqual({
      triangleCount: 74_984,
      url: 'models/sol-mars-orbit-station-75k.glb?v=e6a443e4',
    });
  });
});
