import { Triple } from './shared/triple';
import { SolarSystemSummary } from './solar-system-list';
import type { ExternalObjectDescriptor } from './external-object-descriptor';

export const SOLAR_SYSTEM_GET_REQUEST_EVENT = 'solar-system-get-request';
export const SOLAR_SYSTEM_GET_RESPONSE_EVENT = 'solar-system-get-response';

export interface SolarSystemGetRequestIdentity {
  operation: string;
  entityType: string;
  containerId: string;
}

export type ViewerBodyType = 'star' | 'planet' | 'moon' | 'asteroid' | 'station' | string;
export type ViewerStationKind = 'market' | string;

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
  stationKind?: ViewerStationKind;
  displayName: string;
  spatial: ViewerSpatial;
  /** Optional stable mission cluster identifier for generated asteroid fields. */
  clusterId?: string;
  /** Optional barycentric center of the mission cluster. */
  clusterCenterKm?: Triple;
  /** Optional local offset from clusterCenterKm in kilometers. */
  localOffsetKm?: Triple;
  /** Optional convenience metric from cluster center to body position in km. */
  distanceFromClusterCenterKm?: number;
  /** Optional SW-13 external object descriptor for deterministic presentation contracts. */
  externalObjectDescriptor?: ExternalObjectDescriptor;
  visualization?: ViewerBodyVisualization;
  physicalCatalog?: ViewerBodyPhysicalCatalog;
  orbitalElements?: ViewerBodyOrbitalElements;
  planetType?: string | null;
  /** Star-specific extension fields (present for bodyType 'star'). */
  spectralClass?: string;
  luminositySolar?: number;
  massSolar?: number;
}

export interface ViewerDebrisEntry {
  material: string;
  rarity: string;
  quantity: number;
  itemType: string;
  externalObjectDescriptor?: ExternalObjectDescriptor;
}

export interface SolarSystemGetRequest {
  playerName: string;
  sessionKey: string;
  solarSystemId: string;
  correlationId?: string;
  correlationSource?: string;
  requestIdentity?: SolarSystemGetRequestIdentity;
  asOf?: string;
  requestId?: string;
}

export interface SolarSystemGetResponse {
  success: boolean;
  message: string;
  correlationId: string;
  requestIdentity: SolarSystemGetRequestIdentity;
  playerName?: string;
  solarSystemId?: string;
  solarSystem?: SolarSystemSummary;
  stars?: ViewerBody[];
  bodies: ViewerBody[];
  requestId?: string;
}
