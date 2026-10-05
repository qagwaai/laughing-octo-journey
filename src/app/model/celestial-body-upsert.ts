import { AsteroidMaterialProfile } from './asteroid-materials';
import { MotionState, ObservabilityState, PhysicalState, SpatialState } from './spatial';
import type { CanonicalBodyType, SurfaceArchetype } from './celestial-classification';
import type { CanonicalViewerBodyOrbitalElements } from './solar-system-get';

export const CELESTIAL_BODY_UPSERT_REQUEST_EVENT = 'celestial-body-upsert-request';
export const CELESTIAL_BODY_UPSERT_RESPONSE_EVENT = 'celestial-body-upsert-response';

export interface CelestialBodyUpsertRequestIdentity {
  operation: string;
  entityType: string;
  containerId: string;
  characterId?: string;
}

export const DEFAULT_SOLAR_SYSTEM_ID = 'sol';

export interface CelestialBodyUpsertVisualization {
  colorHex?: string | null;
  spectralClass?: string | null;
  textureKey?: string | null;
}

export interface CelestialBodyMeshProfile {
  meshProfileKey?: string | null;
}

export interface CelestialBodyUpsertPhysicalCatalog {
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

export interface CelestialBodyUpsertEntity {
  /** Stable unique identifier for this celestial body record. */
  id?: string;
  /** Secondary catalog identifier for indexing/search. */
  catalogId: string;
  /** Scan/source identifier used for idempotent upsert behavior. */
  sourceScanId: string;
  /** Character ID that created/discovered this body. */
  createdByCharacterId: string;
  /** Required canonical scientific body type. */
  bodyType: CanonicalBodyType;
  /** Required canonical appearance classification; distinct from planetType. */
  surfaceArchetype: SurfaceArchetype;
  /** Optional viewer-facing display name. */
  displayName?: string;
  /** Optional mission scope for asteroid fields that belong to a mission. */
  missionId?: string;
  /** Optional mission instance identifier for future multi-instance mission support. */
  missionInstanceId?: string | null;
  /** Optional stable mission cluster identifier for generated asteroid fields. */
  clusterId?: string;
  /** Optional barycentric center of the mission cluster in kilometers. */
  clusterCenterKm?: { x: number; y: number; z: number };
  /** Optional body offset from clusterCenterKm in kilometers. */
  localOffsetKm?: { x: number; y: number; z: number };
  /** Optional convenience metric from cluster center to body position in km. */
  distanceFromClusterCenterKm?: number;
  /** ISO-8601 UTC timestamp. */
  createdAt: string;
  /** ISO-8601 UTC timestamp. */
  updatedAt: string;
  spatial: SpatialState;
  motion?: MotionState;
  physical?: PhysicalState | null;
  /** Optional catalog/source values, distinct from gameplay physical estimates. */
  physicalCatalog?: CelestialBodyUpsertPhysicalCatalog | null;
  orbitalElements?: CanonicalViewerBodyOrbitalElements | null;
  spectralClass?: string | null;
  luminositySolar?: number | null;
  parentBodyId?: string | null;
  /** Optional viewer-native visualization hint (color/texture). */
  visualization?: CelestialBodyUpsertVisualization | null;
  /** Optional viewer-native asteroid mesh profile hint. */
  meshProfileKey?: string | null;
  composition?: AsteroidMaterialProfile | null;
  observability: ObservabilityState;
  /** Required lifecycle state: unscanned | active | destroyed. */
  state: 'unscanned' | 'active' | 'destroyed';
  /** ISO timestamp when body was destroyed. Only present if state=destroyed. */
  destroyedAt?: string | null;
  /** Reason for destruction (e.g., 'impacted-by:expendable-dart-drone'). */
  destroyedReason?: string | null;
  /** Deterministic seed for debris generation on target-destroyed outcomes. */
  debrisSeed?: number | null;
  /** Array of debris items yielded from destruction. */
  debris?: Array<{
    material: string;
    rarity: string;
    quantity: number;
    itemType: string;
  }>;
}

export interface CelestialBodyUpsertRequest {
  sessionKey: string;
  /** Context player name for audit/logging (not ownership association). */
  playerName: string;
  /** Explicit actor character id for easier backend extraction. */
  createdByCharacterId: string;
  correlationId?: string;
  correlationSource?: string;
  requestIdentity?: CelestialBodyUpsertRequestIdentity;
  celestialBody: CelestialBodyUpsertEntity;
}

export interface CelestialBodyUpsertResponse {
  success: boolean;
  message: string;
  correlationId: string;
  requestIdentity: CelestialBodyUpsertRequestIdentity;
  celestialBody?: CelestialBodyUpsertEntity;
}
