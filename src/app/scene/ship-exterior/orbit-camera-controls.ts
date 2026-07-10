import * as THREE from 'three';

export interface OrbitCameraControlsOptions {
  target?: THREE.Vector3;
  autoRotateSpeed?: number;
}

/**
 * Minimal orbit-like camera helper used by the bare scene until full controls are restored.
 */
export class OrbitCameraControls {
  private readonly target: THREE.Vector3;
  private readonly autoRotateSpeed: number;
  private enabled = true;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    private readonly domElement: HTMLCanvasElement,
    options: OrbitCameraControlsOptions = {},
  ) {
    this.target = options.target ? options.target.clone() : new THREE.Vector3(0, 0, 0);
    this.autoRotateSpeed = options.autoRotateSpeed ?? 0;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  setTarget(target: THREE.Vector3): void {
    this.target.copy(target);
  }

  update(): void {
    if (!this.enabled) {
      return;
    }

    if (this.autoRotateSpeed !== 0) {
      const current = this.camera.position.clone();
      const offset = current.sub(this.target);
      const radius = Math.max(offset.length(), 0.001);
      const angle = Math.atan2(offset.z, offset.x) + this.autoRotateSpeed;
      this.camera.position.set(
        this.target.x + Math.cos(angle) * radius,
        this.camera.position.y,
        this.target.z + Math.sin(angle) * radius,
      );
    }

    this.camera.lookAt(this.target);
  }

  dispose(): void {
    this.enabled = false;
    void this.domElement;
  }
}
