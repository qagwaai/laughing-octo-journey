import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { ShipExteriorMissionGateState } from '../../mission/ship-exterior-mission';
import type { FloatingDebrisItem } from '../../model/floating-debris-item';
import type { AsteroidKinematics } from '../../model/math/asteroid-kinematics';
import { resolveDescriptorRenderProfile } from '../viewer/viewer-descriptor-selectors';
import { buildDeterministicRockGeometry, resolveAsteroidGeometryDescriptor } from './asteroid-rock-geometry';
import {
  assignAsteroidRenderTiers,
  resolveAsteroidTierDetailOverride,
  type AsteroidRenderTier,
} from './asteroid-tier-selection';
import {
  FRAME_PRESSURE_DETAIL_CAP_THRESHOLD_MS,
  FramePressureSampler,
  resolveAsteroidDetailCapMultiplier,
  type AsteroidDetailCapMultiplier,
} from './frame-pressure-sampler';
import type { ShipExteriorAsteroidVisual } from './ship-exterior-asteroid-visuals';
import { buildAsteroidLayoutSignature, deriveAsteroidVisuals } from './ship-exterior-asteroid-visuals';
import { ShipExteriorFlightController } from './ship-exterior-flight-controller';
import type { ShipExteriorRouteFeeds } from './ship-exterior-route-feed-adapter';
import { summarizeShipExteriorRouteFeeds, type ShipExteriorRouteFeedCounts } from './ship-exterior-route-feed-summary';
import {
  ShipSceneAsteroidSample,
  ShipSceneAsteroidState,
  ShipSceneContextState,
  ShipSceneFlightState,
  ShipSceneHoverScanTarget,
  ShipScenePerformanceTelemetry,
  ShipSceneRenderingState,
  ShipSceneRuntimeSnapshot,
  ShipSceneAsteroidTargetBracketSnapshot,
  ShipSceneScannableDebrisSample,
  ShipSceneScannableDebrisState,
  ShipSceneScannableShipSample,
  ShipSceneScannableShipState,
} from './ship-scene-types';

const STARFIELD_POINT_COUNT = 220;
const STARFIELD_INNER_RADIUS = 10;
const STARFIELD_RADIUS_SPREAD = 34;
const ZERO_VECTOR = { x: 0, y: 0, z: 0 };
const JAXS_SHIP_ASSET_PATH = 'models/Jaxs_Ship_texture.glb';
const JAXS_SHIP_SCAN_ID = 'jaxs-ship';
const JAXS_SHIP_DISPLAY_NAME = 'Jax Ship';
const JAXS_SHIP_POSITION: [number, number, number] = [-9, 1.4, 5.5];
const JAXS_SHIP_ROTATION: [number, number, number] = [0, -0.55, 0];
const JAXS_SHIP_SCALE = 0.18;
const DEBRIS_KM_TO_SCENE_UNITS = 0.4;
const ROUTE_FEED_KM_TO_SCENE_UNITS = 0.32;
const DEFAULT_FLIGHT_STATE: ShipSceneFlightState = {
  enabled: true,
  invertY: false,
  mouseSensitivity: 0.0023,
  currentLocationKm: { ...ZERO_VECTOR },
  orientation: { yawRad: 0, pitchRad: 0, rollRad: 0 },
  worldOffset: { ...ZERO_VECTOR },
  worldRotation: { ...ZERO_VECTOR },
  speedKmPerSec: 0,
};
const FLIGHT_CONFIG = {
  tickMs: 16,
  trackingCheckpointMs: 250,
  trackingQuantizeKm: 0.05,
  sceneUnitToKm: 1,
  baseSpeedSceneUnitsPerSec: 0.16,
  boostMultiplier: 4,
  rollSpeedRadPerSec: 0.75,
  defaultMouseSensitivity: DEFAULT_FLIGHT_STATE.mouseSensitivity,
  mouseSensitivityMin: 0.0002,
  mouseSensitivityMax: 0.01,
  maxPitchRad: Math.PI / 2 - 0.02,
};
const DEFAULT_ASTEROID_SAMPLES: ReadonlyArray<ShipSceneAsteroidSample> = [];
const DEFAULT_SCANNABLE_DEBRIS_SAMPLES: ReadonlyArray<ShipSceneScannableDebrisSample> = [];
const DEFAULT_SCANNABLE_SHIP_SAMPLES: ReadonlyArray<ShipSceneScannableShipSample> = [
  {
    id: JAXS_SHIP_SCAN_ID,
    displayName: JAXS_SHIP_DISPLAY_NAME,
    modelAssetPath: JAXS_SHIP_ASSET_PATH,
    scanned: false,
    scanProgress: 0,
  },
];
const SCAN_RING_PHASE_WRAP_PERIOD = Math.PI * 20;

function cloneAsteroidSample(sample: ShipSceneAsteroidSample): ShipSceneAsteroidSample {
  return {
    ...sample,
    serverCelestialBodyId: sample.serverCelestialBodyId ?? null,
    meshProfileKey: sample.meshProfileKey ?? null,
    estimatedDiameterM: sample.estimatedDiameterM ?? null,
    revealedMaterial: sample.revealedMaterial ? { ...sample.revealedMaterial } : null,
    revealedKinematics: sample.revealedKinematics
      ? {
          ...sample.revealedKinematics,
          velocityKmPerSec: { ...sample.revealedKinematics.velocityKmPerSec },
          angularVelocityRadPerSec: { ...sample.revealedKinematics.angularVelocityRadPerSec },
        }
      : null,
    capturedKinematics: sample.capturedKinematics
      ? {
          ...sample.capturedKinematics,
          velocityKmPerSec: { ...sample.capturedKinematics.velocityKmPerSec },
          angularVelocityRadPerSec: { ...sample.capturedKinematics.angularVelocityRadPerSec },
        }
      : null,
    solarSystemLocation: sample.solarSystemLocation
      ? {
          ...sample.solarSystemLocation,
          positionKm: { ...sample.solarSystemLocation.positionKm },
        }
      : null,
    clusterCenterKm: sample.clusterCenterKm ? { ...sample.clusterCenterKm } : null,
  };
}

function cloneScannableShipSample(sample: ShipSceneScannableShipSample): ShipSceneScannableShipSample {
  return {
    ...sample,
    modelAssetPath: sample.modelAssetPath ?? null,
  };
}

function cloneScannableDebrisSample(sample: ShipSceneScannableDebrisSample): ShipSceneScannableDebrisSample {
  return {
    ...sample,
  };
}

function cloneMissionGateState(state: ShipExteriorMissionGateState): ShipExteriorMissionGateState {
  return {
    ...state,
    steps: state.steps.map((step) => ({
      ...step,
      evidence: step.evidence ? { ...step.evidence } : undefined,
    })),
  };
}

function cloneDebrisItem(item: FloatingDebrisItem): FloatingDebrisItem {
  return {
    ...item,
    externalObjectDescriptor: item.externalObjectDescriptor
      ? { ...item.externalObjectDescriptor }
      : item.externalObjectDescriptor,
    positionKm: { ...item.positionKm },
    velocityKmPerSec: item.velocityKmPerSec ? { ...item.velocityKmPerSec } : item.velocityKmPerSec,
  };
}

function normalizeAsteroidState(state?: ShipSceneAsteroidState): ShipSceneAsteroidState {
  const samples = (state?.samples ?? DEFAULT_ASTEROID_SAMPLES).map((sample) => cloneAsteroidSample(sample));
  const targetedAsteroidId = state?.targetedAsteroidId ?? null;
  const targetStillExists = targetedAsteroidId ? samples.some((sample) => sample.id === targetedAsteroidId) : false;
  const hoveredAsteroidId = state?.hoveredAsteroidId ?? null;
  const hoverStillExists = hoveredAsteroidId ? samples.some((sample) => sample.id === hoveredAsteroidId) : false;
  const targetHoldCandidateId = state?.targetHoldCandidateId ?? null;
  const holdStillExists = targetHoldCandidateId ? samples.some((sample) => sample.id === targetHoldCandidateId) : false;
  return {
    samples,
    targetedAsteroidId: targetStillExists ? targetedAsteroidId : null,
    hoveredAsteroidId: hoverStillExists ? hoveredAsteroidId : null,
    targetHoldCandidateId: holdStillExists ? targetHoldCandidateId : null,
  };
}

function normalizeScannableShipState(state?: ShipSceneScannableShipState): ShipSceneScannableShipState {
  const samples = (state?.samples ?? DEFAULT_SCANNABLE_SHIP_SAMPLES).map((sample) => cloneScannableShipSample(sample));
  const hoveredShipId = state?.hoveredShipId ?? null;
  const hoverStillExists = hoveredShipId ? samples.some((sample) => sample.id === hoveredShipId) : false;
  return {
    samples,
    hoveredShipId: hoverStillExists ? hoveredShipId : null,
  };
}

function normalizeScannableDebrisState(state?: ShipSceneScannableDebrisState): ShipSceneScannableDebrisState {
  const samples = (state?.samples ?? DEFAULT_SCANNABLE_DEBRIS_SAMPLES).map((sample) =>
    cloneScannableDebrisSample(sample),
  );
  const hoveredDebrisId = state?.hoveredDebrisId ?? null;
  const hoverStillExists = hoveredDebrisId ? samples.some((sample) => sample.id === hoveredDebrisId) : false;
  return {
    samples,
    hoveredDebrisId: hoverStillExists ? hoveredDebrisId : null,
  };
}

function normalizeDebrisItems(items?: readonly FloatingDebrisItem[]): FloatingDebrisItem[] {
  return (items ?? []).map((item) => cloneDebrisItem(item));
}

function deriveScannableDebrisStateFromItems(
  items: readonly FloatingDebrisItem[],
  previous: ShipSceneScannableDebrisState | undefined,
): ShipSceneScannableDebrisState {
  const previousById = new Map((previous?.samples ?? []).map((sample) => [sample.id, sample]));
  const samples = items.map((item) => {
    const prior = previousById.get(item.id);
    return {
      id: item.id,
      displayName: item.displayName,
      itemType: item.itemType,
      scanned: prior?.scanned ?? false,
      scanProgress: prior?.scanProgress ?? 0,
    };
  });
  return normalizeScannableDebrisState({
    samples,
    hoveredDebrisId: previous?.hoveredDebrisId ?? null,
  });
}

function hashStringToSeed(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const ASTEROID_IDLE_SPIN_MIN_RAD_PER_SEC = 0.05;
const ASTEROID_IDLE_SPIN_MAX_RAD_PER_SEC = 0.5;
const ASTEROID_SPIN_FRAME_SECONDS = 1 / 60;
const ASTEROID_REVEALED_SPIN_SCALE = 20;
const DEBRIS_IDLE_SPIN_MIN_RAD_PER_SEC = 0.08;
const DEBRIS_IDLE_SPIN_MAX_RAD_PER_SEC = 0.58;
const DEBRIS_SPIN_FRAME_SECONDS = 1 / 60;

interface AsteroidSpinProfile {
  spin: [number, number, number];
  orientation: [number, number, number];
}

interface DebrisSpinProfile {
  spin: [number, number, number];
  orientation: [number, number, number];
}

/** Deterministic per-asteroid tumble so each rock spins on all 3 axes from a stable starting pose. */
function createAsteroidSpinProfile(id: string): AsteroidSpinProfile {
  const random = createSeededRng(hashStringToSeed(`${id}::spin`));
  const axis = (): number => {
    const magnitude =
      ASTEROID_IDLE_SPIN_MIN_RAD_PER_SEC +
      random() * (ASTEROID_IDLE_SPIN_MAX_RAD_PER_SEC - ASTEROID_IDLE_SPIN_MIN_RAD_PER_SEC);
    return random() < 0.5 ? -magnitude : magnitude;
  };
  const spin: [number, number, number] = [axis(), axis(), axis()];
  const tau = Math.PI * 2;
  const orientation: [number, number, number] = [random() * tau, random() * tau, random() * tau];
  return { spin, orientation };
}

function createDebrisSpinProfile(id: string): DebrisSpinProfile {
  const random = createSeededRng(hashStringToSeed(`${id}::debris-spin`));
  const axis = (): number => {
    const magnitude =
      DEBRIS_IDLE_SPIN_MIN_RAD_PER_SEC +
      random() * (DEBRIS_IDLE_SPIN_MAX_RAD_PER_SEC - DEBRIS_IDLE_SPIN_MIN_RAD_PER_SEC);
    return random() < 0.5 ? -magnitude : magnitude;
  };
  const tau = Math.PI * 2;
  return {
    spin: [axis(), axis(), axis()],
    orientation: [random() * tau, random() * tau, random() * tau],
  };
}

const ASTEROID_ORBIT_MIN_AMPLITUDE = 0.3;
const ASTEROID_ORBIT_MAX_AMPLITUDE = 0.8;
const ASTEROID_ORBIT_MIN_RATE_RAD_PER_SEC = 0.05;
const ASTEROID_ORBIT_MAX_RATE_RAD_PER_SEC = 0.18;
const ASTEROID_ORBIT_FRAME_SECONDS = 1 / 60;
const ASTEROID_ORBIT_PHASE_WRAP_SECONDS = 100000;

export interface AsteroidOrbitProfile {
  amplitude: [number, number, number];
  rate: [number, number, number];
  phase: [number, number, number];
}

/**
 * Deterministic per-asteroid Lissajous wander: three independent axis frequencies produce a slow,
 * non-repeating drift around the asteroid's laid-out base position.
 */
function createAsteroidOrbitProfile(id: string): AsteroidOrbitProfile {
  const random = createSeededRng(hashStringToSeed(`${id}::orbit`));
  const span = (min: number, max: number): number => min + random() * (max - min);
  const tau = Math.PI * 2;
  const amplitude: [number, number, number] = [
    span(ASTEROID_ORBIT_MIN_AMPLITUDE, ASTEROID_ORBIT_MAX_AMPLITUDE),
    span(ASTEROID_ORBIT_MIN_AMPLITUDE, ASTEROID_ORBIT_MAX_AMPLITUDE) * 0.45,
    span(ASTEROID_ORBIT_MIN_AMPLITUDE, ASTEROID_ORBIT_MAX_AMPLITUDE),
  ];
  const rate: [number, number, number] = [
    span(ASTEROID_ORBIT_MIN_RATE_RAD_PER_SEC, ASTEROID_ORBIT_MAX_RATE_RAD_PER_SEC),
    span(ASTEROID_ORBIT_MIN_RATE_RAD_PER_SEC, ASTEROID_ORBIT_MAX_RATE_RAD_PER_SEC),
    span(ASTEROID_ORBIT_MIN_RATE_RAD_PER_SEC, ASTEROID_ORBIT_MAX_RATE_RAD_PER_SEC),
  ];
  const phase: [number, number, number] = [random() * tau, random() * tau, random() * tau];
  return { amplitude, rate, phase };
}

export function resolveAsteroidOrbitOffset(
  profile: AsteroidOrbitProfile,
  elapsedSeconds: number,
): [number, number, number] {
  return [
    Math.sin(elapsedSeconds * profile.rate[0] + profile.phase[0]) * profile.amplitude[0],
    Math.sin(elapsedSeconds * profile.rate[1] + profile.phase[1]) * profile.amplitude[1],
    Math.cos(elapsedSeconds * profile.rate[2] + profile.phase[2]) * profile.amplitude[2],
  ];
}

function createStarfieldPoints(seed: number): { points: THREE.Points; signature: string } {
  const random = createSeededRng(seed);
  const positions = new Float32Array(STARFIELD_POINT_COUNT * 3);

  for (let i = 0; i < STARFIELD_POINT_COUNT; i += 1) {
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    const radius = STARFIELD_INNER_RADIUS + random() * STARFIELD_RADIUS_SPREAD;

    const sinPhi = Math.sin(phi);
    const x = radius * sinPhi * Math.cos(theta);
    const y = radius * sinPhi * Math.sin(theta);
    const z = radius * Math.cos(phi);

    const offset = i * 3;
    positions[offset] = x;
    positions[offset + 1] = y;
    positions[offset + 2] = z;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const hue = seed % 360;
  const color = new THREE.Color(`hsl(${hue}, 78%, 82%)`);
  const material = new THREE.PointsMaterial({
    color,
    size: 0.09,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
  });

  return {
    points: new THREE.Points(geometry, material),
    signature: `${seed.toString(16).padStart(8, '0')}:${STARFIELD_POINT_COUNT}:${hue}`,
  };
}

function createAsteroidEnvironmentTexture(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 2;
  const context = canvas.getContext('2d');
  if (!context) {
    return null;
  }
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#284765');
  gradient.addColorStop(0.5, '#0b1728');
  gradient.addColorStop(1, '#020611');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  return texture;
}

function disposeMesh(mesh: THREE.Mesh): void {
  if (mesh.geometry) {
    mesh.geometry.dispose();
  }

  if (Array.isArray(mesh.material)) {
    mesh.material.forEach((material) => material.dispose());
    return;
  }

  mesh.material?.dispose();
}

function disposeAsteroidGroup(group: THREE.Group): void {
  group.children.forEach((child) => {
    if (child instanceof THREE.Mesh) {
      disposeMesh(child);
    }
  });
  group.clear();
}

function disposeGateGroup(group: THREE.Group): void {
  group.children.forEach((child) => {
    if (child instanceof THREE.Group) {
      child.traverse((nested) => {
        if (nested instanceof THREE.Mesh) {
          disposeMesh(nested);
        }
      });
      return;
    }
    if (child instanceof THREE.Mesh) {
      disposeMesh(child);
    }
  });
  group.clear();
}

function disposeStationGroup(group: THREE.Group): void {
  group.children.forEach((child) => {
    if (child instanceof THREE.Mesh) {
      disposeMesh(child);
    }
    if (child instanceof THREE.Group) {
      child.traverse((nested) => {
        if (nested instanceof THREE.Mesh) {
          disposeMesh(nested);
        }
      });
    }
  });
  group.clear();
}

function disposeDebrisGroup(group: THREE.Group): void {
  group.children.forEach((child) => {
    if (child instanceof THREE.Group) {
      child.traverse((nested) => {
        if (nested instanceof THREE.Mesh) {
          disposeMesh(nested);
        }
      });
      return;
    }
    if (child instanceof THREE.Mesh) {
      disposeMesh(child);
    }
  });
  group.clear();
}

function disposeShipGroup(group: THREE.Group): void {
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      disposeMesh(child);
    }
  });
  group.clear();
}

function disposeHoverScanGroup(group: THREE.Group): void {
  group.children.forEach((child) => {
    if (child instanceof THREE.Mesh) {
      disposeMesh(child);
    }
  });
  group.clear();
}

export interface AsteroidTargetBracketSegment {
  position: [number, number, number];
  size: [number, number, number];
}

/**
 * Builds the eight thin box segments (two per corner) that make up a static,
 * camera-facing HUD-style bracket frame around a targeted asteroid. Segments
 * are laid out in the group's local XY plane; the group itself is billboarded
 * toward the camera each frame in `counterRotateAsteroidOverlays`, so the
 * frame reads as a fixed lock-on indicator rather than a spinning ring.
 */
export function buildAsteroidTargetBracketSegments(radius: number): AsteroidTargetBracketSegment[] {
  const halfExtent = radius * 1.3;
  const armLength = radius * 0.55;
  const thickness = Math.max(0.02, radius * 0.05);
  const corners: Array<[number, number]> = [
    [-halfExtent, halfExtent],
    [halfExtent, halfExtent],
    [-halfExtent, -halfExtent],
    [halfExtent, -halfExtent],
  ];

  return corners.flatMap(([cx, cy]) => {
    const signX = Math.sign(cx);
    const signY = Math.sign(cy);
    return [
      {
        position: [cx - (signX * armLength) / 2, cy, 0] as [number, number, number],
        size: [armLength, thickness, thickness] as [number, number, number],
      },
      {
        position: [cx, cy - (signY * armLength) / 2, 0] as [number, number, number],
        size: [thickness, armLength, thickness] as [number, number, number],
      },
    ];
  });
}

export class ShipSceneContext {
  private state: ShipSceneContextState;
  private renderingState: ShipSceneRenderingState | null = null;
  private paused = true;
  private renderedFrameCount = 0;
  private flightController: ShipExteriorFlightController | null = null;
  private readonly starfieldSeed: number;
  private readonly starfieldSignature: string;
  private asteroidLayoutSignature = '';
  private routeFeeds: ShipExteriorRouteFeeds | null = null;
  private readonly gltfLoader = new GLTFLoader();
  private readonly hoverRaycaster = new THREE.Raycaster();
  private readonly hoverPointer = new THREE.Vector2();
  private asteroidHoverScanPhase = 0;
  private asteroidTargetHoldPhase = 0;
  private asteroidOrbitElapsedSeconds = 0;
  private stationPulsePhase = 0;
  private gatePulsePhase = 0;
  private shipLoadGeneration = 0;
  private readonly framePressureSampler = new FramePressureSampler();
  private lastFrameTimestamp = 0;
  private appliedAsteroidDetailCapMultiplier: AsteroidDetailCapMultiplier = 1;
  private asteroidTierFrameCounter = 0;
  private lastAsteroidTiers = new Map<string, AsteroidRenderTier>();
  private static readonly ASTEROID_TIER_RECOMPUTE_INTERVAL_FRAMES = 6;

  constructor(
    readonly contextKey: string,
    initialState: ShipSceneContextState,
  ) {
    const normalizedInitialDebris = normalizeDebrisItems(initialState.debris);
    const normalizedInitialScannableDebris = initialState.scannableDebris
      ? normalizeScannableDebrisState(initialState.scannableDebris)
      : deriveScannableDebrisStateFromItems(normalizedInitialDebris, undefined);
    this.state = {
      ...initialState,
      flight: {
        ...DEFAULT_FLIGHT_STATE,
        ...initialState.flight,
        enabled: true,
        currentLocationKm: {
          ...DEFAULT_FLIGHT_STATE.currentLocationKm,
          ...(initialState.flight?.currentLocationKm ?? initialState.world?.shipPosition ?? ZERO_VECTOR),
        },
      },
      asteroid: normalizeAsteroidState(initialState.asteroid),
      scannableShips: normalizeScannableShipState(initialState.scannableShips),
      scannableDebris: normalizedInitialScannableDebris,
      mission: initialState.mission ? cloneMissionGateState(initialState.mission) : undefined,
      debris: normalizedInitialDebris,
    };
    this.starfieldSeed = hashStringToSeed(this.state.shipId);
    this.starfieldSignature = `${this.starfieldSeed.toString(16).padStart(8, '0')}:${STARFIELD_POINT_COUNT}:${this.starfieldSeed % 360}`;
  }

  getState(): ShipSceneContextState {
    return this.state;
  }

  setState(update: Partial<ShipSceneContextState>): void {
    const flight = update.flight
      ? {
          ...DEFAULT_FLIGHT_STATE,
          ...this.state.flight,
          ...update.flight,
        }
      : this.state.flight;
    const asteroid = update.asteroid ? normalizeAsteroidState(update.asteroid) : this.state.asteroid;
    const scannableShips = update.scannableShips
      ? normalizeScannableShipState(update.scannableShips)
      : this.state.scannableShips;
    const mission = update.mission ? cloneMissionGateState(update.mission) : this.state.mission;
    const debris = update.debris ? normalizeDebrisItems(update.debris) : this.state.debris;
    const scannableDebris = update.scannableDebris
      ? normalizeScannableDebrisState(update.scannableDebris)
      : update.debris
        ? deriveScannableDebrisStateFromItems(debris ?? [], this.state.scannableDebris)
        : this.state.scannableDebris;
    this.state = {
      ...this.state,
      ...update,
      flight: flight ?? this.state.flight,
      asteroid,
      scannableShips,
      scannableDebris,
      mission,
      debris,
    };
  }

  getDebrisItems(): readonly FloatingDebrisItem[] {
    return normalizeDebrisItems(this.state.debris);
  }

  setDebrisItems(items: readonly FloatingDebrisItem[]): void {
    const normalizedDebris = normalizeDebrisItems(items);
    const scannableDebris = deriveScannableDebrisStateFromItems(normalizedDebris, this.state.scannableDebris);
    this.state = {
      ...this.state,
      debris: normalizedDebris,
      scannableDebris,
    };
  }

  getAsteroidSamples(): readonly ShipSceneAsteroidSample[] {
    let asteroid = this.state.asteroid;
    if (!asteroid) {
      asteroid = normalizeAsteroidState();
      this.state = {
        ...this.state,
        asteroid,
      };
    }
    return asteroid.samples.map((sample) => cloneAsteroidSample(sample));
  }

  setAsteroidSamples(samples: readonly ShipSceneAsteroidSample[]): void {
    const previousTargeted = this.state.asteroid?.targetedAsteroidId ?? null;
    const previousHovered = this.state.asteroid?.hoveredAsteroidId ?? null;
    const previousHoldCandidate = this.state.asteroid?.targetHoldCandidateId ?? null;
    const nextState = normalizeAsteroidState({
      samples: samples.map((sample) => cloneAsteroidSample(sample)),
      targetedAsteroidId: previousTargeted,
      hoveredAsteroidId: previousHovered,
      targetHoldCandidateId: previousHoldCandidate,
    });
    this.state = {
      ...this.state,
      asteroid: nextState,
    };
  }

  getTargetedAsteroidId(): string | null {
    return this.state.asteroid?.targetedAsteroidId ?? null;
  }

  getHoveredAsteroidId(): string | null {
    return this.state.asteroid?.hoveredAsteroidId ?? null;
  }

  getTargetHoldCandidateId(): string | null {
    return this.state.asteroid?.targetHoldCandidateId ?? null;
  }

  getScannableShipSamples(): readonly ShipSceneScannableShipSample[] {
    let scannableShips = this.state.scannableShips;
    if (!scannableShips) {
      scannableShips = normalizeScannableShipState();
      this.state = {
        ...this.state,
        scannableShips,
      };
    }
    return scannableShips.samples.map((sample) => cloneScannableShipSample(sample));
  }

  setScannableShipSamples(samples: readonly ShipSceneScannableShipSample[]): void {
    const previousHoveredShipId = this.state.scannableShips?.hoveredShipId ?? null;
    const nextState = normalizeScannableShipState({
      samples: samples.map((sample) => cloneScannableShipSample(sample)),
      hoveredShipId: previousHoveredShipId,
    });
    this.state = {
      ...this.state,
      scannableShips: nextState,
    };
  }

  getHoveredScannableShipId(): string | null {
    return this.state.scannableShips?.hoveredShipId ?? null;
  }

  setHoveredScannableShipId(shipId: string | null): void {
    const scannableShips = this.state.scannableShips ?? normalizeScannableShipState();
    const hoverStillExists = shipId ? scannableShips.samples.some((sample) => sample.id === shipId) : false;
    const nextHoveredShipId = hoverStillExists ? shipId : null;
    const previousHoveredShipId = scannableShips.hoveredShipId ?? null;
    this.state = {
      ...this.state,
      scannableShips: {
        ...scannableShips,
        hoveredShipId: nextHoveredShipId,
      },
    };

    if (nextHoveredShipId && nextHoveredShipId !== previousHoveredShipId) {
      this.asteroidHoverScanPhase = Math.PI / 2;
    }
  }

  getScannableDebrisSamples(): readonly ShipSceneScannableDebrisSample[] {
    let scannableDebris = this.state.scannableDebris;
    if (!scannableDebris) {
      scannableDebris = normalizeScannableDebrisState();
      this.state = {
        ...this.state,
        scannableDebris,
      };
    }
    return scannableDebris.samples.map((sample) => cloneScannableDebrisSample(sample));
  }

  setScannableDebrisSamples(samples: readonly ShipSceneScannableDebrisSample[]): void {
    const previousHoveredDebrisId = this.state.scannableDebris?.hoveredDebrisId ?? null;
    const nextState = normalizeScannableDebrisState({
      samples: samples.map((sample) => cloneScannableDebrisSample(sample)),
      hoveredDebrisId: previousHoveredDebrisId,
    });
    this.state = {
      ...this.state,
      scannableDebris: nextState,
    };
  }

  getHoveredScannableDebrisId(): string | null {
    return this.state.scannableDebris?.hoveredDebrisId ?? null;
  }

  setHoveredScannableDebrisId(debrisId: string | null): void {
    const scannableDebris = this.state.scannableDebris ?? normalizeScannableDebrisState();
    const hoverStillExists = debrisId ? scannableDebris.samples.some((sample) => sample.id === debrisId) : false;
    const nextHoveredDebrisId = hoverStillExists ? debrisId : null;
    const previousHoveredDebrisId = scannableDebris.hoveredDebrisId ?? null;
    this.state = {
      ...this.state,
      scannableDebris: {
        ...scannableDebris,
        hoveredDebrisId: nextHoveredDebrisId,
      },
    };

    if (nextHoveredDebrisId && nextHoveredDebrisId !== previousHoveredDebrisId) {
      this.asteroidHoverScanPhase = Math.PI / 2;
    }
  }

  setTargetedAsteroidId(sampleId: string | null): void {
    const asteroid = this.state.asteroid ?? normalizeAsteroidState();
    const targetStillExists = sampleId ? asteroid.samples.some((sample) => sample.id === sampleId) : false;
    this.state = {
      ...this.state,
      asteroid: {
        ...asteroid,
        targetedAsteroidId: targetStillExists ? sampleId : null,
        targetHoldCandidateId:
          targetStillExists && asteroid.targetHoldCandidateId === sampleId ? null : asteroid.targetHoldCandidateId,
      },
    };
  }

  setTargetHoldCandidateId(sampleId: string | null): void {
    const asteroid = this.state.asteroid ?? normalizeAsteroidState();
    const holdStillExists = sampleId ? asteroid.samples.some((sample) => sample.id === sampleId) : false;
    const nextHoldCandidateId = holdStillExists ? sampleId : null;
    const previousHoldCandidateId = asteroid.targetHoldCandidateId ?? null;
    this.state = {
      ...this.state,
      asteroid: {
        ...asteroid,
        targetHoldCandidateId: nextHoldCandidateId,
      },
    };

    if (nextHoldCandidateId && nextHoldCandidateId !== previousHoldCandidateId) {
      this.asteroidTargetHoldPhase = 0;
    }
  }

  setHoveredAsteroidId(sampleId: string | null): void {
    const asteroid = this.state.asteroid ?? normalizeAsteroidState();
    const hoverStillExists = sampleId ? asteroid.samples.some((sample) => sample.id === sampleId) : false;
    const nextHoveredAsteroidId = hoverStillExists ? sampleId : null;
    const previousHoveredAsteroidId = asteroid.hoveredAsteroidId ?? null;
    this.state = {
      ...this.state,
      asteroid: {
        ...asteroid,
        hoveredAsteroidId: nextHoveredAsteroidId,
      },
    };

    if (nextHoveredAsteroidId && nextHoveredAsteroidId !== previousHoveredAsteroidId) {
      this.asteroidHoverScanPhase = Math.PI / 2;
    }
  }

  getMissionGateState(): ShipExteriorMissionGateState | null {
    return this.state.mission ? cloneMissionGateState(this.state.mission) : null;
  }

  setMissionGateState(state: ShipExteriorMissionGateState): void {
    this.state = {
      ...this.state,
      mission: cloneMissionGateState(state),
    };
  }

  hasRouteFeeds(): boolean {
    return this.routeFeeds !== null;
  }

  getRouteFeeds(): ShipExteriorRouteFeeds | null {
    if (!this.routeFeeds) {
      return null;
    }

    return {
      gates: [...this.routeFeeds.gates],
      stations: [...this.routeFeeds.stations],
      encounterShips: [...this.routeFeeds.encounterShips],
    };
  }

  setRouteFeeds(routeFeeds: ShipExteriorRouteFeeds): void {
    this.routeFeeds = {
      gates: [...routeFeeds.gates],
      stations: [...routeFeeds.stations],
      encounterShips: [...routeFeeds.encounterShips],
    };
  }

  getRouteFeedCounts(): ShipExteriorRouteFeedCounts | null {
    if (!this.routeFeeds) {
      return null;
    }

    return summarizeShipExteriorRouteFeeds(this.routeFeeds);
  }

  getStarfieldSignature(): string {
    return this.starfieldSignature;
  }

  getAsteroidLayoutSignature(): string {
    return buildAsteroidLayoutSignature(
      this.state.shipId,
      this.state.asteroid?.samples ?? DEFAULT_ASTEROID_SAMPLES,
      this.state.asteroid?.targetedAsteroidId ?? null,
    );
  }

  initializeRendering(): ShipSceneRenderingState {
    if (this.renderingState) {
      return this.renderingState;
    }

    if (typeof document === 'undefined') {
      throw new Error('ShipSceneContext.initializeRendering requires a browser document.');
    }

    const canvas = document.createElement('canvas');
    canvas.className = 'ship-scene-canvas';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#03111b');

    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.set(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    const pixelRatio = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);

    const ambient = new THREE.AmbientLight('#cfe3ff', 0.65);
    const directional = new THREE.DirectionalLight('#ffffff', 0.85);
    directional.position.set(3, 5, 4);

    const { points: starfieldPoints, signature: starfieldSignatureLocal } = createStarfieldPoints(this.starfieldSeed);
    // Applied via scene.environment so all current and future PBR-capable scene materials
    // (ship, stations, gates, asteroids) receive reflections automatically from three.js's
    // standard material pipeline, without per-object envMap wiring as new object types are added.
    const environmentTexture = createAsteroidEnvironmentTexture();
    if (environmentTexture) {
      scene.environment = environmentTexture;
    }
    const asteroidGroup = new THREE.Group();
    asteroidGroup.name = 'ship-scene-asteroid-group';
    const debrisGroup = new THREE.Group();
    debrisGroup.name = 'ship-scene-debris-group';
    const stationGroup = new THREE.Group();
    stationGroup.name = 'ship-scene-station-group';
    const gateGroup = new THREE.Group();
    gateGroup.name = 'ship-scene-gate-group';
    const shipGroup = new THREE.Group();
    shipGroup.name = 'ship-scene-jaxs-ship-group';
    const worldRelativeGroup = new THREE.Group();
    worldRelativeGroup.name = 'ship-scene-world-relative-group';
    const pilotRig = new THREE.Group();
    pilotRig.name = 'ship-scene-pilot-rig';
    const pilotLookRig = new THREE.Group();
    pilotLookRig.name = 'ship-scene-pilot-look-rig';

    scene.add(ambient);
    scene.add(directional);
    scene.add(worldRelativeGroup);
    worldRelativeGroup.add(starfieldPoints, shipGroup, stationGroup, gateGroup, debrisGroup, asteroidGroup);
    scene.add(pilotRig);
    pilotRig.add(pilotLookRig);
    pilotLookRig.add(camera);

    this.renderingState = {
      scene,
      camera,
      renderer,
      canvas,
      worldRelativeGroup,
      pilotRig,
      pilotLookRig,
      shipGroup,
      stationGroup,
      gateGroup,
      debrisGroup,
      asteroidGroup,
      starfieldPoints,
      environmentTexture,
      starfieldSignatureLocal,
      asteroidLayoutSignatureLocal: this.getAsteroidLayoutSignature(),
      isPausedLocal: true,
      animationFrameId: null,
    };

    this.ensureFlightController();
    this.syncFlightControllerToState();
    void this.loadJaxsShip(shipGroup);

    return this.renderingState;
  }

  getRenderingState(): ShipSceneRenderingState | null {
    return this.renderingState;
  }

  getRenderedFrameCount(): number {
    return this.renderedFrameCount;
  }

  getPerformanceTelemetry(): ShipScenePerformanceTelemetry {
    const sampleCount = this.framePressureSampler.getSampleCount();
    const paused = this.isPaused();
    return {
      status: paused ? 'paused' : sampleCount === 0 ? 'sampling' : 'current',
      averageFrameTimeMs: paused || sampleCount === 0 ? null : this.framePressureSampler.getAverage(),
      sampleCount,
      asteroidDetailCapMultiplier: this.appliedAsteroidDetailCapMultiplier,
      detailCapThresholdMs: FRAME_PRESSURE_DETAIL_CAP_THRESHOLD_MS,
    };
  }

  setViewport(width: number, height: number): void {
    if (!this.renderingState) {
      return;
    }

    const safeWidth = Math.max(1, Math.floor(width));
    const safeHeight = Math.max(1, Math.floor(height));

    this.renderingState.camera.aspect = safeWidth / safeHeight;
    this.renderingState.camera.updateProjectionMatrix();
    this.renderingState.renderer.setSize(safeWidth, safeHeight, false);
  }

  pause(): void {
    const wasPaused = this.isPaused();
    this.paused = true;
    this.syncFlightStateFromController();
    this.flightController?.stop();
    if (!wasPaused) {
      this.resetFramePressureSampling();
    }
    if (!this.renderingState) {
      return;
    }
    this.renderingState.isPausedLocal = true;
  }

  resume(): void {
    if (!this.paused && this.renderingState?.isPausedLocal === false) {
      return;
    }

    this.resetFramePressureSampling();
    this.paused = false;
    if (!this.renderingState) {
      return;
    }
    this.renderingState.isPausedLocal = false;
    this.syncFlightControllerToState();
  }

  isPaused(): boolean {
    return this.renderingState?.isPausedLocal ?? this.paused;
  }

  renderFrame(): void {
    if (!this.renderingState || this.isPaused()) {
      return;
    }

    const now = typeof performance === 'undefined' ? 0 : performance.now();
    if (this.lastFrameTimestamp > 0) {
      this.framePressureSampler.addSample(now - this.lastFrameTimestamp);
    }
    this.lastFrameTimestamp = now;
    if (
      this.state.asteroid?.hoveredAsteroidId ||
      this.state.scannableShips?.hoveredShipId ||
      this.state.scannableDebris?.hoveredDebrisId
    ) {
      this.asteroidHoverScanPhase = (this.asteroidHoverScanPhase + 0.12) % SCAN_RING_PHASE_WRAP_PERIOD;
    }
    if (this.state.asteroid?.targetHoldCandidateId) {
      this.asteroidTargetHoldPhase = (this.asteroidTargetHoldPhase + 0.16) % SCAN_RING_PHASE_WRAP_PERIOD;
    }
    if ((this.routeFeeds?.stations.length ?? 0) > 0) {
      this.stationPulsePhase = (this.stationPulsePhase + 0.08) % (Math.PI * 2);
    }
    if ((this.routeFeeds?.gates.length ?? 0) > 0) {
      this.gatePulsePhase = (this.gatePulsePhase + 0.06) % (Math.PI * 2);
    }
    this.syncDebrisVisuals();
    this.advanceDebrisAnimation();
    this.syncScannableDebrisHoverScanShell();
    this.syncRouteFeedVisuals();
    this.syncAsteroidVisuals();
    this.advanceAsteroidOrbit();
    this.advanceAsteroidSpin();
    this.syncScannableShipHoverScanShell();
    this.renderingState.renderer.render(this.renderingState.scene, this.renderingState.camera);
    this.renderedFrameCount += 1;
  }

  toggleFlightMode(): void {
    this.updateFlightState({ enabled: true });
    const controller = this.ensureFlightController();
    if (!controller) {
      return;
    }

    controller.setFlightModeEnabled(true);
    if (!this.paused) {
      controller.start();
    }
    this.syncFlightStateFromController();
  }

  setFlightInvertY(enabled: boolean): void {
    this.updateFlightState({ invertY: enabled });
    const controller = this.ensureFlightController();
    controller?.setFlightInvertY(enabled);
  }

  setFlightMouseSensitivityFromSliderValue(rawValue: number): void {
    this.updateFlightState({ mouseSensitivity: rawValue / 10000 });
    const controller = this.ensureFlightController();
    controller?.setFlightMouseSensitivityFromSliderValue(rawValue);
    this.syncFlightStateFromController();
  }

  captureFlightMovementKey(code: string): boolean {
    return this.ensureFlightController()?.captureFlightMovementKey(code) ?? false;
  }

  clearFlightMovementInput(): void {
    this.flightController?.clearMovementInput();
    this.syncFlightStateFromController();
  }

  releaseFlightMovementKey(code: string): boolean {
    return this.ensureFlightController()?.releaseFlightMovementKey(code) ?? false;
  }

  applyFlightMouseMove(movementX: number, movementY: number): void {
    this.ensureFlightController()?.applyMouseMove(movementX, movementY);
    this.syncFlightStateFromController();
  }

  flightModeEnabled(): boolean {
    return this.flightController?.flightModeEnabled() ?? this.state.flight?.enabled ?? false;
  }

  flightPointerLocked(): boolean {
    return Boolean(
      this.renderingState?.canvas &&
      typeof document !== 'undefined' &&
      document.pointerLockElement === this.renderingState.canvas,
    );
  }

  snapshotRuntime(): ShipSceneRuntimeSnapshot | null {
    if (!this.renderingState) {
      return null;
    }

    this.syncFlightStateFromController();
    const flight = this.state.flight ?? DEFAULT_FLIGHT_STATE;

    return {
      cameraPosition: {
        x: this.renderingState.camera.position.x,
        y: this.renderingState.camera.position.y,
        z: this.renderingState.camera.position.z,
      },
      starfieldSignature: this.renderingState.starfieldSignatureLocal,
      isPaused: this.isPaused(),
      renderedFrameCount: this.renderedFrameCount,
      flightModeEnabled: flight.enabled,
      flightCurrentLocationKm: { ...flight.currentLocationKm },
      flightWorldOffset: { ...flight.worldOffset },
      flightWorldRotation: { ...flight.worldRotation },
      flightSpeedKmPerSec: flight.speedKmPerSec,
      performance: this.getPerformanceTelemetry(),
    };
  }

  /**
   * Reports the live scene-graph state of a targeted asteroid's lock-on bracket.
   * Used by end-to-end tests to confirm the bracket is genuinely wired into the
   * rendered scene and remains static across frames.
   */
  snapshotAsteroidTargetBracket(sampleId: string): ShipSceneAsteroidTargetBracketSnapshot | null {
    if (!this.renderingState) {
      return null;
    }

    const mesh = this.renderingState.asteroidGroup.children.find(
      (child): child is THREE.Mesh => child instanceof THREE.Mesh && child.name === sampleId,
    );
    if (!mesh) {
      return null;
    }

    const camera = this.renderingState.camera;
    const cameraWorldQuaternion = new THREE.Quaternion();
    if (camera instanceof THREE.Object3D) {
      camera.getWorldQuaternion(cameraWorldQuaternion);
    }

    const group = (mesh.userData as { targetedGroup?: THREE.Group }).targetedGroup;
    if (!group) {
      return {
        sampleId,
        present: false,
        segmentCount: 0,
        worldScale: { x: 1, y: 1, z: 1 },
        armPositions: [],
        armOpacity: null,
        worldQuaternion: { x: 0, y: 0, z: 0, w: 1 },
        cameraWorldQuaternion: {
          x: cameraWorldQuaternion.x,
          y: cameraWorldQuaternion.y,
          z: cameraWorldQuaternion.z,
          w: cameraWorldQuaternion.w,
        },
      };
    }

    const worldQuaternion = new THREE.Quaternion();
    group.getWorldQuaternion(worldQuaternion);
    const worldScale = new THREE.Vector3();
    group.getWorldScale(worldScale);

    const firstArm = group.children[0];
    const firstArmMaterial = firstArm instanceof THREE.Mesh ? firstArm.material : null;
    const armOpacity =
      !Array.isArray(firstArmMaterial) && firstArmMaterial instanceof THREE.MeshBasicMaterial
        ? firstArmMaterial.opacity
        : null;

    return {
      sampleId,
      present: true,
      segmentCount: group.children.length,
      worldScale: { x: worldScale.x, y: worldScale.y, z: worldScale.z },
      armPositions: group.children.map((arm) => ({ x: arm.position.x, y: arm.position.y, z: arm.position.z })),
      armOpacity,
      worldQuaternion: {
        x: worldQuaternion.x,
        y: worldQuaternion.y,
        z: worldQuaternion.z,
        w: worldQuaternion.w,
      },
      cameraWorldQuaternion: {
        x: cameraWorldQuaternion.x,
        y: cameraWorldQuaternion.y,
        z: cameraWorldQuaternion.z,
        w: cameraWorldQuaternion.w,
      },
    };
  }

  disposeRendering(): void {
    if (!this.renderingState) {
      return;
    }

    this.syncFlightStateFromController();
    this.flightController?.stop();
    disposeShipGroup(this.renderingState.shipGroup);
    disposeStationGroup(this.renderingState.stationGroup);
    disposeGateGroup(this.renderingState.gateGroup);
    disposeDebrisGroup(this.renderingState.debrisGroup);
    disposeAsteroidGroup(this.renderingState.asteroidGroup);
    if (this.renderingState.starfieldPoints.geometry) {
      this.renderingState.starfieldPoints.geometry.dispose();
    }
    this.renderingState.environmentTexture?.dispose();
    if (Array.isArray(this.renderingState.starfieldPoints.material)) {
      this.renderingState.starfieldPoints.material.forEach((material) => material.dispose());
    } else {
      this.renderingState.starfieldPoints.material.dispose();
    }
    this.renderingState.renderer.dispose();
    this.renderingState.canvas.remove();
    this.renderingState = null;
    this.lastAsteroidTiers = new Map();
    this.asteroidTierFrameCounter = 0;
    this.framePressureSampler.reset();
    this.lastFrameTimestamp = 0;
    this.appliedAsteroidDetailCapMultiplier = 1;
    this.paused = true;
    this.renderedFrameCount = 0;
  }

  private async loadJaxsShip(shipGroup: THREE.Group): Promise<void> {
    const generation = this.shipLoadGeneration + 1;
    this.shipLoadGeneration = generation;

    const gltf = await this.gltfLoader.loadAsync(JAXS_SHIP_ASSET_PATH);
    if (!this.renderingState || this.shipLoadGeneration !== generation) {
      return;
    }

    const shipScene = gltf.scene.clone(true);
    shipScene.name = 'jaxs-ship';
    shipScene.position.set(...JAXS_SHIP_POSITION);
    shipScene.rotation.set(...JAXS_SHIP_ROTATION);
    shipScene.scale.setScalar(JAXS_SHIP_SCALE);
    shipScene.userData['scannableShipId'] = JAXS_SHIP_SCAN_ID;
    shipScene.traverse((node) => {
      node.userData['scannableShipId'] = JAXS_SHIP_SCAN_ID;
    });
    shipGroup.add(shipScene);
  }

  private syncScannableDebrisHoverScanShell(): void {
    if (!this.renderingState) {
      return;
    }

    const scannedDebrisIds = new Set(
      this.getScannableDebrisSamples()
        .filter((sample) => sample.scanned)
        .map((sample) => sample.id),
    );

    this.renderingState.debrisGroup.children.forEach((child) => {
      const childDebrisId = child.userData?.['scannableDebrisId'];
      const debrisId = typeof childDebrisId === 'string' ? childDebrisId : null;
      if (!debrisId) {
        return;
      }
      const isHovered = this.state.scannableDebris?.hoveredDebrisId === debrisId;
      const isScanned = scannedDebrisIds.has(debrisId);
      const shouldShowHoverRing = isHovered && !isScanned;
      const userData = child.userData as {
        hoverScanGroup?: THREE.Group;
      };

      if (!shouldShowHoverRing) {
        if (userData.hoverScanGroup) {
          child.remove(userData.hoverScanGroup);
          disposeHoverScanGroup(userData.hoverScanGroup);
          delete userData.hoverScanGroup;
        }
        return;
      }

      if (!userData.hoverScanGroup) {
        const group = new THREE.Group();
        group.name = `${debrisId}-hover-scan-group`;
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.52, 0.022, 10, 64),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color('#86e8ff'),
            transparent: true,
            opacity: 0.78,
            depthWrite: false,
          }),
        );
        ring.name = `${debrisId}-hover-scan-ring`;
        ring.rotation.x = Math.PI / 2;
        group.add(ring);
        child.add(group);
        userData.hoverScanGroup = group;
      }

      const ring = userData.hoverScanGroup?.children[0];
      if (!(ring instanceof THREE.Mesh)) {
        return;
      }
      ring.rotation.x = Math.PI / 2;
      ring.rotation.y = this.asteroidHoverScanPhase * 0.9;
      ring.scale.setScalar(1 + Math.sin(this.asteroidHoverScanPhase) * 0.06);
      if (ring.material instanceof THREE.MeshBasicMaterial) {
        ring.material.opacity = 0.66 + Math.max(0, Math.sin(this.asteroidHoverScanPhase)) * 0.18;
      }
    });
  }

  private syncScannableShipHoverScanShell(): void {
    if (!this.renderingState) {
      return;
    }

    const scannedShipIds = new Set(
      this.getScannableShipSamples()
        .filter((sample) => sample.scanned)
        .map((sample) => sample.id),
    );

    this.renderingState.shipGroup.children.forEach((child) => {
      const childShipId = child.userData?.['scannableShipId'];
      const shipId = typeof childShipId === 'string' ? childShipId : null;
      if (!shipId) {
        return;
      }
      const isHovered = this.state.scannableShips?.hoveredShipId === shipId;
      const isScanned = scannedShipIds.has(shipId);
      const shouldShowHoverRing = isHovered && !isScanned;
      const userData = child.userData as {
        hoverScanGroup?: THREE.Group;
      };

      if (!shouldShowHoverRing) {
        if (userData.hoverScanGroup) {
          child.remove(userData.hoverScanGroup);
          disposeHoverScanGroup(userData.hoverScanGroup);
          delete userData.hoverScanGroup;
        }
        return;
      }

      if (!userData.hoverScanGroup) {
        const group = new THREE.Group();
        group.name = `${shipId}-hover-scan-group`;
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.75, 0.024, 10, 64),
          new THREE.MeshBasicMaterial({
            color: new THREE.Color('#86e8ff'),
            transparent: true,
            opacity: 0.78,
            depthWrite: false,
          }),
        );
        ring.name = `${shipId}-hover-scan-ring`;
        ring.rotation.x = Math.PI / 2;
        group.add(ring);
        child.add(group);
        userData.hoverScanGroup = group;
      }

      const ring = userData.hoverScanGroup?.children[0];
      if (!(ring instanceof THREE.Mesh)) {
        return;
      }
      ring.rotation.x = Math.PI / 2;
      ring.rotation.y = this.asteroidHoverScanPhase * 0.9;
      ring.scale.setScalar(1 + Math.sin(this.asteroidHoverScanPhase) * 0.06);
      if (ring.material instanceof THREE.MeshBasicMaterial) {
        ring.material.opacity = 0.66 + Math.max(0, Math.sin(this.asteroidHoverScanPhase)) * 0.18;
      }
    });
  }

  private syncDebrisVisuals(): void {
    if (!this.renderingState) {
      return;
    }

    const renderingState = this.renderingState;
    const debris = this.state.debris ?? [];
    const nextIds = new Set(debris.map((item) => item.id));

    renderingState.debrisGroup.children.slice().forEach((child) => {
      if (child.name && !nextIds.has(child.name)) {
        renderingState.debrisGroup.remove(child);
        if (child instanceof THREE.Group) {
          disposeDebrisGroup(child);
        } else if (child instanceof THREE.Mesh) {
          disposeMesh(child);
        }
      }
    });

    const existingById = new Map<string, THREE.Group>();
    renderingState.debrisGroup.children.forEach((child) => {
      if (child instanceof THREE.Group) {
        existingById.set(child.name, child);
      }
    });

    debris.forEach((item) => {
      const existing = existingById.get(item.id);
      if (existing) {
        this.applyDebrisVisual(existing, item);
        return;
      }

      renderingState.debrisGroup.add(this.createDebrisVisual(item));
    });
  }

  private syncRouteFeedVisuals(): void {
    if (!this.renderingState) {
      return;
    }

    const stations = this.routeFeeds?.stations ?? [];
    const renderingState = this.renderingState;
    const nextIds = new Set(stations.map((station) => station.marketId));

    renderingState.stationGroup.children.slice().forEach((child) => {
      if (child.name && !nextIds.has(child.name)) {
        renderingState.stationGroup.remove(child);
        if (child instanceof THREE.Group) {
          disposeStationGroup(child);
        } else if (child instanceof THREE.Mesh) {
          disposeMesh(child);
        }
      }
    });

    const existingById = new Map<string, THREE.Group>();
    renderingState.stationGroup.children.forEach((child) => {
      if (child instanceof THREE.Group) {
        existingById.set(child.name, child);
      }
    });

    stations.forEach((station, index) => {
      const existing = existingById.get(station.marketId);
      if (existing) {
        this.applyStationVisual(existing, station, index);
        return;
      }

      renderingState.stationGroup.add(this.createStationVisual(station, index));
    });

    const gates = this.routeFeeds?.gates ?? [];
    const nextGateIds = new Set(gates.map((gate) => gate.gateId));

    renderingState.gateGroup.children.slice().forEach((child) => {
      if (child.name && !nextGateIds.has(child.name)) {
        renderingState.gateGroup.remove(child);
        if (child instanceof THREE.Group) {
          disposeGateGroup(child);
        } else if (child instanceof THREE.Mesh) {
          disposeMesh(child);
        }
      }
    });

    const existingGatesById = new Map<string, THREE.Group>();
    renderingState.gateGroup.children.forEach((child) => {
      if (child instanceof THREE.Group) {
        existingGatesById.set(child.name, child);
      }
    });

    gates.forEach((gate, index) => {
      const existing = existingGatesById.get(gate.gateId);
      if (existing) {
        this.applyGateVisual(existing, gate, index);
        return;
      }

      renderingState.gateGroup.add(this.createGateVisual(gate, index));
    });
  }

  private createStationVisual(
    station: NonNullable<ShipExteriorRouteFeeds['stations']>[number],
    index: number,
  ): THREE.Group {
    const group = new THREE.Group();
    group.name = station.marketId;
    this.applyStationVisual(group, station, index);
    return group;
  }

  private applyStationVisual(
    group: THREE.Group,
    station: NonNullable<ShipExteriorRouteFeeds['stations']>[number],
    index: number,
  ): void {
    const profile = resolveDescriptorRenderProfile(station.descriptor);
    const ship = this.state.flight?.currentLocationKm ?? this.state.world?.shipPosition ?? ZERO_VECTOR;
    const descriptorColor = profile?.color ?? '#f97316';
    const emissiveColor = profile?.emissive ?? '#7c2d12';
    const emissiveIntensity = profile?.emissiveIntensity ?? 0.22;

    if (group.children.length === 0) {
      const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(1.15, 0),
        new THREE.MeshStandardMaterial({
          color: descriptorColor,
          emissive: emissiveColor,
          emissiveIntensity: Math.max(emissiveIntensity, 0.3),
          roughness: profile?.roughness ?? 0.56,
          metalness: profile?.metalness ?? 0.38,
        }),
      );
      core.name = `${station.marketId}-core`;
      group.add(core);

      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(1.72, 0.1, 12, 36),
        new THREE.MeshBasicMaterial({
          color: '#ffe08a',
          transparent: true,
          opacity: 0.64,
          depthWrite: false,
        }),
      );
      halo.name = `${station.marketId}-halo`;
      halo.rotation.x = Math.PI / 2;
      group.add(halo);
    }

    const positionKm = station.spatial.positionKm;
    group.position.set(
      (positionKm.x - ship.x) * ROUTE_FEED_KM_TO_SCENE_UNITS,
      (positionKm.y - ship.y) * ROUTE_FEED_KM_TO_SCENE_UNITS,
      (positionKm.z - ship.z) * ROUTE_FEED_KM_TO_SCENE_UNITS,
    );
    group.rotation.y = this.stationPulsePhase * 0.6 + index * 0.45;
    group.rotation.z = Math.sin(this.stationPulsePhase + index * 0.2) * 0.08;
    group.scale.setScalar(1 + Math.max(0, Math.sin(this.stationPulsePhase + index * 0.4)) * 0.04);
  }

  private createGateVisual(gate: NonNullable<ShipExteriorRouteFeeds['gates']>[number], index: number): THREE.Group {
    const group = new THREE.Group();
    group.name = gate.gateId;
    this.applyGateVisual(group, gate, index);
    return group;
  }

  private applyGateVisual(
    group: THREE.Group,
    gate: NonNullable<ShipExteriorRouteFeeds['gates']>[number],
    index: number,
  ): void {
    const profile = resolveDescriptorRenderProfile(gate.descriptor);
    const ship = this.state.flight?.currentLocationKm ?? this.state.world?.shipPosition ?? ZERO_VECTOR;
    const descriptorColor = profile?.color ?? '#38bdf8';
    const emissiveColor = profile?.emissive ?? '#0c4a6e';
    const emissiveIntensity = profile?.emissiveIntensity ?? 0.22;

    if (group.children.length === 0) {
      const core = new THREE.Mesh(
        new THREE.TorusGeometry(1.35, 0.14, 12, 42),
        new THREE.MeshStandardMaterial({
          color: descriptorColor,
          emissive: emissiveColor,
          emissiveIntensity: Math.max(emissiveIntensity, 0.2),
          roughness: profile?.roughness ?? 0.5,
          metalness: profile?.metalness ?? 0.42,
        }),
      );
      core.name = `${gate.gateId}-core`;
      core.rotation.x = Math.PI / 2;
      group.add(core);

      const halo = new THREE.Mesh(
        new THREE.TorusGeometry(1.95, 0.08, 10, 42),
        new THREE.MeshBasicMaterial({
          color: '#8fe7ff',
          transparent: true,
          opacity: 0.58,
          depthWrite: false,
        }),
      );
      halo.name = `${gate.gateId}-halo`;
      halo.rotation.x = Math.PI / 2;
      group.add(halo);
    }

    const positionKm = gate.spatial.positionKm;
    group.position.set(
      (positionKm.x - ship.x) * ROUTE_FEED_KM_TO_SCENE_UNITS,
      (positionKm.y - ship.y) * ROUTE_FEED_KM_TO_SCENE_UNITS,
      (positionKm.z - ship.z) * ROUTE_FEED_KM_TO_SCENE_UNITS,
    );
    group.rotation.y = this.gatePulsePhase * 0.5 + index * 0.3;
    group.rotation.z = Math.sin(this.gatePulsePhase + index * 0.15) * 0.05;
    group.scale.setScalar(1 + Math.max(0, Math.sin(this.gatePulsePhase + index * 0.35)) * 0.03);
  }

  private createDebrisVisual(item: FloatingDebrisItem): THREE.Group {
    const group = new THREE.Group();
    group.name = item.id;
    const spinProfile = createDebrisSpinProfile(item.id);
    (group.userData as { debrisSpinProfile?: DebrisSpinProfile }).debrisSpinProfile = spinProfile;
    group.rotation.set(spinProfile.orientation[0], spinProfile.orientation[1], spinProfile.orientation[2]);
    this.applyDebrisVisual(group, item);
    return group;
  }

  private applyDebrisVisual(group: THREE.Group, item: FloatingDebrisItem): void {
    group.userData['scannableDebrisId'] = item.id;
    const profile = resolveDescriptorRenderProfile(item.externalObjectDescriptor ?? undefined);
    const family = item.externalObjectDescriptor?.objectFamily ?? 'field-shard';
    const geometry = this.resolveDebrisGeometry(family);
    const material = new THREE.MeshStandardMaterial({
      color: profile?.color ?? '#5ad9ff',
      emissive: profile?.emissive ?? '#4dc7f2',
      emissiveIntensity: profile?.emissiveIntensity ?? 1.2,
      metalness: profile?.metalness ?? 0.35,
      roughness: profile?.roughness ?? 0.42,
    });

    if (group.children.length === 0) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = `${item.id}-mesh`;
      group.add(mesh);
    } else {
      const mesh = group.children[0];
      if (mesh instanceof THREE.Mesh) {
        disposeMesh(mesh);
        mesh.geometry = geometry;
        mesh.material = material;
      }
    }

    const ship = this.state.flight?.currentLocationKm ?? this.state.world?.shipPosition ?? ZERO_VECTOR;
    group.position.set(
      (item.positionKm.x - ship.x) * DEBRIS_KM_TO_SCENE_UNITS,
      (item.positionKm.y - ship.y) * DEBRIS_KM_TO_SCENE_UNITS,
      (item.positionKm.z - ship.z) * DEBRIS_KM_TO_SCENE_UNITS,
    );
    const userData = group.userData as { debrisSpinProfile?: DebrisSpinProfile };
    if (!userData.debrisSpinProfile) {
      userData.debrisSpinProfile = createDebrisSpinProfile(item.id);
    }
    group.scale.setScalar(1);
    group.traverse((node) => {
      node.userData['scannableDebrisId'] = item.id;
    });
  }

  private resolveDebrisGeometry(objectFamily: string): THREE.BufferGeometry {
    switch (objectFamily) {
      case 'cargo-canister':
        return new THREE.CapsuleGeometry(0.18, 0.28, 5, 10);
      case 'wreckage-panel':
        return new THREE.BoxGeometry(0.52, 0.24, 0.08);
      case 'salvage-fragment':
        return new THREE.IcosahedronGeometry(0.2, 0);
      default:
        return new THREE.OctahedronGeometry(0.22, 0);
    }
  }

  private syncAsteroidVisuals(): void {
    if (!this.renderingState) {
      return;
    }

    const nextSignature = this.getAsteroidLayoutSignature();
    const visuals = deriveAsteroidVisuals(
      this.state.shipId,
      this.state.asteroid?.samples ?? DEFAULT_ASTEROID_SAMPLES,
      this.state.asteroid?.targetedAsteroidId ?? null,
      this.state.asteroid?.hoveredAsteroidId ?? null,
    );

    const layoutChanged =
      this.asteroidLayoutSignature !== nextSignature ||
      this.renderingState.asteroidGroup.children.length !== visuals.length;

    // Recompute tiers only on layout change or at a bounded cadence to avoid adding
    // per-frame allocation/sort overhead on top of the existing per-frame visual derivation.
    this.asteroidTierFrameCounter += 1;
    const shouldRecomputeTiers =
      layoutChanged ||
      this.lastAsteroidTiers.size !== visuals.length ||
      this.asteroidTierFrameCounter >= ShipSceneContext.ASTEROID_TIER_RECOMPUTE_INTERVAL_FRAMES;

    if (shouldRecomputeTiers) {
      this.asteroidTierFrameCounter = 0;
      const tierSamples = visuals.map((visual) => ({
        id: visual.id,
        position: visual.position,
        scanned: visual.isScanned,
      }));
      const averageFrameTimeMs =
        this.framePressureSampler.getSampleCount() > 0 ? this.framePressureSampler.getAverage() : null;
      this.appliedAsteroidDetailCapMultiplier = resolveAsteroidDetailCapMultiplier(averageFrameTimeMs);
      this.lastAsteroidTiers = assignAsteroidRenderTiers(
        tierSamples,
        {
          cameraPosition: [
            this.renderingState.camera.position.x,
            this.renderingState.camera.position.y,
            this.renderingState.camera.position.z,
          ],
          targetedAsteroidId: this.state.asteroid?.targetedAsteroidId ?? null,
          activeScanAsteroidId: this.state.asteroid?.hoveredAsteroidId ?? null,
          scannedOnlyHero: true,
        },
        undefined,
        undefined,
        { capMultiplier: this.appliedAsteroidDetailCapMultiplier },
      );
    }

    visuals.forEach((visual) => {
      visual.renderTier = this.lastAsteroidTiers.get(visual.id) ?? 'background';
      const detailOverride = resolveAsteroidTierDetailOverride(visual.renderTier, visual.isScanned);
      if (detailOverride !== null) {
        visual.detail = detailOverride;
      }
    });

    if (layoutChanged) {
      this.asteroidLayoutSignature = nextSignature;
      this.renderingState.asteroidLayoutSignatureLocal = nextSignature;
      disposeAsteroidGroup(this.renderingState.asteroidGroup);

      for (const visual of visuals) {
        this.renderingState.asteroidGroup.add(this.createAsteroidMesh(visual));
      }
      return;
    }

    const visualsById = new Map<string, ShipExteriorAsteroidVisual>();
    visuals.forEach((visual) => visualsById.set(visual.id, visual));
    this.renderingState.asteroidGroup.children.forEach((child) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }

      const visual = visualsById.get(child.name);
      if (!visual) {
        return;
      }

      this.applyAsteroidVisualToMesh(child, visual);
    });
  }

  private resetFramePressureSampling(): void {
    this.framePressureSampler.reset();
    this.lastFrameTimestamp = 0;
  }

  private advanceAsteroidOrbit(): void {
    if (!this.renderingState) {
      return;
    }

    this.asteroidOrbitElapsedSeconds =
      (this.asteroidOrbitElapsedSeconds + ASTEROID_ORBIT_FRAME_SECONDS) % ASTEROID_ORBIT_PHASE_WRAP_SECONDS;

    for (const child of this.renderingState.asteroidGroup.children) {
      if (!(child instanceof THREE.Mesh)) {
        continue;
      }

      const userData = child.userData as {
        orbitProfile?: AsteroidOrbitProfile;
        orbitBasePosition?: [number, number, number];
      };
      if (!userData.orbitProfile) {
        userData.orbitProfile = createAsteroidOrbitProfile(child.name);
      }
      const base = userData.orbitBasePosition;
      if (!base) {
        continue;
      }

      const offset = resolveAsteroidOrbitOffset(userData.orbitProfile, this.asteroidOrbitElapsedSeconds);
      child.position.set(base[0] + offset[0], base[1] + offset[1], base[2] + offset[2]);
    }
  }

  private advanceDebrisAnimation(): void {
    if (!this.renderingState || (this.state.debris?.length ?? 0) === 0) {
      return;
    }

    for (const child of this.renderingState.debrisGroup.children) {
      if (!(child instanceof THREE.Group)) {
        continue;
      }

      const userData = child.userData as { debrisSpinProfile?: DebrisSpinProfile };
      if (!userData.debrisSpinProfile) {
        userData.debrisSpinProfile = createDebrisSpinProfile(child.name);
      }

      const [spinX, spinY, spinZ] = userData.debrisSpinProfile.spin;
      child.rotation.x += spinX * DEBRIS_SPIN_FRAME_SECONDS;
      child.rotation.y += spinY * DEBRIS_SPIN_FRAME_SECONDS;
      child.rotation.z += spinZ * DEBRIS_SPIN_FRAME_SECONDS;
    }
  }

  private advanceAsteroidSpin(): void {
    if (!this.renderingState) {
      return;
    }

    const scannedKinematicsById = new Map<string, AsteroidKinematics>();
    for (const sample of this.state.asteroid?.samples ?? DEFAULT_ASTEROID_SAMPLES) {
      if (sample.scanned && sample.revealedKinematics) {
        scannedKinematicsById.set(sample.id, sample.revealedKinematics);
      }
    }

    for (const child of this.renderingState.asteroidGroup.children) {
      if (!(child instanceof THREE.Mesh)) {
        continue;
      }

      const revealed = scannedKinematicsById.get(child.name);
      if (revealed) {
        const scale = ASTEROID_SPIN_FRAME_SECONDS * ASTEROID_REVEALED_SPIN_SCALE;
        child.rotation.x += revealed.angularVelocityRadPerSec.x * scale;
        child.rotation.y += revealed.angularVelocityRadPerSec.y * scale;
        child.rotation.z += revealed.angularVelocityRadPerSec.z * scale;
        continue;
      }

      const userData = child.userData as { spinProfile?: AsteroidSpinProfile };
      if (!userData.spinProfile) {
        userData.spinProfile = createAsteroidSpinProfile(child.name);
      }

      const [spinX, spinY, spinZ] = userData.spinProfile.spin;
      child.rotation.x += spinX * ASTEROID_SPIN_FRAME_SECONDS;
      child.rotation.y += spinY * ASTEROID_SPIN_FRAME_SECONDS;
      child.rotation.z += spinZ * ASTEROID_SPIN_FRAME_SECONDS;
    }

    this.counterRotateAsteroidOverlays();
  }

  /** Scan/target rings are mesh children, so undo the parent tumble to keep them world-aligned. */
  private counterRotateAsteroidOverlays(): void {
    if (!this.renderingState) {
      return;
    }

    const camera = this.renderingState.camera;
    const cameraWorldQuaternion = new THREE.Quaternion();
    const hasWorldCamera = camera instanceof THREE.Object3D;
    if (hasWorldCamera) {
      // getWorldQuaternion refreshes this object's ancestor matrices itself, so this reads
      // the camera's current-frame orientation even though the renderer has not traversed
      // the scene graph yet at this point in the frame.
      camera.getWorldQuaternion(cameraWorldQuaternion);
    }
    const meshWorldQuaternion = new THREE.Quaternion();

    for (const child of this.renderingState.asteroidGroup.children) {
      if (!(child instanceof THREE.Mesh)) {
        continue;
      }

      const overlays = child.userData as {
        hoverScanGroup?: THREE.Group;
        targetHoldGroup?: THREE.Group;
        targetedGroup?: THREE.Group;
      };
      if (!overlays.hoverScanGroup && !overlays.targetHoldGroup && !overlays.targetedGroup) {
        continue;
      }

      const inverse = child.quaternion.clone().invert();
      overlays.hoverScanGroup?.quaternion.copy(inverse);
      overlays.targetHoldGroup?.quaternion.copy(inverse);

      if (overlays.targetedGroup) {
        const targetedGroup = overlays.targetedGroup;
        let localQuaternion: THREE.Quaternion;
        if (hasWorldCamera) {
          // Resolve true world-space orientation for both the mesh and the camera
          // (the camera sits under the pilot look rig, so its local quaternion alone
          // is not the world-facing direction) so the bracket reliably faces the
          // camera instead of the pilot rig's local axes or the scene origin.
          child.getWorldQuaternion(meshWorldQuaternion);
          localQuaternion = meshWorldQuaternion.clone().invert().multiply(cameraWorldQuaternion);
        } else {
          localQuaternion = inverse;
        }

        // Undo only the mesh's fixed per-axis shape ratio (not its overall visual.scale
        // growth) so the bracket arms keep their true square shape while still tracking
        // legitimate size changes such as the targeted/hero-tier scale bump.
        //
        // This has to be composed as an explicit matrix rather than a plain child scale:
        // the parent's non-uniform scale is applied *outside* the child's rotation, and
        // scale and rotation do not commute, so a scale-only correction leaves the frame
        // visibly sheared and tilted off camera-facing. Building S(-1) * R by hand makes
        // the bracket's world transform exactly the camera rotation at uniform scale.
        const shapeScale = (child.userData as { geometryShapeScale?: [number, number, number] }).geometryShapeScale ?? [
          1, 1, 1,
        ];
        targetedGroup.matrixAutoUpdate = false;
        targetedGroup.matrix.makeRotationFromQuaternion(localQuaternion);
        targetedGroup.matrix.premultiply(
          new THREE.Matrix4().makeScale(
            shapeScale[0] !== 0 ? 1 / shapeScale[0] : 1,
            shapeScale[1] !== 0 ? 1 / shapeScale[1] : 1,
            shapeScale[2] !== 0 ? 1 / shapeScale[2] : 1,
          ),
        );
        targetedGroup.matrixWorldNeedsUpdate = true;
      }
    }
  }

  private createAsteroidMesh(visual: ShipExteriorAsteroidVisual): THREE.Mesh {
    const descriptor = resolveAsteroidGeometryDescriptor(visual.meshProfileKey, visual.isScanned, visual.detail);
    const geometry =
      descriptor.geometry === 'rock'
        ? buildDeterministicRockGeometry(visual.radius, descriptor.detail, visual.meshProfileKey ?? visual.id)
        : new THREE.IcosahedronGeometry(visual.radius, descriptor.detail);
    const material = new THREE.MeshStandardMaterial({
      color: visual.color,
      emissive: visual.emissive,
      emissiveIntensity: visual.emissiveIntensity,
      roughness: this.resolveAsteroidRoughness(visual),
      metalness: this.resolveAsteroidMetalness(visual),
      envMapIntensity: 0.6,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = visual.id;
    mesh.scale.set(descriptor.scale[0], descriptor.scale[1], descriptor.scale[2]);
    const spinProfile = createAsteroidSpinProfile(visual.id);
    (mesh.userData as { spinProfile?: AsteroidSpinProfile }).spinProfile = spinProfile;
    (mesh.userData as { orbitProfile?: AsteroidOrbitProfile }).orbitProfile = createAsteroidOrbitProfile(visual.id);
    mesh.rotation.set(spinProfile.orientation[0], spinProfile.orientation[1], spinProfile.orientation[2]);
    this.applyAsteroidVisualToMesh(mesh, visual);
    return mesh;
  }

  private applyAsteroidVisualToMesh(mesh: THREE.Mesh, visual: ShipExteriorAsteroidVisual): void {
    (mesh.userData as { orbitBasePosition?: [number, number, number] }).orbitBasePosition = [
      visual.position[0],
      visual.position[1],
      visual.position[2],
    ];
    mesh.position.set(visual.position[0], visual.position[1], visual.position[2]);
    const descriptor = resolveAsteroidGeometryDescriptor(visual.meshProfileKey, visual.isScanned, visual.detail);
    mesh.scale.set(
      descriptor.scale[0] * visual.scale,
      descriptor.scale[1] * visual.scale,
      descriptor.scale[2] * visual.scale,
    );
    // Track only the fixed per-axis shape ratio (not the overall visual.scale growth) so the
    // target bracket can cancel out non-uniform shearing without also freezing out legitimate
    // size changes (e.g. the targeted/hero-tier scale bump) that should still grow the bracket.
    (mesh.userData as { geometryShapeScale?: [number, number, number] }).geometryShapeScale = descriptor.scale;

    const material = mesh.material;
    if (!Array.isArray(material) && material instanceof THREE.MeshStandardMaterial) {
      material.color.setHex(visual.color);
      material.emissive.setHex(visual.emissive);
      material.emissiveIntensity = visual.emissiveIntensity;
      material.roughness = this.resolveAsteroidRoughness(visual);
      material.metalness = this.resolveAsteroidMetalness(visual);
    }

    this.syncAsteroidHoverScanShell(mesh, visual);
  }

  private resolveAsteroidRoughness(visual: ShipExteriorAsteroidVisual): number {
    if (visual.isTargeted) {
      return 0.38;
    }
    if (visual.isHovered) {
      return 0.52;
    }
    return visual.materialProfile?.roughness ?? (visual.isScanned ? 0.6 : 0.92);
  }

  private resolveAsteroidMetalness(visual: ShipExteriorAsteroidVisual): number {
    if (visual.isTargeted) {
      return 0.22;
    }
    if (visual.isHovered) {
      return 0.12;
    }
    return visual.materialProfile?.metalness ?? (visual.isScanned ? 0.25 : 0.03);
  }

  private syncAsteroidHoverScanShell(mesh: THREE.Mesh, visual: ShipExteriorAsteroidVisual): void {
    const userData = mesh.userData as {
      hoverScanGroup?: THREE.Group;
      targetHoldGroup?: THREE.Group;
    };
    const isScanned = this.state.asteroid?.samples.some((sample) => sample.id === visual.id && sample.scanned) ?? false;
    const shouldShowHoverRing = visual.isHovered && !isScanned;

    if (!shouldShowHoverRing) {
      if (userData.hoverScanGroup) {
        mesh.remove(userData.hoverScanGroup);
        disposeHoverScanGroup(userData.hoverScanGroup);
        delete userData.hoverScanGroup;
      }
    } else if (!userData.hoverScanGroup) {
      const group = new THREE.Group();
      group.name = `${mesh.name}-hover-scan-group`;

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(visual.radius * 1.42, 0.024, 10, 64),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color('#86e8ff'),
          transparent: true,
          opacity: 0.78,
          depthWrite: false,
        }),
      );
      ring.name = `${mesh.name}-hover-scan-ring`;
      ring.rotation.x = Math.PI / 2;
      group.add(ring);

      mesh.add(group);
      userData.hoverScanGroup = group;
    }

    if (userData.hoverScanGroup) {
      const group = userData.hoverScanGroup;
      const ring = group.children[0] as THREE.Mesh | undefined;
      if (ring) {
        ring.rotation.x = Math.PI / 2;
        ring.rotation.y = this.asteroidHoverScanPhase * 0.9;
        ring.scale.setScalar(1 + Math.sin(this.asteroidHoverScanPhase) * 0.06);
        const material = ring.material;
        if (!Array.isArray(material) && material instanceof THREE.MeshBasicMaterial) {
          material.opacity = 0.66 + Math.max(0, Math.sin(this.asteroidHoverScanPhase)) * 0.18;
        }
      }
    }

    this.syncAsteroidTargetHoldGroup(mesh, visual);
    this.syncAsteroidTargetedGroup(mesh, visual);
  }

  private syncAsteroidTargetHoldGroup(mesh: THREE.Mesh, visual: ShipExteriorAsteroidVisual): void {
    const asteroid = this.state.asteroid;
    const isHolding = asteroid?.targetHoldCandidateId === visual.id;
    const userData = mesh.userData as {
      targetHoldGroup?: THREE.Group;
    };

    if (!isHolding) {
      if (userData.targetHoldGroup) {
        mesh.remove(userData.targetHoldGroup);
        disposeHoverScanGroup(userData.targetHoldGroup);
        delete userData.targetHoldGroup;
      }
      return;
    }

    if (!userData.targetHoldGroup) {
      const group = new THREE.Group();
      group.name = `${mesh.name}-target-hold-group`;
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(visual.radius * 1.26, 0.026, 10, 64),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color('#ff4747'),
          transparent: true,
          opacity: 0.9,
          depthWrite: false,
        }),
      );
      ring.name = `${mesh.name}-target-hold-ring`;
      ring.rotation.x = Math.PI / 2;
      group.add(ring);
      mesh.add(group);
      userData.targetHoldGroup = group;
    }

    const group = userData.targetHoldGroup;
    const ring = group.children[0] as THREE.Mesh | undefined;
    if (ring) {
      const holdPhase = this.asteroidTargetHoldPhase;
      ring.rotation.x = Math.PI / 2;
      ring.rotation.y = holdPhase * 0.9;
      ring.scale.setScalar(1 + Math.sin(holdPhase) * 0.05);
      const material = ring.material;
      if (!Array.isArray(material) && material instanceof THREE.MeshBasicMaterial) {
        material.opacity = 0.8 + Math.max(0, Math.sin(holdPhase)) * 0.1;
      }
    }
  }

  /**
   * Confirmed-lock indicator for a targeted asteroid: a static, camera-facing
   * corner-bracket frame (HUD lock-on style) rather than a spinning ring, so it
   * stays visually distinct from the hero-tier scale/material treatment and
   * from the transient scan/target-hold rings.
   */
  private syncAsteroidTargetedGroup(mesh: THREE.Mesh, visual: ShipExteriorAsteroidVisual): void {
    const userData = mesh.userData as {
      targetedGroup?: THREE.Group;
    };

    if (!visual.isTargeted) {
      if (userData.targetedGroup) {
        mesh.remove(userData.targetedGroup);
        disposeHoverScanGroup(userData.targetedGroup);
        delete userData.targetedGroup;
      }
      return;
    }

    if (userData.targetedGroup) {
      return;
    }

    const group = new THREE.Group();
    group.name = `${mesh.name}-target-bracket-group`;

    buildAsteroidTargetBracketSegments(visual.radius).forEach((segment, index) => {
      const bracketArm = new THREE.Mesh(
        new THREE.BoxGeometry(segment.size[0], segment.size[1], segment.size[2]),
        new THREE.MeshBasicMaterial({
          color: new THREE.Color('#ff4d2e'),
          transparent: true,
          opacity: 0.92,
          depthWrite: false,
        }),
      );
      bracketArm.name = `${mesh.name}-target-bracket-${index}`;
      bracketArm.position.set(segment.position[0], segment.position[1], segment.position[2]);
      group.add(bracketArm);
    });

    mesh.add(group);
    userData.targetedGroup = group;
  }

  updateHoveredScanTargetFromPointer(clientX: number, clientY: number): ShipSceneHoverScanTarget | null {
    if (!this.renderingState) {
      return null;
    }

    const canvas = this.renderingState.canvas;
    const rect = canvas.getBoundingClientRect();
    if (
      rect.width <= 0 ||
      rect.height <= 0 ||
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      this.setHoveredAsteroidId(null);
      this.setHoveredScannableDebrisId(null);
      this.setHoveredScannableShipId(null);
      return null;
    }

    this.hoverPointer.set(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -(((clientY - rect.top) / rect.height) * 2 - 1),
    );
    this.hoverRaycaster.setFromCamera(this.hoverPointer, this.renderingState.camera);

    const asteroidIntersections = this.hoverRaycaster.intersectObjects(
      this.renderingState.asteroidGroup.children,
      false,
    );
    const hoveredAsteroidId = asteroidIntersections[0]?.object?.name ?? null;
    if (hoveredAsteroidId) {
      this.setHoveredAsteroidId(hoveredAsteroidId);
      this.setHoveredScannableDebrisId(null);
      this.setHoveredScannableShipId(null);
      return { kind: 'asteroid', id: hoveredAsteroidId };
    }

    const debrisIntersections = this.hoverRaycaster.intersectObjects(this.renderingState.debrisGroup.children, true);
    const hoveredDebrisId = this.resolveScannableDebrisIdFromIntersection(debrisIntersections[0]?.object ?? null);
    if (hoveredDebrisId) {
      this.setHoveredAsteroidId(null);
      this.setHoveredScannableDebrisId(hoveredDebrisId);
      this.setHoveredScannableShipId(null);
      return { kind: 'debris', id: hoveredDebrisId };
    }

    const shipIntersections = this.hoverRaycaster.intersectObjects(this.renderingState.shipGroup.children, true);
    const hoveredShipId = this.resolveScannableShipIdFromIntersection(shipIntersections[0]?.object ?? null);
    this.setHoveredAsteroidId(null);
    this.setHoveredScannableDebrisId(null);
    this.setHoveredScannableShipId(hoveredShipId);
    return hoveredShipId ? { kind: 'ship', id: hoveredShipId } : null;
  }

  updateHoveredAsteroidFromPointer(clientX: number, clientY: number): string | null {
    const hoveredTarget = this.updateHoveredScanTargetFromPointer(clientX, clientY);
    return hoveredTarget?.kind === 'asteroid' ? hoveredTarget.id : null;
  }

  private resolveScannableShipIdFromIntersection(object: THREE.Object3D | null): string | null {
    let cursor = object;
    while (cursor) {
      const cursorShipId = cursor.userData?.['scannableShipId'];
      const shipId = typeof cursorShipId === 'string' ? cursorShipId : null;
      if (shipId) {
        return shipId;
      }
      cursor = cursor.parent;
    }
    return null;
  }

  private resolveScannableDebrisIdFromIntersection(object: THREE.Object3D | null): string | null {
    let cursor = object;
    while (cursor) {
      const cursorDebrisId = cursor.userData?.['scannableDebrisId'];
      const debrisId = typeof cursorDebrisId === 'string' ? cursorDebrisId : null;
      if (debrisId) {
        return debrisId;
      }
      cursor = cursor.parent;
    }
    return null;
  }

  private ensureFlightController(): ShipExteriorFlightController | null {
    if (!this.renderingState) {
      return null;
    }

    if (this.flightController) {
      return this.flightController;
    }

    const controller = new ShipExteriorFlightController({
      config: FLIGHT_CONFIG,
      getCamera: () => this.renderingState?.camera ?? null,
      applyWorldRelativeTransform: ({ worldOffset, worldRotation }) => {
        const worldRelativeGroup = this.renderingState?.worldRelativeGroup;
        if (!worldRelativeGroup) {
          return;
        }
        worldRelativeGroup.position.set(...worldOffset);
        worldRelativeGroup.rotation.set(...worldRotation);
      },
      setActiveShipLocationKm: (location) => {
        this.updateFlightState({ currentLocationKm: location });
        this.setState({
          world: {
            shipPosition: { ...location },
          },
        });
      },
      commitTrackedLocation: (location) => {
        this.updateFlightState({ currentLocationKm: location });
        this.setState({
          world: {
            shipPosition: { ...location },
          },
        });
      },
    });

    this.flightController = controller;
    return controller;
  }

  private syncFlightControllerToState(): void {
    const controller = this.ensureFlightController();
    if (!controller) {
      return;
    }

    const flight = this.state.flight ?? DEFAULT_FLIGHT_STATE;
    controller.setFlightModeEnabled(true);
    controller.setFlightInvertY(flight.invertY);
    controller.setFlightMouseSensitivity(flight.mouseSensitivity);
    controller.initializeCurrentLocationFromReference(
      flight.currentLocationKm,
      this.state.world?.shipPosition ?? flight.currentLocationKm,
    );
    controller.restoreOrientation(flight.orientation);

    if (!this.paused) {
      controller.start();
      return;
    }

    controller.stop();
  }

  private syncFlightStateFromController(): void {
    const controller = this.flightController;
    if (!controller) {
      return;
    }

    const flight = this.state.flight ?? DEFAULT_FLIGHT_STATE;
    this.state = {
      ...this.state,
      flight: {
        ...flight,
        enabled: controller.flightModeEnabled(),
        invertY: controller.flightInvertY(),
        mouseSensitivity: controller.flightMouseSensitivity(),
        currentLocationKm: controller.getCurrentLocationKm(),
        orientation: controller.getPersistableViewOrientation(),
        worldOffset: Array.isArray(controller.flightWorldOffset())
          ? {
              x: controller.flightWorldOffset()[0],
              y: controller.flightWorldOffset()[1],
              z: controller.flightWorldOffset()[2],
            }
          : { ...flight.worldOffset },
        worldRotation: Array.isArray(controller.flightWorldRotation())
          ? {
              x: controller.flightWorldRotation()[0],
              y: controller.flightWorldRotation()[1],
              z: controller.flightWorldRotation()[2],
            }
          : { ...flight.worldRotation },
        speedKmPerSec: controller.flightSpeedKmPerSec(),
      },
    };
  }

  private updateFlightState(update: Partial<ShipSceneFlightState>): void {
    const flight = this.state.flight ?? DEFAULT_FLIGHT_STATE;
    this.state = {
      ...this.state,
      flight: {
        ...flight,
        ...update,
      },
    };
  }
}
