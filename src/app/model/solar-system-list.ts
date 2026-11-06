import type { PagedListResponseMetadata } from './paged-list';
import { Triple } from './shared/triple';

export const SOLAR_SYSTEM_LIST_REQUEST_EVENT = 'solar-system-list-request';
export const SOLAR_SYSTEM_LIST_RESPONSE_EVENT = 'solar-system-list-response';

export interface SolarSystemListRequestIdentity {
  operation: string;
  entityType: string;
  containerId: string;
}

export type SolarSystemSource = 'curated' | 'procedural' | 'exoplanet-catalog';

export type SolarSystemListSort = 'distance' | 'name';

export interface SolarSystemPrimaryStarSummary {
  /** Null for exoplanet-catalog primaries without an HYG match. Key stars by `starId`. */
  hygId: string | null;
  starId?: string;
  spectralClass: string | null;
  spectralType?: string | null;
  colorHex: string;
  luminositySolar?: number | null;
  massSolar?: number;
  radiusSolar?: number;
  properName?: string | null;
}

export interface SolarSystemSummary {
  id: string;
  /** Authoritative label: preserve combined names verbatim, never reconstruct them. */
  displayName: string;
  settlementName: string | null;
  aliases: string[];
  /** Scientific designation; `displayName` may be a game name. */
  catalogName?: string | null;
  hygSystemId?: string | null;
  source: SolarSystemSource;
  isMultiStar?: boolean;
  starCount?: number;
  declaredStarCount?: number;
  distanceParsec?: number | null;
  distanceApproximate?: boolean;
  catalogSnapshotDate?: string | null;
  positionPc?: Triple | null;
  primaryStar?: SolarSystemPrimaryStarSummary | null;
  planetCount?: number;
  moonCount?: number;
  asteroidCount?: number;
  marketCount?: number;
}

export interface SolarSystemListRequest {
  playerName: string;
  sessionKey: string;
  correlationId?: string;
  correlationSource?: string;
  requestIdentity?: SolarSystemListRequestIdentity;
  source?: SolarSystemSource;
  minDistanceParsec?: number;
  maxDistanceParsec?: number;
  search?: string;
  minPlanetCount?: number;
  spectralClass?: string;
  sort?: SolarSystemListSort;
  offset?: number;
  limit?: number;
  requestId?: string;
}

export interface SolarSystemListResponse extends PagedListResponseMetadata {
  success: boolean;
  message: string;
  correlationId: string;
  requestIdentity: SolarSystemListRequestIdentity;
  playerName?: string;
  solarSystems: SolarSystemSummary[];
  requestId?: string;
}
