import { SpatialState } from './spatial';
import { Triple } from './triple';
import type { ExternalObjectDescriptor } from './external-object-descriptor';
import type { ShipOwnerDescriptor } from './ship-owner';

export const MARKET_LIST_REQUEST_EVENT = 'market-list-request';
export const MARKET_LIST_RESPONSE_EVENT = 'market-list-response';
export const MARKET_LIST_BY_LOCATION_REQUEST_EVENT = 'market-list-by-location-request';
export const MARKET_LIST_BY_LOCATION_RESPONSE_EVENT = 'market-list-by-location-response';

export interface MarketListRequestIdentity {
  operation: string;
  entityType: string;
  containerId: string;
}

/**
 * Socket payload for listing markets, optionally constrained by system.
 */
export interface MarketListRequest {
  playerName: string;
  sessionKey: string;
  solarSystemId?: string;
  correlationId?: string;
  correlationSource?: string;
  requestIdentity?: MarketListRequestIdentity;
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
  route?: MarketRoute;
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

export interface MarketRouteFeedGate {
  gateId: string;
  sourceSystemId: string;
  destSystemId: string;
  traversalCostAu: number;
  traversalTimeHours: number;
  spatial: SpatialState;
  descriptor: ExternalObjectDescriptor;
  approachMetadata: {
    approachCue: string;
    landmarkFraming: string;
    navBeaconCue: string;
    hazardCue: string;
    warningEscalation: string;
    recommendedStandOffKm: number;
    approachWindowKm: {
      min: number;
      max: number;
    };
  };
}

export interface MarketRouteFeedStation {
  marketId: string;
  solarSystemId: string;
  marketName: string;
  siteType: 'station';
  siteName: string;
  spatial: SpatialState;
  descriptor: ExternalObjectDescriptor;
}

export interface MarketRouteFeedEncounterShip {
  shipId: string;
  shipName: string;
  model: string;
  tier: number;
  ownership: Pick<ShipOwnerDescriptor, 'ownerType' | 'npcId' | 'factionId'>;
  spatial: SpatialState;
  descriptor: ExternalObjectDescriptor;
}

export interface MarketRoute {
  kind: 'in-system' | 'gate-route' | 'no-route';
  hops?: number;
  gates?: MarketRouteFeedGate[];
  stations?: MarketRouteFeedStation[];
  encounterShips?: MarketRouteFeedEncounterShip[];
}

/**
 * Socket response payload for market-list requests.
 */
export interface MarketListResponse {
  success: boolean;
  message: string;
  correlationId: string;
  requestIdentity: MarketListRequestIdentity;
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
  correlationId?: string;
  correlationSource?: string;
  requestIdentity?: MarketListRequestIdentity;
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
  correlationId: string;
  requestIdentity: MarketListRequestIdentity;
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
