import { AsteroidMaterialProfile } from './asteroid-materials';
import { MotionState, ObservabilityState, PhysicalState, SpatialState } from './spatial';
import { Triple } from './triple';
import type { CanonicalBodyType, SurfaceArchetype } from './celestial-classification';
import type {
  CanonicalViewerBodyOrbitalElements,
  ViewerBodyPhysicalCatalog,
  ViewerBodyVisualization,
} from './solar-system-get';

export const CELESTIAL_BODY_LIST_REQUEST_EVENT = 'celestial-body-list-request';
export const CELESTIAL_BODY_LIST_RESPONSE_EVENT = 'celestial-body-list-response';

export interface CelestialBodyListRequestIdentity {
  operation: string;
  entityType: string;
  containerId: string;
}

export interface CelestialBodyListRequest {
  playerName: string;
  sessionKey: string;
  correlationId?: string;
  correlationSource?: string;
  requestIdentity?: CelestialBodyListRequestIdentity;
  solarSystemId: string;
  positionKm: Triple;
  distanceKm: number;
  limit?: number;
  states?: Array<'unscanned' | 'active' | 'destroyed'>;
  createdByCharacterId?: string;
  missionId?: string;
}

export interface CelestialBodyListItem {
  id: string;
  bodyType: CanonicalBodyType;
  surfaceArchetype: SurfaceArchetype;
  catalogId: string;
  sourceScanId: string;
  createdByCharacterId: string;
  meshProfileKey?: string | null;
  missionId: string | null;
  missionInstanceId: string | null;
  createdAt: string;
  updatedAt: string;
  spatial: SpatialState;
  motion?: MotionState;
  physical?: PhysicalState | null;
  physicalCatalog?: ViewerBodyPhysicalCatalog | null;
  atmosphere?: {
    hasAtmosphere: boolean;
    surfacePressurePa?: number | null;
    primaryComponents?: string[];
  } | null;
  discovery?: {
    discoveredBy?: string | null;
    discoveredYear?: number | null;
    discoveryNotes?: string | null;
  } | null;
  magnitudes?: {
    absoluteMagnitudeH?: number | null;
    apparentMagnitudeMin?: number | null;
    apparentMagnitudeMax?: number | null;
  } | null;
  hygId?: string | null;
  isCatalogBody?: boolean;
  orbitalElements?: CanonicalViewerBodyOrbitalElements | null;
  visualization?: ViewerBodyVisualization | null;
  spectralClass?: string | null;
  luminositySolar?: number | null;
  parentBodyId?: string | null;
  planetType?: string | null;
  composition?: AsteroidMaterialProfile | null;
  observability: ObservabilityState;
  state: 'unscanned' | 'active' | 'destroyed';
  destroyedAt: string | null;
  destroyedReason: string | null;
  debrisSeed: number | null;
  debris: Array<{
    material: string;
    rarity: 'Common' | 'Uncommon' | 'Rare' | 'Exotic';
    quantity: number;
    itemType: string;
  }>;
  /** Computed distance from the search origin, in kilometres. */
  distanceKm?: number;
}

export interface CelestialBodyListResponse {
  success: boolean;
  message: string;
  correlationId: string;
  requestIdentity: CelestialBodyListRequestIdentity;
  playerName?: string;
  solarSystemId?: string;
  positionKm?: Triple;
  distanceKm?: number;
  celestialBodies: CelestialBodyListItem[];
}
