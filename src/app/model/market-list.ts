import { SpatialState } from './spatial';
import { Triple } from './triple';

export const MARKET_LIST_REQUEST_EVENT = 'market-list-request';
export const MARKET_LIST_RESPONSE_EVENT = 'market-list-response';
export const MARKET_LIST_BY_LOCATION_REQUEST_EVENT = 'market-list-by-location-request';
export const MARKET_LIST_BY_LOCATION_RESPONSE_EVENT = 'market-list-by-location-response';

/**
 * Socket payload for listing markets, optionally constrained by system.
 */
export interface MarketListRequest {
  playerName: string;
  sessionKey: string;
  solarSystemId?: string;
}

/**
 * Market projection used by list and by-location responses.
 */
export interface MarketSummary {
  marketId: string;
  solarSystemId: string;
  marketName: string;
  siteType: string;
  siteName: string;
  route?: {
    kind: 'in-system' | 'gate-route' | 'no-route';
    hops?: number;
  };
  isStarterMarket?: boolean;
  spatial: SpatialState;
  trajectory?: {
    kind: 'static' | 'orbital-elements';
    orbit?: {
      anchorBodyId: string;
      semiMajorAxisKm: number;
      eccentricity: number;
      inclinationDeg: number;
      longitudeOfAscendingNodeDeg: number;
      argumentOfPeriapsisDeg: number;
      meanAnomalyAtEpochDeg: number;
      orbitalPeriodSec: number;
      epoch: string;
    };
  };
  distanceAu?: number;
  isDocked?: boolean;
  priceMultiplier: number;
  driftPercentPerHour: number;
  restockIntervalMinutes: number;
}

/**
 * Socket response payload for market-list requests.
 */
export interface MarketListResponse {
  success: boolean;
  message: string;
  playerName?: string;
  solarSystemId?: string;
  markets: MarketSummary[];
}

/**
 * Socket payload for location-based market search with distance filtering.
 */
export interface MarketListByLocationRequest {
  playerName: string;
  sessionKey: string;
  solarSystemId: string;
  positionKm: Triple;
  distanceAu: number;
  limit?: number;
  locationTypes?: string[];
  characterId?: string;
  shipId?: string;
}

/**
 * Socket response payload for location-based market list queries.
 */
export interface MarketListByLocationResponse {
  success: boolean;
  message: string;
  playerName?: string;
  solarSystemId?: string;
  positionKm?: Triple;
  distanceAu?: number;
  locationTypes?: string[];
  isDocked?: boolean;
  dockedMarketId?: string | null;
  markets: MarketSummary[];
}

/**
 * Computes straight-line distance between positions and converts it to AU units.
 */
export function computeDistanceAu(a: Triple, b: Triple): number {
  const ASTRONOMICAL_UNIT_KM = 149_597_870.7;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  const distanceKm = Math.sqrt(dx * dx + dy * dy + dz * dz);
  return distanceKm / ASTRONOMICAL_UNIT_KM;
}
