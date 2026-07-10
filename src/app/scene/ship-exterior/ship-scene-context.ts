import * as THREE from 'three';
import { OrbitCameraControls } from './orbit-camera-controls';
import { ShipSceneContextState, ShipSceneRenderingState, ShipSceneRuntimeSnapshot } from './ship-scene-types';

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

  constructor(
    readonly contextKey: string,
    initialState: ShipSceneContextState,
  ) {
    this.state = { ...initialState };
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
    scene.background = new THREE.Color('#06121c');

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

    const worldPosition = this.state.world?.shipPosition;
    cube.position.set(worldPosition?.x ?? 0, worldPosition?.y ?? 0, worldPosition?.z ?? 0);

    const ambient = new THREE.AmbientLight('#cfe3ff', 0.65);
    const directional = new THREE.DirectionalLight('#ffffff', 0.85);
    directional.position.set(3, 5, 4);

    scene.add(ambient);
    scene.add(directional);
    scene.add(cube);

    const orbitControls = new OrbitCameraControls(camera, canvas, {
      target: cube.position.clone(),
      autoRotateSpeed: 0,
    });

    this.renderingState = {
      scene,
      camera,
      renderer,
      canvas,
      cube,
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
      isPaused: this.isPaused(),
    };
  }

  disposeRendering(): void {
    if (!this.renderingState) {
      return;
    }

    this.renderingState.orbitControls.dispose();
    disposeMesh(this.renderingState.cube);
    this.renderingState.renderer.dispose();
    this.renderingState.canvas.remove();
    this.renderingState = null;
    this.paused = true;
  }
}
