import * as THREE from 'three';
import { ShipExteriorFlightController } from './ship-exterior-flight-controller';
import { OrbitCameraControls } from './orbit-camera-controls';
import {
  ShipSceneContextState,
  ShipSceneFlightState,
  ShipSceneRenderingState,
  ShipSceneRuntimeSnapshot,
} from './ship-scene-types';

const STARFIELD_POINT_COUNT = 220;
const STARFIELD_INNER_RADIUS = 10;
const STARFIELD_RADIUS_SPREAD = 34;
const ZERO_VECTOR = { x: 0, y: 0, z: 0 };
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

export class ShipSceneContext {
  private state: ShipSceneContextState;
  private renderingState: ShipSceneRenderingState | null = null;
  private paused = true;
  private renderedFrameCount = 0;
  private flightController: ShipExteriorFlightController | null = null;
  private readonly starfieldSeed: number;
  private readonly starfieldSignature: string;

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
    this.state = {
      ...this.state,
      ...update,
      flight: flight ?? this.state.flight,
    };
  }

  getStarfieldSignature(): string {
    return this.starfieldSignature;
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

    scene.add(ambient);
    scene.add(directional);
    scene.add(starfieldPoints);
    scene.add(cube);

    const orbitControls = new OrbitCameraControls(camera, canvas, {
      target: cube.position.clone(),
      autoRotateSpeed: 0,
      enableRotate: true,
      enableZoom: true,
      enablePan: false,
      minDistance: 1.8,
      maxDistance: 24,
    });

    this.renderingState = {
      scene,
      camera,
      renderer,
      canvas,
      cube,
      starfieldPoints,
      starfieldSignatureLocal,
      orbitControls,
      isPausedLocal: true,
      cubeColorLocal: cubeColor,
      animationFrameId: null,
    };

    this.ensureFlightController();
    this.syncFlightControllerToState();

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
    this.renderingState.orbitControls.update();
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
