import * as THREE from 'three';
import { OrbitCameraControls } from './orbit-camera-controls';
import { ShipSceneContextState, ShipSceneRenderingState, ShipSceneRuntimeSnapshot } from './ship-scene-types';

const STARFIELD_POINT_COUNT = 220;
const STARFIELD_INNER_RADIUS = 10;
const STARFIELD_RADIUS_SPREAD = 34;

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
  private readonly starfieldSeed: number;
  private readonly starfieldSignature: string;

  constructor(
    readonly contextKey: string,
    initialState: ShipSceneContextState,
  ) {
    this.state = { ...initialState };
    this.starfieldSeed = hashStringToSeed(this.state.shipId);
    this.starfieldSignature = `${this.starfieldSeed.toString(16).padStart(8, '0')}:${STARFIELD_POINT_COUNT}:${this.starfieldSeed % 360}`;
  }

  getState(): ShipSceneContextState {
    return this.state;
  }

  setState(update: Partial<ShipSceneContextState>): void {
    this.state = {
      ...this.state,
      ...update,
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
    if (!this.renderingState) {
      return;
    }
    this.renderingState.isPausedLocal = true;
    this.renderingState.orbitControls.setEnabled(false);
  }

  resume(): void {
    this.paused = false;
    if (!this.renderingState) {
      return;
    }
    this.renderingState.isPausedLocal = false;
    this.renderingState.orbitControls.setEnabled(true);
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
    this.renderingState.orbitControls.update();
    this.renderingState.renderer.render(this.renderingState.scene, this.renderingState.camera);
    this.renderedFrameCount += 1;
  }

  snapshotRuntime(): ShipSceneRuntimeSnapshot | null {
    if (!this.renderingState) {
      return null;
    }

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
    };
  }

  disposeRendering(): void {
    if (!this.renderingState) {
      return;
    }

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
}
