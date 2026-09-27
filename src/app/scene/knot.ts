import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, untracked } from '@angular/core';
import { beforeRender, injectStore } from 'angular-three';
import { Box3, Color, Group, PerspectiveCamera, SRGBColorSpace, Texture, TextureLoader, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { EARTH_ALBEDO_URL } from '../component/earth-textures';
import { SceneVisibilityService } from '../services/scene-visibility.service';
import { createMiningBackdrop, disposeMiningObject } from './mining-splash-composition';
import { MiningSplashState } from './mining-splash-state';

@Component({
  selector: 'app-knot',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Knot {
  private static readonly ORBIT_RESUME_DELAY_MS = 3000;
  private readonly store = injectStore({ optional: true });
  private readonly state = inject(MiningSplashState);
  private readonly visibility = inject(SceneVisibilityService);

  constructor() {
    const store = this.store;
    if (!store) {
      // The unsupported-WebGL fallback route is deliberately outside the canvas.
      if (this.state.supported()) this.state.fail(new Error('Mining splash requires the shared canvas.'));
      return;
    }
    const { scene, camera, gl, invalidate } = store.snapshot;
    this.state.contextLost.set(false);
    const originalPosition = camera.position.clone();
    const originalQuaternion = camera.quaternion.clone();
    const originalBackground = scene.background;
    const root = new Group();
    scene.add(root);
    scene.background = new Color('#040914');
    let pendingFrames = 0;
    let loadStartedAt: number | null = null;
    let elapsed = 0;
    let framing = 1;
    let previousFraming: number | null = null;
    let orbitResumeTimer: ReturnType<typeof setTimeout> | null = null;
    const cameraDirection = new Vector3(2.7, 2, 3.8).normalize();
    const orbitCenter = cameraDirection.clone();
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enablePan = false;
    controls.minPolarAngle = 0.25;
    controls.maxPolarAngle = Math.PI - 0.25;
    controls.enableDamping = false;
    const originalTouchAction = gl.domElement.style.touchAction;
    gl.domElement.style.touchAction = 'none';
    const setCamera = (drift: number) => {
      camera.position.copy(orbitCenter);
      camera.position.x += Math.sin(drift * 0.12) * 0.07;
      camera.position.y += Math.sin(drift * 0.08) * 0.035;
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
    };
    const onOrbitStart = () => {
      if (orbitResumeTimer !== null) clearTimeout(orbitResumeTimer);
      orbitResumeTimer = null;
      this.state.orbitPaused.set(true);
    };
    const onOrbitEnd = () => {
      orbitCenter.copy(camera.position);
      elapsed = 0;
      orbitResumeTimer = setTimeout(() => {
        orbitResumeTimer = null;
        if (this.state.status() === 'ready') this.state.orbitPaused.set(false);
      }, Knot.ORBIT_RESUME_DELAY_MS);
    };
    const onOrbitChange = () => invalidate();
    controls.addEventListener('start', onOrbitStart);
    controls.addEventListener('end', onOrbitEnd);
    controls.addEventListener('change', onOrbitChange);
    effect(() => {
      const size = store.size();
      const aspect = Math.max(0.15, size.width / Math.max(1, size.height));
      const fov = camera instanceof PerspectiveCamera ? (camera.fov * Math.PI) / 180 : Math.PI / 4;
      framing = 1.35 / Math.tan(fov / 2) / Math.min(1, aspect);
      controls.minDistance = framing * 0.65;
      controls.maxDistance = framing * 1.8;
      if (previousFraming === null) {
        orbitCenter.copy(cameraDirection).multiplyScalar(framing);
        setCamera(0);
      } else if (framing !== previousFraming) {
        const ratio = framing / previousFraming;
        orbitCenter.multiplyScalar(ratio);
        camera.position.multiplyScalar(ratio);
      }
      previousFraming = framing;
      if (this.state.reducedMotion()) {
        orbitCenter.copy(camera.position);
        elapsed = 0;
      }
      controls.update();
      invalidate();
    });
    effect(() => {
      controls.enabled = this.state.status() === 'ready' && !this.visibility.isSceneHidden();
    });
    const isStatic = computed(() => this.state.status() === 'static');
    effect((onCleanup) => {
      this.state.attempt();
      const staticView = isStatic();
      if (staticView) return;
      untracked(() => this.state.status.set('loading'));
      this.state.loadDurationMs.set(null);
      loadStartedAt = performance.now();
      const ktx = new KTX2Loader().setTranscoderPath('decoders/basis/').detectSupport(gl);
      const loader = new GLTFLoader().setKTX2Loader(ktx).setMeshoptDecoder(MeshoptDecoder);
      let cancelled = false;
      let model: Group | undefined;
      let backdrop: Group | undefined;
      let earthMap: Texture | undefined;
      const quality = this.state.quality();
      const version = quality === 'standard' ? 'b4eaa6b9' : '9b277b11';
      void Promise.allSettled([
        loader.loadAsync(`models/asteroid-mining-rig.${quality}.glb?v=${version}`),
        new TextureLoader().loadAsync(EARTH_ALBEDO_URL),
      ])
        .then(([modelResult, textureResult]) => {
          if (modelResult.status === 'fulfilled') model = modelResult.value.scene;
          if (textureResult.status === 'fulfilled') earthMap = textureResult.value;
          if (cancelled || modelResult.status === 'rejected' || textureResult.status === 'rejected') {
            if (model) disposeMiningObject(model);
            earthMap?.dispose();
            model = undefined;
            earthMap = undefined;
            if (!cancelled) {
              this.state.fail(
                modelResult.status === 'rejected'
                  ? modelResult.reason
                  : textureResult.status === 'rejected'
                    ? textureResult.reason
                    : new Error('Mining splash resources unavailable.'),
              );
            }
            return;
          }
          if (!model || !earthMap) {
            throw new Error('Mining splash assets were not available after loading.');
          }
          const image: unknown = earthMap.image;
          if (!(image instanceof HTMLImageElement)) {
            throw new Error('The Earth texture did not load as an image.');
          }
          const maxWidth = quality === 'standard' ? 2048 : 1024;
          if (image.width > maxWidth) {
            const canvas = document.createElement('canvas');
            canvas.width = maxWidth;
            canvas.height = Math.round((image.height / image.width) * maxWidth);
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Could not prepare the Earth texture for the mining splash.');
            context.drawImage(image, 0, 0, canvas.width, canvas.height);
            earthMap.image = canvas;
            earthMap.needsUpdate = true;
          }
          earthMap.colorSpace = SRGBColorSpace;
          backdrop = createMiningBackdrop(quality, earthMap);
          root.add(backdrop);
          const bounds = new Box3().setFromObject(model);
          const size = bounds.getSize(new Vector3());
          const center = bounds.getCenter(new Vector3());
          model.position.sub(center);
          const wrapper = new Group();
          wrapper.add(model);
          wrapper.scale.setScalar(1.9 / Math.max(size.x, size.y, size.z));
          root.add(wrapper);
          pendingFrames = 2;
          invalidate();
        })
        .catch((error: unknown) => {
          if (model) {
            model.parent?.removeFromParent();
            disposeMiningObject(model);
            model = undefined;
          }
          if (backdrop) {
            backdrop.removeFromParent();
            disposeMiningObject(backdrop);
            backdrop = undefined;
          } else {
            earthMap?.dispose();
          }
          earthMap = undefined;
          if (!cancelled) this.state.fail(error);
        });
      onCleanup(() => {
        cancelled = true;
        pendingFrames = 0;
        ktx.dispose();
        if (model) {
          model.parent?.removeFromParent();
          disposeMiningObject(model);
        }
        backdrop?.removeFromParent();
        if (backdrop) disposeMiningObject(backdrop);
      });
    });
    beforeRender(({ delta }) => {
      if (pendingFrames > 0) {
        pendingFrames--;
        if (pendingFrames === 0) {
          if (loadStartedAt !== null) this.state.loadDurationMs.set(performance.now() - loadStartedAt);
          this.state.status.set('ready');
        } else invalidate();
      }
      if (this.state.moving() && !this.visibility.isSceneHidden()) {
        elapsed += Math.min(delta, 0.05);
        setCamera(elapsed);
        controls.update();
      }
    });
    const lost = (event: Event) => {
      event.preventDefault();
      this.state.contextLost.set(true);
      this.state.fail(new Error('WebGL context lost.'));
    };
    const restored = () => {
      this.state.contextLost.set(false);
      this.state.retry();
    };
    gl.domElement.addEventListener('webglcontextlost', lost);
    gl.domElement.addEventListener('webglcontextrestored', restored);
    inject(DestroyRef).onDestroy(() => {
      if (orbitResumeTimer !== null) clearTimeout(orbitResumeTimer);
      controls.removeEventListener('start', onOrbitStart);
      controls.removeEventListener('end', onOrbitEnd);
      controls.removeEventListener('change', onOrbitChange);
      controls.dispose();
      gl.domElement.style.touchAction = originalTouchAction;
      this.state.orbitPaused.set(false);
      gl.domElement.removeEventListener('webglcontextlost', lost);
      gl.domElement.removeEventListener('webglcontextrestored', restored);
      root.removeFromParent();
      camera.position.copy(originalPosition);
      camera.quaternion.copy(originalQuaternion);
      camera.updateMatrixWorld();
      scene.background = originalBackground;
      if (this.state.status() !== 'static') this.state.status.set('loading');
      invalidate();
    });
  }
}
