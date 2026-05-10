import { Triple } from './shared/triple';
import { SolarSystemSummary } from './solar-system-list';

export const SOLAR_SYSTEM_GET_REQUEST_EVENT = 'solar-system-get-request';
export const SOLAR_SYSTEM_GET_RESPONSE_EVENT = 'solar-system-get-response';

export type ViewerBodyType = 'star' | 'planet' | 'moon' | 'asteroid' | 'station' | string;

export interface ViewerBodyVisualization {
  colorHex?: string;
  textureKey?: string | null;
}

export interface ViewerBodyPhysicalCatalog {
  estimatedDiameterM?: number;
  estimatedMassKg?: number;
  radiusKm?: number;
}

export interface ViewerBodyOrbitalElements {
  anchorBodyId?: string;
  semiMajorAxisKm?: number;
  eccentricity?: number;
  inclinationDeg?: number;
  longitudeOfAscendingNodeDeg?: number;
  argumentOfPeriapsisDeg?: number;
  meanAnomalyAtEpochDeg?: number;
  orbitalPeriodSec?: number;
  epoch?: string;
}

export interface ViewerSpatial {
  solarSystemId: string;
  frame: string;
  positionKm: Triple;
  epochMs: number;
}

export interface ViewerBody {
  id: string;
  bodyType: ViewerBodyType;
  displayName: string;
  spatial: ViewerSpatial;
  visualization?: ViewerBodyVisualization;
  physicalCatalog?: ViewerBodyPhysicalCatalog;
  orbitalElements?: ViewerBodyOrbitalElements;
  planetType?: string | null;
  /** Star-specific extension fields (present for bodyType 'star'). */
  spectralClass?: string;
  luminositySolar?: number;
  massSolar?: number;
}

export interface SolarSystemGetRequest {
  playerName: string;
  sessionKey: string;
  solarSystemId: string;
  asOf?: string;
  requestId?: string;
}

export interface SolarSystemGetResponse {
  success: boolean;
  message: string;
  playerName?: string;
  solarSystemId?: string;
  solarSystem?: SolarSystemSummary;
  stars?: ViewerBody[];
  bodies: ViewerBody[];
  requestId?: string;
}
