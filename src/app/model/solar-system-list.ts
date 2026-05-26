import { Triple } from './shared/triple';

export const SOLAR_SYSTEM_LIST_REQUEST_EVENT = 'solar-system-list-request';
export const SOLAR_SYSTEM_LIST_RESPONSE_EVENT = 'solar-system-list-response';

export interface SolarSystemListRequestIdentity {
  operation: string;
  entityType: string;
  containerId: string;
}

export type SolarSystemSource = 'curated' | 'procedural';

export interface SolarSystemPrimaryStarSummary {
  hygId: string;
  spectralClass: string;
  spectralType?: string;
  colorHex: string;
  luminositySolar?: number;
  massSolar?: number;
}

export interface SolarSystemSummary {
  id: string;
  displayName: string;
  hygSystemId?: string;
  source: SolarSystemSource;
  isMultiStar?: boolean;
  starCount?: number;
  distanceParsec?: number;
  positionPc?: Triple;
  primaryStar?: SolarSystemPrimaryStarSummary;
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
  maxDistanceParsec?: number;
  search?: string;
  limit?: number;
  requestId?: string;
}

export interface SolarSystemListResponse {
  success: boolean;
  message: string;
  correlationId: string;
  requestIdentity: SolarSystemListRequestIdentity;
  playerName?: string;
  solarSystems: SolarSystemSummary[];
  requestId?: string;
}
