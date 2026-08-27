import * as THREE from 'three';
import type { ShipExteriorMissionGateState } from '../../mission/ship-exterior-mission';
import type { FloatingDebrisItem } from '../../model/floating-debris-item';
import type { AsteroidKinematics } from '../../model/math/asteroid-kinematics';
import type { CelestialBodyLocation } from '../../model/math/celestial-body-location';
import type { Triple } from '../../model/shared/triple';
import { OrbitCameraControls } from './orbit-camera-controls';

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
  scanned: boolean;
  scanProgress: number;
  revealedMaterial: {
    material: string;
    rarity: string;
  } | null;
  revealedKinematics?: AsteroidKinematics | null;
  solarSystemLocation?: CelestialBodyLocation | null;
  clusterCenterKm?: Triple | null;
}

export interface ShipSceneAsteroidState {
  samples: ShipSceneAsteroidSample[];
  targetedAsteroidId: string | null;
  hoveredAsteroidId?: string | null;
  targetHoldCandidateId?: string | null;
}

export interface ShipSceneContextState {
  playerName: string;
  characterId: string;
  shipId: string;
  camera?: ShipSceneCameraState;
  world?: ShipSceneWorldState;
  flight?: ShipSceneFlightState;
  asteroid?: ShipSceneAsteroidState;
  debris?: FloatingDebrisItem[];
  mission?: ShipExteriorMissionGateState;
}

export interface ShipSceneRenderingState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
  cube: THREE.Mesh;
  shipGroup: THREE.Group;
  stationGroup: THREE.Group;
  gateGroup: THREE.Group;
  asteroidGroup: THREE.Group;
  debrisGroup: THREE.Group;
  starfieldPoints: THREE.Points;
  starfieldSignatureLocal: string;
  asteroidLayoutSignatureLocal: string;
  orbitControls: OrbitCameraControls;
  isPausedLocal: boolean;
  cubeColorLocal: number;
  animationFrameId: number | null;
}

export interface ShipSceneRuntimeSnapshot {
  cameraPosition: { x: number; y: number; z: number };
  cubeRotation: { x: number; y: number; z: number };
  starfieldSignature: string;
  isPaused: boolean;
  renderedFrameCount: number;
  flightModeEnabled: boolean;
  flightCurrentLocationKm: { x: number; y: number; z: number };
  flightWorldOffset: { x: number; y: number; z: number };
  flightWorldRotation: { x: number; y: number; z: number };
  flightSpeedKmPerSec: number;
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
