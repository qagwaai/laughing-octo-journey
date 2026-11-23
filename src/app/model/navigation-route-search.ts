import type { NavigationPositionVector } from './solar-system-get';

export type NavigationSide = -1 | 1;
export type NavigationRouteProfileId = 'navigation-phase3-legacy-v1' | 'stellar-sol-station-100au-v1';
export type NavigationRouteMode = 'ship-drive-normal' | 'bounded-preview-100au';
export interface NavigationDriveProfile {
  id: string;
  name: string;
  rangeAu: number;
  cruiseSpeedAuPerHour: number;
  fuelCostPerAu: number;
}

export interface NavigationDriveEligibility {
  status: 'eligible' | 'ineligible' | 'unavailable' | 'not-applicable';
  reason: 'WITHIN_SHIP_LEG_RANGE' | 'OUTSIDE_SHIP_LEG_RANGE' | 'DRIVE_PROFILE_UNAVAILABLE' | 'BOUNDED_PREVIEW_IGNORES_SHIP_DRIVE';
  rangeAu?: number;
  rangeKm?: number;
  exceedingLegs?: { legIndex: number; distanceKm: number }[];
  flightAuthorized: false;
}
export interface NavigationRouteTarget {
  kind: 'body' | 'market';
  id: string;
}

export interface NavigationRouteJob {
  jobId: string;
  prefixBodyIds: string[];
  prefixSides: NavigationSide[];
  target: NavigationRouteTarget;
  targetSide?: NavigationSide;
}

export interface NavigationHazardMarker {
  bodyId: string;
  hazardType: 'surface' | 'atmosphere' | 'ring';
  level: 'warning';
  explanation: string;
  legIndex: number;
  epochMs: number;
  positionKm: NavigationPositionVector;
}

export interface NavigationUnresolvedAssessment {
  bodyId: string;
  legIndex: number;
  epochMs: number;
  positionKm: NavigationPositionVector;
  reason: 'profile_unavailable' | 'body_position_unavailable';
}

export interface NavigationHazardAssessment {
  level: 'clear-within-survey' | 'warning' | 'warning-with-unresolved';
  markers: NavigationHazardMarker[];
  unresolvedBodyIds: string[];
  unresolvedAssessments: NavigationUnresolvedAssessment[];
  surveyStatus: 'complete' | 'incomplete' | 'unavailable';
}

export interface NavigationRouteLeg {
  legIndex: number;
  fromBodyOrShipId: string;
  toBodyOrMarketId: string;
  startPositionKm: NavigationPositionVector;
  endPositionKm: NavigationPositionVector;
  departureEpochMs: number;
  arrivalEpochMs: number;
  distanceKm: number;
  durationMs: number;
  fuelUnits: number;
  withinHopLimit: boolean;
  withinShipLegRange?: boolean;
  shipLegRangeKm?: number;
  encounter?: NavigationTimedEncounter;
}

export interface NavigationTimedEncounter {
  bodyId: string;
  side: NavigationSide;
  encounterEpochMs: number;
  bodyCenterPositionKm: NavigationPositionVector;
  waypointPositionKm: NavigationPositionVector;
  offsetKm: NavigationPositionVector;
  coordinateBasisId: string;
  positionEvaluationModelId: string;
  sourceRevision: string;
}

export interface NavigationRouteSuccess {
  success: true;
  jobId: string;
  prefixBodyIds: string[];
  prefixSides: NavigationSide[];
  sideHistory: { encounterIndex: number; bodyId: string; side: NavigationSide }[];
  target: NavigationRouteTarget;
  targetSide?: NavigationSide;
  eligible: boolean;
  eligibilityReason: 'WITHIN_PHASE3_BOUNDS' | 'OUTSIDE_HOP_OR_PATH_LIMIT' | 'OUTSIDE_TOTAL_PATH_LIMIT' | 'OUTSIDE_SHIP_LEG_RANGE';
  navigationMode: NavigationRouteMode;
  flightAuthorized: false;
  driveEligibility: NavigationDriveEligibility;
  legs: NavigationRouteLeg[];
  totalDistanceKm: number;
  totalDurationMs: number;
  fuelUnits: number;
  hazardAssessment: NavigationHazardAssessment;
}

export interface NavigationRouteFailure {
  success: false;
  jobId: string;
  reason: string;
  message: string;
}

export interface NavigationDirectReference {
  status: 'supported';
  target: { kind: 'market'; id: string };
  departurePositionKm: NavigationPositionVector;
  destinationPositionKm: NavigationPositionVector;
  distanceKm: number;
  durationMs: number;
  fuelUnits: number;
  eligible: boolean;
  eligibilityReason: 'WITHIN_PHASE3_BOUNDS' | 'DIRECT_REFERENCE_MAY_EXCEED_HOP_LIMIT' | 'DIRECT_REFERENCE_MAY_EXCEED_PATH_LIMIT' | 'OUTSIDE_SHIP_LEG_RANGE';
  navigationMode: NavigationRouteMode;
  flightAuthorized: false;
  driveEligibility: NavigationDriveEligibility;
  hazardAssessment: NavigationHazardAssessment;
}

export interface NavigationRouteCapture {
  bootstrapId: string;
  planningRevision: string;
  shipId: string;
  shipRevision: string;
  destinationMarketId: string;
  candidateBodyIds: string[];
  departureEpochMs: number;
  departurePositionKm: NavigationPositionVector;
  coordinateBasisId: string;
  positionEvaluationModelId: string;
  sourceRevision: string;
  clockGeneration: number;
  clockLineage: string;
  clockEpochMs: number;
  profileId: NavigationRouteProfileId;
  profileVersion: 'v1';
  navigationMode: NavigationRouteMode;
  driveProfile: NavigationDriveProfile | null;
  driveProfileRevision: string | null;
  flightAuthorized: false;
}

export interface NavigationRouteBatchResponse {
  success: boolean;
  message: string;
  correlationId: string | null;
  requestIdentity: { operation: string; entityType: string; containerId: string } | null;
  failure?: { reason: string; message: string };
  batch: {
    status: 'supported' | 'incomplete' | 'failed';
    capture: NavigationRouteCapture | null;
    bounds?: {
      profileId: NavigationRouteCapture['profileId'];
      maxEligiblePathKm: number;
      maxLegDistanceKm: number | null;
    };
    directReference: NavigationDirectReference | null;
    jobs: (NavigationRouteSuccess | NavigationRouteFailure)[];
    completion?: {
      mode: 'complete' | 'timeout' | 'interrupted' | 'budget-limited';
      completedJobCount: number;
      failedJobCount: number;
    };
  };
}
