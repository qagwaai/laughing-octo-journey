import { SPLASH_PLANET_QUERY_PARAM, type SplashPlanetEntry } from './planet/splash-planet-rotation';
import type { RenderQuality } from './render-quality';

export const STATION_SPLASH_MARKET_QUERY_PARAM = 'market';
export const STATION_SPLASH_MARKET_ID = 'sol-mars-orbit';
export interface StationSplashAsset {
  readonly triangleCount: number;
  readonly url: string;
}

export const STATION_SPLASH_ASSETS: Readonly<Record<RenderQuality, StationSplashAsset>> = {
  standard: { triangleCount: 149_944, url: 'models/sol-mars-orbit-station-150k.glb?v=ffbe3535' },
  low: { triangleCount: 74_984, url: 'models/sol-mars-orbit-station-75k.glb?v=e6a443e4' },
};

export const STATION_SPLASH_POSTER_URL = 'models/sol-mars-orbit-station-poster.webp?v=dd98a30d';

export const STATION_SPLASH_MARS: SplashPlanetEntry = {
  id: 'sol-mars',
  kind: 'sol',
  solKey: 'mars',
};

export function isStationSplashMarket(search: string): boolean {
  return new URLSearchParams(search).get(STATION_SPLASH_MARKET_QUERY_PARAM)?.trim() === STATION_SPLASH_MARKET_ID;
}

export function initialStationSplashPlanet(search: string): SplashPlanetEntry | null {
  const params = new URLSearchParams(search);
  if (!isStationSplashMarket(search) || params.has(SPLASH_PLANET_QUERY_PARAM)) return null;
  return STATION_SPLASH_MARS;
}
