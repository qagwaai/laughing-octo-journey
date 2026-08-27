import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const DISABLED_TOUCH_ACTION = -1 as unknown as THREE.TOUCH;

export interface OrbitCameraControlsOptions {
  target?: THREE.Vector3;
  autoRotateSpeed?: number;
  enableRotate?: boolean;
  enableZoom?: boolean;
  enablePan?: boolean;
  minDistance?: number;
  maxDistance?: number;
}

/**
 * Wrapper around Three.js OrbitControls constrained for ship-exterior isolation slices.
 */
export class OrbitCameraControls {
  private readonly controls: OrbitControls;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly domElement: HTMLCanvasElement,
    options: OrbitCameraControlsOptions = {},
  ) {
    this.controls = new OrbitControls(this.camera, this.domElement);
    this.controls.target.copy(options.target ?? new THREE.Vector3(0, 0, 0));

    this.controls.enableRotate = options.enableRotate ?? true;
    this.controls.enableZoom = options.enableZoom ?? true;
    this.controls.enablePan = options.enablePan ?? false;
    this.controls.minDistance = options.minDistance ?? 1.8;
    this.controls.maxDistance = options.maxDistance ?? 24;

    // Desktop-only for Milestone-3B; use an unmapped touch action to ignore touch gestures.
    this.controls.touches.ONE = DISABLED_TOUCH_ACTION;
    this.controls.touches.TWO = DISABLED_TOUCH_ACTION;

    this.controls.autoRotate = Boolean(options.autoRotateSpeed && options.autoRotateSpeed !== 0);
    this.controls.autoRotateSpeed = options.autoRotateSpeed ?? 2;

    this.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    this.controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
    this.controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    if (!this.controls.enablePan) {
      this.controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    }

    this.controls.update();
  }

  setEnabled(enabled: boolean): void {
    this.controls.enabled = enabled;
  }

  setTarget(target: THREE.Vector3): void {
    this.controls.target.copy(target);
    this.controls.update();
  }

  update(): void {
    this.controls.update();
  }

  dispose(): void {
    this.controls.dispose();
    void this.camera;
    void this.domElement;
  }
}
