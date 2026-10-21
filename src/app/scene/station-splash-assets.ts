import { SPLASH_PLANET_QUERY_PARAM, type SplashPlanetEntry } from './planet/splash-planet-rotation';
import { MARS_STATION_ID } from './station/station-model-assets';
export {
  MARS_STATION_ASSETS as STATION_SPLASH_ASSETS,
  MARS_STATION_POSTER_URL as STATION_SPLASH_POSTER_URL,
} from './station/station-model-assets';

export const STATION_SPLASH_MARKET_QUERY_PARAM = 'market';
export const STATION_SPLASH_MARKET_ID = MARS_STATION_ID;

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
