import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { FloatingDebrisItem } from '../../model/floating-debris-item';
import { ShipExteriorFlightController } from './ship-exterior-flight-controller';
import type { ShipExteriorRouteFeeds } from './ship-exterior-route-feed-adapter';
import { summarizeShipExteriorRouteFeeds, type ShipExteriorRouteFeedCounts } from './ship-exterior-route-feed-summary';
import { resolveDescriptorRenderProfile } from '../viewer/viewer-descriptor-selectors';
import { OrbitCameraControls } from './orbit-camera-controls';
import type { ShipExteriorAsteroidVisual } from './ship-exterior-asteroid-visuals';
import { buildAsteroidLayoutSignature, deriveAsteroidVisuals } from './ship-exterior-asteroid-visuals';
import type { ShipExteriorMissionGateState } from '../../mission/ship-exterior-mission';
import {
  ShipSceneAsteroidSample,
  ShipSceneAsteroidState,
  ShipSceneContextState,
  ShipSceneFlightState,
  ShipSceneRenderingState,
  ShipSceneRuntimeSnapshot,
} from './ship-scene-types';

const STARFIELD_POINT_COUNT = 220;
const STARFIELD_INNER_RADIUS = 10;
const STARFIELD_RADIUS_SPREAD = 34;
const ZERO_VECTOR = { x: 0, y: 0, z: 0 };
const JAXS_SHIP_ASSET_PATH = 'models/Jaxs_Ship_texture.glb';
const JAXS_SHIP_POSITION: [number, number, number] = [-9, 1.4, 5.5];
const JAXS_SHIP_ROTATION: [number, number, number] = [0, -0.55, 0];
const JAXS_SHIP_SCALE = 0.18;
const DEBRIS_KM_TO_SCENE_UNITS = 0.4;
const ROUTE_FEED_KM_TO_SCENE_UNITS = 0.32;
const DEFAULT_FLIGHT_STATE: ShipSceneFlightState = {
  enabled: false,
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
const SCAN_RING_PHASE_WRAP_PERIOD = Math.PI * 20;

function cloneAsteroidSample(sample: ShipSceneAsteroidSample): ShipSceneAsteroidSample {
  return {
    ...sample,
    serverCelestialBodyId: sample.serverCelestialBodyId ?? null,
    revealedMaterial: sample.revealedMaterial ? { ...sample.revealedMaterial } : null,
    revealedKinematics: sample.revealedKinematics
      ? { ...sample.revealedKinematics, velocityKmPerSec: { ...sample.revealedKinematics.velocityKmPerSec }, angularVelocityRadPerSec: { ...sample.revealedKinematics.angularVelocityRadPerSec } }
      : null,
    solarSystemLocation: sample.solarSystemLocation
      ? { positionKm: { ...sample.solarSystemLocation.positionKm } }
      : null,
    clusterCenterKm: sample.clusterCenterKm ? { ...sample.clusterCenterKm } : null,
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
    externalObjectDescriptor: item.externalObjectDescriptor ? { ...item.externalObjectDescriptor } : item.externalObjectDescriptor,
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

function normalizeDebrisItems(items?: readonly FloatingDebrisItem[]): FloatingDebrisItem[] {
  return (items ?? []).map((item) => cloneDebrisItem(item));
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

function hashShipIdToColor(shipId: string): number {
  let hash = 0;
  for (let i = 0; i < shipId.length; i += 1) {
    hash = (hash << 5) - hash + shipId.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return new THREE.Color(`hsl(${hue}, 72%, 54%)`).getHex();
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
  private debrisPulsePhase = 0;
  private stationPulsePhase = 0;
  private gatePulsePhase = 0;
  private shipLoadGeneration = 0;

  constructor(
    readonly contextKey: string,
    initialState: ShipSceneContextState,
  ) {
    this.state = {
      ...initialState,
      flight: {
        ...DEFAULT_FLIGHT_STATE,
        ...initialState.flight,
        currentLocationKm: {
          ...DEFAULT_FLIGHT_STATE.currentLocationKm,
          ...(initialState.flight?.currentLocationKm ?? initialState.world?.shipPosition ?? ZERO_VECTOR),
        },
      },
      asteroid: normalizeAsteroidState(initialState.asteroid),
      mission: initialState.mission ? cloneMissionGateState(initialState.mission) : undefined,
      debris: normalizeDebrisItems(initialState.debris),
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
    const mission = update.mission ? cloneMissionGateState(update.mission) : this.state.mission;
    const debris = update.debris ? normalizeDebrisItems(update.debris) : this.state.debris;
    this.state = {
      ...this.state,
      ...update,
      flight: flight ?? this.state.flight,
      asteroid,
      mission,
      debris,
    };
  }

  getDebrisItems(): readonly FloatingDebrisItem[] {
    return normalizeDebrisItems(this.state.debris);
  }

  setDebrisItems(items: readonly FloatingDebrisItem[]): void {
    this.state = {
      ...this.state,
      debris: normalizeDebrisItems(items),
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

  setTargetedAsteroidId(sampleId: string | null): void {
    const asteroid = this.state.asteroid ?? normalizeAsteroidState();
    const targetStillExists = sampleId ? asteroid.samples.some((sample) => sample.id === sampleId) : false;
    this.state = {
      ...this.state,
      asteroid: {
        ...asteroid,
        targetedAsteroidId: targetStillExists ? sampleId : null,
        targetHoldCandidateId: targetStillExists && asteroid.targetHoldCandidateId === sampleId ? null : asteroid.targetHoldCandidateId,
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
    const initialCamera = this.state.camera?.position;
    camera.position.set(initialCamera?.x ?? 2.5, initialCamera?.y ?? 1.8, initialCamera?.z ?? 4.2);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    const pixelRatio = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pixelRatio);

    const cubeColor = hashShipIdToColor(this.state.shipId);
    const cube = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: cubeColor, metalness: 0.25, roughness: 0.5 }),
    );

    // Render in a local anchor frame for this slice. World position stays in context state
    // for future hydration/transforms, while visuals remain centered and numerically stable.
    cube.position.set(0, 0, 0);

    const ambient = new THREE.AmbientLight('#cfe3ff', 0.65);
    const directional = new THREE.DirectionalLight('#ffffff', 0.85);
    directional.position.set(3, 5, 4);

    const { points: starfieldPoints, signature: starfieldSignatureLocal } = createStarfieldPoints(this.starfieldSeed);
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

    scene.add(ambient);
    scene.add(directional);
    scene.add(starfieldPoints);
    scene.add(cube);
    scene.add(shipGroup);
    scene.add(stationGroup);
    scene.add(gateGroup);
    scene.add(debrisGroup);
    scene.add(asteroidGroup);

    const orbitControls = new OrbitCameraControls(camera, canvas, {
      target: cube.position.clone(),
      autoRotateSpeed: 0,
      enableRotate: true,
      enableZoom: true,
      enablePan: true,
      minDistance: 1.8,
      maxDistance: 24,
    });

    this.renderingState = {
      scene,
      camera,
      renderer,
      canvas,
      cube,
      shipGroup,
      stationGroup,
      gateGroup,
      debrisGroup,
      asteroidGroup,
      starfieldPoints,
      starfieldSignatureLocal,
      asteroidLayoutSignatureLocal: this.getAsteroidLayoutSignature(),
      orbitControls,
      isPausedLocal: true,
      cubeColorLocal: cubeColor,
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
    this.paused = true;
    this.syncFlightStateFromController();
    this.flightController?.stop();
    if (!this.renderingState) {
      return;
    }
    this.renderingState.isPausedLocal = true;
    this.renderingState.orbitControls.setEnabled(false);
  }

  resume(): void {
    if (!this.paused && this.renderingState?.isPausedLocal === false) {
      return;
    }

    this.paused = false;
    if (!this.renderingState) {
      return;
    }
    this.renderingState.isPausedLocal = false;
    this.renderingState.orbitControls.setEnabled(true);
    this.syncFlightControllerToState();
  }

  isPaused(): boolean {
    return this.renderingState?.isPausedLocal ?? this.paused;
  }

  renderFrame(): void {
    if (!this.renderingState || this.isPaused()) {
      return;
    }

    this.renderingState.cube.rotation.x += 0.0035;
    this.renderingState.cube.rotation.y += 0.006;
    const flight = this.state.flight;
    if (flight?.enabled && this.flightController) {
      const [offsetX, offsetY, offsetZ] = this.flightController.flightWorldOffset();
      this.renderingState.cube.position.set(offsetX, offsetY, offsetZ);
      this.renderingState.orbitControls.setTarget(this.renderingState.cube.position);
    }
    if (this.state.asteroid?.hoveredAsteroidId) {
      this.asteroidHoverScanPhase = (this.asteroidHoverScanPhase + 0.12) % SCAN_RING_PHASE_WRAP_PERIOD;
    }
    if (this.state.asteroid?.targetHoldCandidateId) {
      this.asteroidTargetHoldPhase = (this.asteroidTargetHoldPhase + 0.16) % SCAN_RING_PHASE_WRAP_PERIOD;
    }
    if ((this.state.debris?.length ?? 0) > 0) {
      this.debrisPulsePhase = (this.debrisPulsePhase + 0.1) % (Math.PI * 2);
    }
    if ((this.routeFeeds?.stations.length ?? 0) > 0) {
      this.stationPulsePhase = (this.stationPulsePhase + 0.08) % (Math.PI * 2);
    }
    if ((this.routeFeeds?.gates.length ?? 0) > 0) {
      this.gatePulsePhase = (this.gatePulsePhase + 0.06) % (Math.PI * 2);
    }
    this.renderingState.orbitControls.update();
    this.syncDebrisVisuals();
    this.syncRouteFeedVisuals();
    this.syncAsteroidVisuals();
    this.renderingState.renderer.render(this.renderingState.scene, this.renderingState.camera);
    this.renderedFrameCount += 1;
  }

  toggleFlightMode(): void {
    const nextEnabled = !this.flightModeEnabled();
    this.updateFlightState({ enabled: nextEnabled });
    const controller = this.ensureFlightController();
    if (!controller) {
      return;
    }

    controller.setFlightModeEnabled(nextEnabled);
    if (nextEnabled) {
      controller.start();
      return;
    }

    controller.stop();
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
    return Boolean(this.renderingState?.canvas && typeof document !== 'undefined' && document.pointerLockElement === this.renderingState.canvas);
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
      cubeRotation: {
        x: this.renderingState.cube.rotation.x,
        y: this.renderingState.cube.rotation.y,
        z: this.renderingState.cube.rotation.z,
      },
      starfieldSignature: this.renderingState.starfieldSignatureLocal,
      isPaused: this.isPaused(),
      renderedFrameCount: this.renderedFrameCount,
      flightModeEnabled: flight.enabled,
      flightCurrentLocationKm: { ...flight.currentLocationKm },
      flightWorldOffset: { ...flight.worldOffset },
      flightWorldRotation: { ...flight.worldRotation },
      flightSpeedKmPerSec: flight.speedKmPerSec,
    };
  }

  disposeRendering(): void {
    if (!this.renderingState) {
      return;
    }

    this.syncFlightStateFromController();
    this.flightController?.stop();
    this.renderingState.orbitControls.dispose();
    disposeShipGroup(this.renderingState.shipGroup);
    disposeStationGroup(this.renderingState.stationGroup);
    disposeGateGroup(this.renderingState.gateGroup);
    disposeDebrisGroup(this.renderingState.debrisGroup);
    disposeAsteroidGroup(this.renderingState.asteroidGroup);
    if (this.renderingState.starfieldPoints.geometry) {
      this.renderingState.starfieldPoints.geometry.dispose();
    }
    if (Array.isArray(this.renderingState.starfieldPoints.material)) {
      this.renderingState.starfieldPoints.material.forEach((material) => material.dispose());
    } else {
      this.renderingState.starfieldPoints.material.dispose();
    }
    disposeMesh(this.renderingState.cube);
    this.renderingState.renderer.dispose();
    this.renderingState.canvas.remove();
    this.renderingState = null;
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
    shipGroup.add(shipScene);
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

    debris.forEach((item, index) => {
      const existing = existingById.get(item.id);
      if (existing) {
        this.applyDebrisVisual(existing, item, index);
        return;
      }

      renderingState.debrisGroup.add(this.createDebrisVisual(item, index));
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

  private createStationVisual(station: NonNullable<ShipExteriorRouteFeeds['stations']>[number], index: number): THREE.Group {
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

  private createDebrisVisual(item: FloatingDebrisItem, index: number): THREE.Group {
    const group = new THREE.Group();
    group.name = item.id;
    this.applyDebrisVisual(group, item, index);
    return group;
  }

  private applyDebrisVisual(group: THREE.Group, item: FloatingDebrisItem, index: number): void {
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
    const pulse = this.debrisPulsePhase + index * 0.65;
    group.rotation.x = Math.sin(pulse) * 0.25;
    group.rotation.y = pulse * 0.45;
    group.rotation.z = Math.cos(pulse) * 0.12;
    group.scale.setScalar(1 + Math.max(0, Math.sin(pulse * 1.2)) * 0.06);
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

    if (this.asteroidLayoutSignature !== nextSignature || this.renderingState.asteroidGroup.children.length !== visuals.length) {
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

  private createAsteroidMesh(visual: ShipExteriorAsteroidVisual): THREE.Mesh {
    const geometry = new THREE.IcosahedronGeometry(visual.radius, visual.detail);
    const material = new THREE.MeshStandardMaterial({
      color: visual.color,
      emissive: visual.emissive,
      emissiveIntensity: visual.emissiveIntensity,
      roughness: visual.isTargeted ? 0.38 : visual.isHovered ? 0.52 : 0.72,
      metalness: visual.isTargeted ? 0.22 : visual.isHovered ? 0.12 : 0.08,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = visual.id;
    this.applyAsteroidVisualToMesh(mesh, visual);
    return mesh;
  }

  private applyAsteroidVisualToMesh(mesh: THREE.Mesh, visual: ShipExteriorAsteroidVisual): void {
    mesh.position.set(visual.position[0], visual.position[1], visual.position[2]);
    mesh.scale.setScalar(visual.scale);

    const material = mesh.material;
    if (!Array.isArray(material) && material instanceof THREE.MeshStandardMaterial) {
      material.color.setHex(visual.color);
      material.emissive.setHex(visual.emissive);
      material.emissiveIntensity = visual.emissiveIntensity;
      material.roughness = visual.isTargeted ? 0.38 : visual.isHovered ? 0.52 : 0.72;
      material.metalness = visual.isTargeted ? 0.22 : visual.isHovered ? 0.12 : 0.08;
    }

    this.syncAsteroidHoverScanShell(mesh, visual);
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

  updateHoveredAsteroidFromPointer(clientX: number, clientY: number): string | null {
    if (!this.renderingState) {
      return null;
    }

    const canvas = this.renderingState.canvas;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0 || clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      this.setHoveredAsteroidId(null);
      return null;
    }

    this.hoverPointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1));
    this.hoverRaycaster.setFromCamera(this.hoverPointer, this.renderingState.camera);

    const intersections = this.hoverRaycaster.intersectObjects(this.renderingState.asteroidGroup.children, false);
    const hoveredId = intersections[0]?.object?.name ?? null;
    this.setHoveredAsteroidId(hoveredId);
    return hoveredId;
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
    controller.setFlightModeEnabled(flight.enabled);
    controller.setFlightInvertY(flight.invertY);
    controller.setFlightMouseSensitivity(flight.mouseSensitivity);
    controller.initializeCurrentLocationFromReference(
      flight.currentLocationKm,
      this.state.world?.shipPosition ?? flight.currentLocationKm,
    );
    controller.restoreOrientation(flight.orientation);

    if (flight.enabled && !this.paused) {
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
