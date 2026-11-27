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
  reason:
    | 'WITHIN_SHIP_LEG_RANGE'
    | 'OUTSIDE_SHIP_LEG_RANGE'
    | 'DRIVE_PROFILE_UNAVAILABLE'
    | 'BOUNDED_PREVIEW_IGNORES_SHIP_DRIVE';
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
  eligibilityReason:
    'WITHIN_PHASE3_BOUNDS' | 'OUTSIDE_HOP_OR_PATH_LIMIT' | 'OUTSIDE_TOTAL_PATH_LIMIT' | 'OUTSIDE_SHIP_LEG_RANGE';
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
  prefixBodyIds: string[];
  prefixSides: NavigationSide[];
  target: NavigationRouteTarget;
  reason: 'OUT_OF_DOMAIN' | 'ENCOUNTER_UNAVAILABLE' | 'TARGET_UNSUPPORTED' | 'NUMERIC_FAILURE';
  message: string;
}

export interface NavigationDirectReference {
  status: 'supported';
  kind: 'direct-reference';
  target: { kind: 'market'; id: string };
  departureEpochMs: number;
  arrivalEpochMs: number;
  departurePositionKm: NavigationPositionVector;
  destinationPositionKm: NavigationPositionVector;
  distanceKm: number;
  durationMs: number;
  fuelUnits: number;
  eligible: boolean;
  eligibilityReason:
    | 'WITHIN_PHASE3_BOUNDS'
    | 'DIRECT_REFERENCE_MAY_EXCEED_HOP_LIMIT'
    | 'DIRECT_REFERENCE_MAY_EXCEED_PATH_LIMIT'
    | 'OUTSIDE_SHIP_LEG_RANGE';
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
  shipPositionEpochMs: number;
  departurePositionKm: NavigationPositionVector;
  coordinateBasisId: string;
  positionEvaluationModelId: string;
  sourceRevision: string;
  clockGeneration: number;
  clockLineage: string;
  searchStartEpochMs: number;
  profileId: NavigationRouteProfileId;
  profileVersion: 'v1';
  navigationMode: NavigationRouteMode;
  driveProfile: NavigationDriveProfile | null;
  driveProfileRevision: string | null;
  flightAuthorized: false;
}

export interface NavigationRouteClock {
  status: 'supported' | 'paused' | 'unavailable' | 'recovery';
  epochMs: number | null;
  timeScaleId: 'stellar:unix-ms-uniform:v1';
  running: boolean;
  generation: number;
  lineage: string;
  durability: 'durable-mongo-game-state' | 'process-only-unverified';
}

export interface NavigationRouteBounds {
  profileId: NavigationRouteProfileId;
  candidateDiscovery: 'automatic' | 'explicit';
  candidateBodyCount: number;
  maxEncounters: 5;
  maxLegs: 6;
  maxLegDistanceKm: number | null;
  maxEligiblePathKm: number;
  fuelUnitsPerAu: 1;
  cruiseSpeedKmPerSec: 12466.489225;
  maxJobs: 32;
  maxLogicalLegs: 192;
  maxTimeoutMs: 30000;
  novaSearchDispatchBudget?: 512;
  novaOverallTimeoutMs?: 30000;
  novaSearchBudgetScope?: 'client-owned-not-server-batch-completion';
}

export interface NavigationRouteSurvey {
  surveyId: 'sol-hazard-survey-v1';
  status: 'complete' | 'incomplete' | 'unavailable';
  approximation: 'coarse-spherical-moving-body-warning-envelope';
  inventoryBodyIds: string[];
  profiles: unknown[];
}

export interface NavigationRouteNumericPrecision {
  epochUnit: 'uniform-game-millisecond';
  positionUnit: 'kilometre';
  distanceUnit: 'kilometre';
  durationUnit: 'game-millisecond';
  fuelUnit: 'prototype-fuel-unit-per-AU';
  distanceRounding: 'IEEE-754-binary64-full-precision-response';
  epochRounding: 'Math.round-nearest-millisecond';
  finiteValueRequirement: 'all-output-numbers-must-be-finite';
}

export interface NavigationRouteCompletion {
  mode: 'complete' | 'timeout' | 'interrupted' | 'budget-limited';
  submittedJobCount: number;
  completedJobCount: number;
  failedJobCount: number;
  logicalLegCount: number;
}

export const NAVIGATION_ROUTE_FAILURE_REASONS = [
  'invalid_request',
  'unauthorized',
  'unsupported_ship_position',
  'unsupported_target',
  'clock_unavailable',
  'clock_recovery_in_progress',
  'clock_data_inconsistent',
  'invalid_capture',
  'capture_expired',
  'source_changed',
  'source_association_mismatch',
  'drive_profile_unavailable',
  'drive_profile_changed',
  'direct_target_unsupported',
  'direct_source_unavailable',
  'direct_numeric_failure',
  'navigation_read_failed',
  'batch_evaluation_failed',
] as const;

interface NavigationRouteResponseEnvelope {
  message: string;
  correlationId: string | null;
  requestIdentity: { operation: string; entityType: string; containerId: string } | null;
}

export interface NavigationRouteBatchSuccessResponse extends NavigationRouteResponseEnvelope {
  success: true;
  batch: {
    status: 'supported' | 'incomplete';
    capture: NavigationRouteCapture;
    clock: NavigationRouteClock;
    bounds: NavigationRouteBounds;
    directReference: NavigationDirectReference;
    jobs: (NavigationRouteSuccess | NavigationRouteFailure)[];
    hazardSurvey: NavigationRouteSurvey;
    numericPrecision: NavigationRouteNumericPrecision;
    completion: NavigationRouteCompletion;
  };
}

export interface NavigationRouteBatchFailureResponse extends NavigationRouteResponseEnvelope {
  success: false;
  failure: { reason: (typeof NAVIGATION_ROUTE_FAILURE_REASONS)[number]; message: string };
  batch: {
    status: 'failed';
    capture: null;
    clock: null;
    directReference: null;
    jobs: [];
    bounds: null;
    hazardSurvey: null;
    numericPrecision: null;
    completion: null;
  };
}

export interface NavigationRouteBatchUnavailableResponse {
  success: false;
  message: 'Game unavailable';
  availability: 'unavailable';
  reason: 'startup_not_verified';
  correlationId?: string;
  requestIdentity?: {
    operation: 'navigation-route-edge-batch';
    entityType: 'solar-system';
    containerId: 'sol';
  };
}

export type NavigationRouteBatchResponse =
  | NavigationRouteBatchSuccessResponse
  | NavigationRouteBatchFailureResponse
  | NavigationRouteBatchUnavailableResponse;
