import {
  Camera,
  Group,
  HalfFloatType,
  LinearFilter,
  Mesh,
  MeshBasicMaterial,
  NoBlending,
  NormalBlending,
  OrthographicCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
  WebGLRenderTarget,
} from 'three';
import { CYGNUS_X1, CYGNUS_X1_SPLASH_PRESENTATION } from '../../model/black-hole/cygnus-x1';
import { BLACK_HOLE_FRAGMENT_SHADER, BLACK_HOLE_VERTEX_SHADER } from './black-hole-shader';

export interface BlackHoleOptions {
  resolution: number;
  traceSteps: number;
  /** Maps the host scene's coordinate frame into the disk frame; not an astronomical orientation. */
  viewRotation: Quaternion;
  /** Splash owns its sky; viewer composites only disk emission and the opaque shadow. */
  background?: 'procedural-sky' | 'transparent';
}

export interface BlackHoleHandle {
  readonly group: Group;
  readonly target: WebGLRenderTarget;
  advance(delta: number): void;
  render(renderer: WebGLRenderer, camera: Camera): void;
  dispose(): void;
}

/** A bounded-resolution geodesic pass, reusable independently of Angular and splash state. */
export function createBlackHole(options: BlackHoleOptions): BlackHoleHandle {
  if (
    !Number.isInteger(options.resolution) ||
    options.resolution < 32 ||
    !Number.isInteger(options.traceSteps) ||
    options.traceSteps < 128
  ) {
    throw new Error('Black-hole rendering requires resolution >= 32 and traceSteps >= 128.');
  }
  const group = new Group();
  group.name = 'cygnus-x1-prototype';
  group.userData['blackHole'] = { id: CYGNUS_X1.id, mode: 'cinematic', metric: 'Schwarzschild' };
  const target = new WebGLRenderTarget(options.resolution, Math.round((options.resolution * 5) / 6), {
    type: HalfFloatType,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
    depthBuffer: false,
    stencilBuffer: false,
  });
  const uniforms = {
    uTime: { value: 0 },
    uOrigin: { value: new Vector3() },
    uRight: { value: new Vector3() },
    uUp: { value: new Vector3() },
  };
  const traceMaterial = new ShaderMaterial({
    vertexShader: BLACK_HOLE_VERTEX_SHADER,
    fragmentShader: BLACK_HOLE_FRAGMENT_SHADER,
    defines: {
      TRACE_STEPS: options.traceSteps,
      PROCEDURAL_SKY: options.background === 'transparent' ? 0 : 1,
    },
    blending: options.background === 'transparent' ? NoBlending : NormalBlending,
    uniforms,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const traceGeometry = new PlaneGeometry(2, 2);
  const traceScene = new Scene();
  traceScene.add(new Mesh(traceGeometry, traceMaterial));
  const traceCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const displayGeometry = new PlaneGeometry(12, 10);
  const displayMaterial = new MeshBasicMaterial({
    map: target.texture,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const display = new Mesh(displayGeometry, displayMaterial);
  display.name = 'black-hole-image';
  display.raycast = () => undefined;
  group.add(display);
  const cameraPosition = new Vector3();
  const cameraRotation = new Quaternion();
  const inverseRotation = new Quaternion();
  const localCameraRotation = new Quaternion();
  let disposed = false;
  let previousView = '';

  return {
    group,
    target,
    advance(delta) {
      if (!Number.isFinite(delta) || delta < 0)
        throw new Error('Black-hole animation delta must be finite and non-negative.');
      uniforms.uTime.value = (uniforms.uTime.value + Math.min(delta, 0.05)) % 600;
    },
    render(renderer, camera) {
      if (disposed) throw new Error('Cannot render a disposed black hole.');
      if (!renderer.extensions.has('EXT_color_buffer_float')) {
        throw new Error('Black-hole HDR rendering requires EXT_color_buffer_float.');
      }
      group.updateWorldMatrix(true, false);
      camera.getWorldPosition(cameraPosition);
      group.worldToLocal(cameraPosition);
      group.getWorldQuaternion(inverseRotation).invert();
      camera.getWorldQuaternion(cameraRotation);
      localCameraRotation.copy(inverseRotation).multiply(cameraRotation);
      display.quaternion.copy(localCameraRotation);
      uniforms.uOrigin.value
        .copy(cameraPosition)
        .normalize()
        .applyQuaternion(options.viewRotation)
        .multiplyScalar(CYGNUS_X1_SPLASH_PRESENTATION.observerRadiusRs);
      uniforms.uRight.value.set(1, 0, 0).applyQuaternion(localCameraRotation).applyQuaternion(options.viewRotation);
      uniforms.uUp.value.set(0, 1, 0).applyQuaternion(localCameraRotation).applyQuaternion(options.viewRotation);
      const view = [
        ...uniforms.uOrigin.value.toArray(),
        ...uniforms.uRight.value.toArray(),
        ...uniforms.uUp.value.toArray(),
        uniforms.uTime.value,
      ].join(',');
      if (view === previousView) return;
      const previousTarget = renderer.getRenderTarget();
      const previousAutoClear = renderer.autoClear;
      const previousXr = renderer.xr.enabled;
      try {
        renderer.xr.enabled = false;
        renderer.autoClear = true;
        renderer.setRenderTarget(target);
        renderer.render(traceScene, traceCamera);
        previousView = view;
      } finally {
        renderer.setRenderTarget(previousTarget);
        renderer.autoClear = previousAutoClear;
        renderer.xr.enabled = previousXr;
      }
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      group.removeFromParent();
      target.dispose();
      traceGeometry.dispose();
      traceMaterial.dispose();
      displayGeometry.dispose();
      displayMaterial.dispose();
    },
  };
}
