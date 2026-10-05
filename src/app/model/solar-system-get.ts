import type { ExternalObjectDescriptor } from './external-object-descriptor';
import type { AsteroidMaterialProfile } from './asteroid-materials';
import type { CanonicalBodyType, SurfaceArchetype } from './celestial-classification';
import { Triple } from './shared/triple';
import { SolarSystemSummary } from './solar-system-list';
import type { PhysicalState } from './spatial';

export const SOLAR_SYSTEM_GET_REQUEST_EVENT = 'solar-system-get-request';
export const SOLAR_SYSTEM_GET_RESPONSE_EVENT = 'solar-system-get-response';

export interface SolarSystemGetRequestIdentity {
  operation: string;
  entityType: string;
  containerId: string;
}

export type ViewerBodyType = 'star' | 'planet' | 'moon' | 'asteroid' | 'debris' | 'station' | string;
export type ViewerStationKind = 'market' | string;

export interface ViewerBodyVisualization {
  colorHex?: string | null;
  /** Legacy art-direction hint; canonical stellar classification is top-level. */
  spectralClass?: string | null;
  textureKey?: string | null;
}

export interface ViewerBodyPhysicalCatalog {
  massKg?: number | null;
  meanRadiusKm?: number | null;
  equatorialRadiusKm?: number | null;
  radiusKm?: number | null;
  estimatedDiameterM?: number | null;
  estimatedMassKg?: number | null;
  rotationPeriodSec?: number | null;
  axialTiltDeg?: number | null;
  surfaceGravityMps2?: number | null;
  meanTemperatureK?: number | null;
  compositionTags?: string[];
}

export interface ViewerBodyOrbitalElements {
  anchorBodyId?: string | null;
  semiMajorAxisKm?: number;
  eccentricity?: number;
  inclinationDeg?: number;
  longitudeOfAscendingNodeDeg?: number;
  argumentOfPeriapsisDeg?: number;
  meanAnomalyAtEpochDeg?: number;
  orbitalPeriodSec?: number;
  epoch?: string;
}

export interface CanonicalViewerBodyOrbitalElements extends ViewerBodyOrbitalElements {
  semiMajorAxisKm: number;
  eccentricity: number;
  inclinationDeg: number;
  longitudeOfAscendingNodeDeg: number;
  argumentOfPeriapsisDeg: number;
  meanAnomalyAtEpochDeg: number;
  orbitalPeriodSec: number;
  epoch: string;
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
  parentBodyId?: string | null;
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
  /** Optional body-local debris payloads; entries may carry SW-13 descriptors. */
  debris?: ViewerBodyDebrisEntry[];
  visualization?: ViewerBodyVisualization;
  physicalCatalog?: ViewerBodyPhysicalCatalog | null;
  physical?: PhysicalState | null;
  composition?: AsteroidMaterialProfile | null;
  orbitalElements?: CanonicalViewerBodyOrbitalElements | null;
  surfaceArchetype?: SurfaceArchetype | null;
  state?: 'unscanned' | 'active' | 'destroyed';
  planetType?: string | null;
  spectralClass?: string | null;
  luminositySolar?: number | null;
  massSolar?: number | null;
}

export interface CanonicalViewerBody extends ViewerBody {
  bodyType: CanonicalBodyType;
  surfaceArchetype: SurfaceArchetype;
}

export interface ViewerDebrisEntry {
  material: string;
  rarity: string;
  quantity: number;
  itemType: string;
  externalObjectDescriptor?: ExternalObjectDescriptor;
}

export interface ViewerBodyDebrisEntry extends ViewerDebrisEntry {
  id?: string;
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
  stars?: CanonicalViewerBody[];
  bodies: CanonicalViewerBody[];
  requestId?: string;
}
