import type { AsteroidMaterialProfile } from './asteroid-materials';
import type { CatalogIdentity } from './catalog-identity';
import type { CanonicalBodyType, SurfaceArchetype } from './celestial-classification';
import type { ExternalObjectDescriptor } from './external-object-descriptor';
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
  massSolar?: number | null;
  massUncertaintySolar?: number | null;
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

/** Source-preserving black-hole measurements; unknown horizons/extents stay null. */
export interface ViewerBlackHoleProperties {
  massSolar: number;
  massUncertaintySolar?: number | null;
  distanceParsec?: number | null;
  distanceUncertaintyParsec?: number | null;
  orbitalPeriodDays?: number | null;
  relativeBinarySemimajorAxisAU?: number | null;
  eccentricity?: number | null;
  inclinationDeg?: number | null;
  schwarzschildReferenceRadiusKm: number;
  eventHorizonRadiusKm?: number | null;
  visualAccretionDiskOuterRadiusKm?: number | null;
  sourceReferences?: string[];
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
  catalogIdentity?: CatalogIdentity | null;
  blackHoleProperties?: ViewerBlackHoleProperties | null;
  surfaceArchetype?: SurfaceArchetype | null;
  state?: 'unscanned' | 'active' | 'destroyed';
  planetType?: string | null;
  spectralClass?: string | null;
  luminositySolar?: number | null;
  massSolar?: number | null;
  /** Producer catalog, e.g. `exoplanet-catalog`; omitted for curated/procedural bodies. */
  catalogSource?: string | null;
  catalogIds?: Record<string, string> | null;
  /** Scientific designation; shown as a secondary label when it differs from displayName. */
  catalogName?: string | null;
  /** Dotted paths (`physical.*`, `orbit.*`, `atmosphere`, `surfaceArchetype`, ...) of estimated values. */
  approximateFields?: string[];
  rings?: ViewerBodyRings | null;
  status?: string;
  controversial?: boolean;
  circumbinary?: boolean;
  circumbinaryStarIds?: string[];
  systemRole?: string | null;
  discovery?: ViewerBodyDiscovery | null;
  /** Client-side marker: body failed contract validation and renders as a neutral placeholder. */
  placeholder?: boolean;
}

/** Ring radii are measured from the planet centre in the planet's equatorial plane. */
export interface ViewerBodyRings {
  innerRadiusKm: number;
  outerRadiusKm: number;
  tiltDeg: number;
  colorHex: string;
  opacity: number;
  approximate: boolean;
}

export interface ViewerBodyDiscoveryReference {
  label?: string | null;
  url?: string | null;
}

export interface ViewerBodyDiscovery {
  discoveredBy?: string | null;
  discoveredYear?: number | null;
  discoveryNotes?: string | null;
  references?: ViewerBodyDiscoveryReference[];
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

/** Naming fields are independently defined by solar-system-get-response.schema.json. */
export interface SolarSystemGetSummary
  extends Omit<SolarSystemSummary, 'displayName' | 'settlementName' | 'catalogName' | 'aliases'> {
  /** Authoritative combined label; do not reconstruct from secondary fields. */
  displayName: string;
  settlementName: string | null;
  catalogName?: string | null;
  aliases: string[];
}

export interface SolarSystemGetResponse {
  success: boolean;
  message: string;
  correlationId: string;
  requestIdentity: SolarSystemGetRequestIdentity;
  playerName?: string;
  solarSystemId?: string;
  solarSystem?: SolarSystemGetSummary;
  stars?: CanonicalViewerBody[];
  bodies: CanonicalViewerBody[];
  requestId?: string;
}

/** `stars` may repeat star records also present in `bodies`; preserve one record per entity ID. */
export function mergeUniqueViewerBodies(bodies: readonly ViewerBody[]): ViewerBody[] {
  const unique: ViewerBody[] = [];
  const seen = new Set<string>();
  for (const body of bodies) {
    if (seen.has(body.id)) continue;
    seen.add(body.id);
    unique.push(body);
  }
  return unique;
}
