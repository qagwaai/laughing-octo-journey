import * as THREE from 'three';
import type { ShipExteriorMissionGateState } from '../../mission/ship-exterior-mission';
import type { FloatingDebrisItem } from '../../model/floating-debris-item';
import type { AsteroidKinematics } from '../../model/math/asteroid-kinematics';
import type { CelestialBodyLocation } from '../../model/math/celestial-body-location';
import type { Triple } from '../../model/shared/triple';
import type { AsteroidDetailCapMultiplier } from './frame-pressure-sampler';

export interface ShipSceneCameraState {
  position: { x: number; y: number; z: number };
}

export interface ShipSceneWorldState {
  shipPosition: { x: number; y: number; z: number };
}

export interface ShipSceneFlightState {
  enabled: boolean;
  invertY: boolean;
  mouseSensitivity: number;
  currentLocationKm: { x: number; y: number; z: number };
  orientation: { yawRad: number; pitchRad: number; rollRad: number };
  worldOffset: { x: number; y: number; z: number };
  worldRotation: { x: number; y: number; z: number };
  speedKmPerSec: number;
}

export interface ShipSceneAsteroidSample {
  id: string;
  serverCelestialBodyId?: string | null;
  meshProfileKey?: string | null;
  estimatedDiameterM?: number | null;
  scanned: boolean;
  scanProgress: number;
  revealedMaterial: {
    material: string;
    rarity: string;
  } | null;
  revealedKinematics?: AsteroidKinematics | null;
  capturedKinematics?: AsteroidKinematics | null;
  solarSystemLocation?: CelestialBodyLocation | null;
  clusterCenterKm?: Triple | null;
}

export interface ShipSceneAsteroidState {
  samples: ShipSceneAsteroidSample[];
  targetedAsteroidId: string | null;
  hoveredAsteroidId?: string | null;
  targetHoldCandidateId?: string | null;
}

export interface ShipSceneScannableShipSample {
  id: string;
  displayName: string;
  modelAssetPath?: string | null;
  scanned: boolean;
  scanProgress: number;
}

export interface ShipSceneScannableShipState {
  samples: ShipSceneScannableShipSample[];
  hoveredShipId?: string | null;
}

export interface ShipSceneScannableDebrisSample {
  id: string;
  displayName: string;
  itemType: string;
  scanned: boolean;
  scanProgress: number;
}

export interface ShipSceneScannableDebrisState {
  samples: ShipSceneScannableDebrisSample[];
  hoveredDebrisId?: string | null;
}

export interface ShipSceneHoverScanTarget {
  kind: 'asteroid' | 'ship' | 'debris';
  id: string;
}

export interface ShipSceneContextState {
  playerName: string;
  characterId: string;
  shipId: string;
  camera?: ShipSceneCameraState;
  world?: ShipSceneWorldState;
  flight?: ShipSceneFlightState;
  asteroid?: ShipSceneAsteroidState;
  scannableShips?: ShipSceneScannableShipState;
  scannableDebris?: ShipSceneScannableDebrisState;
  debris?: FloatingDebrisItem[];
  mission?: ShipExteriorMissionGateState;
}

export interface ShipSceneRenderingState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
  worldRelativeGroup: THREE.Group;
  pilotRig: THREE.Group;
  pilotLookRig: THREE.Group;
  shipGroup: THREE.Group;
  stationGroup: THREE.Group;
  gateGroup: THREE.Group;
  asteroidGroup: THREE.Group;
  debrisGroup: THREE.Group;
  starfieldPoints: THREE.Points;
  environmentTexture: THREE.CanvasTexture | null;
  starfieldSignatureLocal: string;
  asteroidLayoutSignatureLocal: string;
  isPausedLocal: boolean;
  animationFrameId: number | null;
}

export interface ShipSceneRuntimeSnapshot {
  cameraPosition: { x: number; y: number; z: number };
  starfieldSignature: string;
  isPaused: boolean;
  renderedFrameCount: number;
  flightModeEnabled: boolean;
  flightCurrentLocationKm: { x: number; y: number; z: number };
  flightWorldOffset: { x: number; y: number; z: number };
  flightWorldRotation: { x: number; y: number; z: number };
  flightSpeedKmPerSec: number;
  performance: ShipScenePerformanceTelemetry;
}

/**
 * Inspectable state of a targeted asteroid's static lock-on bracket. Exposed so
 * end-to-end tests can assert the bracket is actually wired into the live scene
 * graph and stays static (no spin/pulse/drift) across rendered frames.
 */
export interface ShipSceneAsteroidTargetBracketSnapshot {
  sampleId: string;
  present: boolean;
  segmentCount: number;
  /** Bracket world scale, which must stay uniform (no shear) and follow the asteroid's growth. */
  worldScale: { x: number; y: number; z: number };
  /** Local offsets of each bracket arm, which must never change once built. */
  armPositions: { x: number; y: number; z: number }[];
  /** Arm opacity, which must never pulse. */
  armOpacity: number | null;
  /** World-space orientation of the bracket frame. */
  worldQuaternion: { x: number; y: number; z: number; w: number };
  /** World-space orientation of the camera the bracket should be facing. */
  cameraWorldQuaternion: { x: number; y: number; z: number; w: number };
}

export interface ShipScenePerformanceTelemetry {
  status: 'paused' | 'sampling' | 'current';
  averageFrameTimeMs: number | null;
  sampleCount: number;
  asteroidDetailCapMultiplier: AsteroidDetailCapMultiplier;
  detailCapThresholdMs: number;
}

export interface ShipSceneKeyParts {
  playerName: string;
  characterId: string;
  shipId: string;
}

export function buildShipSceneContextKey(parts: ShipSceneKeyParts): string {
  return `${parts.playerName.trim().toLowerCase()}::${parts.characterId.trim().toLowerCase()}::${parts.shipId
    .trim()
    .toLowerCase()}`;
}
