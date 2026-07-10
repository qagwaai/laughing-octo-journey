import * as THREE from 'three';
import { OrbitCameraControls } from './orbit-camera-controls';

export interface ShipSceneCameraState {
  position: { x: number; y: number; z: number };
}

export interface ShipSceneWorldState {
  shipPosition: { x: number; y: number; z: number };
}

export interface ShipSceneContextState {
  playerName: string;
  characterId: string;
  shipId: string;
  camera?: ShipSceneCameraState;
  world?: ShipSceneWorldState;
}

export interface ShipSceneRenderingState {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  canvas: HTMLCanvasElement;
  cube: THREE.Mesh;
  orbitControls: OrbitCameraControls;
  isPausedLocal: boolean;
  cubeColorLocal: number;
  animationFrameId: number | null;
}

export interface ShipSceneRuntimeSnapshot {
  cameraPosition: { x: number; y: number; z: number };
  cubeRotation: { x: number; y: number; z: number };
  isPaused: boolean;
  renderedFrameCount: number;
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
