import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { beforeRender, injectStore } from 'angular-three';
import { Box3, Color, Group, PerspectiveCamera, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { SceneVisibilityService } from '../services/scene-visibility.service';
import { GasGiantSettings } from './gas-giant/gas-giant-settings';
import { createSplashGasGiant, replaceSplashGasGiant } from './gas-giant/splash-gas-giant';
import { createPlanetCloudStormMaterial } from './planet/planet-cloud-storms';
import { CLOUD_DRIFT_RADIANS_PER_SECOND, createPlanetCloudTexture, PlanetCloudSettings } from './planet/planet-clouds';
import { resolveSplashAppearance, type SplashPlanetEntry } from './planet/splash-planet-rotation';
import { createSplashBody, type SplashBody, type SplashBodySettings } from './splash-body';
import {
  createSplashBackdropAround,
  disposeSplashObject,
  placeSplashCelestialBody,
  SPLASH_CAMERA_DIRECTION,
  STATION_SPLASH_CAMERA_DIRECTION,
} from './splash-composition';
import { SplashState } from './splash-state';
import { createSplashStar, replaceSplashStar } from './star/splash-star';
import { resolveStarSpectralClassChoice, StarSettings } from './star/star-settings';

@Component({
  selector: 'app-splash-scene',
  template: '',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class SplashScene {
  private static readonly ORBIT_RESUME_DELAY_MS = 3000;
  private readonly store = injectStore({ optional: true });
  private readonly state = inject(SplashState);
  private readonly visibility = inject(SceneVisibilityService);
  private readonly cloudSettings = inject(PlanetCloudSettings);
  private readonly gasGiantSettings = inject(GasGiantSettings);
  private readonly starSettings = inject(StarSettings);

  constructor() {
    const store = this.store;
    if (!store) {
      // The unsupported-WebGL fallback route is deliberately outside the canvas.
      if (this.state.supported()) this.state.fail(new Error('Splash requires the shared canvas.'));
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
    let previousStationSplash: boolean | null = null;
    let orbitResumeTimer: ReturnType<typeof setTimeout> | null = null;
    /** Holds the splash placement; bodies sit at its origin so they can be swapped in place. */
    let bodySlot: Group | undefined;
    let body: SplashBody | undefined;
    let swapToken = 0;
    const sceneLoaded = signal(0);
    const cameraDirection = new Vector3();
    const referenceCameraPosition = new Vector3();
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
      }, SplashScene.ORBIT_RESUME_DELAY_MS);
    };
    const onOrbitChange = () => invalidate();
    controls.addEventListener('start', onOrbitStart);
    controls.addEventListener('end', onOrbitEnd);
    controls.addEventListener('change', onOrbitChange);
    effect(() => {
      const size = store.size();
      const stationSplash = this.state.stationSplash();
      cameraDirection.copy(stationSplash ? STATION_SPLASH_CAMERA_DIRECTION : SPLASH_CAMERA_DIRECTION);
      const aspect = Math.max(0.15, size.width / Math.max(1, size.height));
      const fov = camera instanceof PerspectiveCamera ? (camera.fov * Math.PI) / 180 : Math.PI / 4;
      framing = (1.35 / Math.tan(fov / 2) / Math.min(1, aspect)) * (stationSplash ? 1.25 : 1);
      controls.minDistance = framing * 0.65;
      controls.maxDistance = framing * 1.8;
      if (previousFraming === null || previousStationSplash !== stationSplash) {
        orbitCenter.copy(cameraDirection).multiplyScalar(framing);
        setCamera(0);
      } else if (framing !== previousFraming) {
        const ratio = framing / previousFraming;
        orbitCenter.multiplyScalar(ratio);
        camera.position.multiplyScalar(ratio);
      }
      previousFraming = framing;
      previousStationSplash = stationSplash;
      referenceCameraPosition.copy(cameraDirection).multiplyScalar(framing);
      if (bodySlot) placeSplashCelestialBody(bodySlot, referenceCameraPosition);
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
    effect(() => {
      const enabled = this.cloudSettings.enabled();
      const style = this.cloudSettings.style();
      const coverage = this.cloudSettings.coverage();
      const stormActivity = this.cloudSettings.stormActivity();
      if (body?.clouds && body.cloudMesh && body.cloudStyle !== style) {
        const previous = body.clouds;
        const previousMaterial = body.cloudStorm?.material;
        body.clouds = createPlanetCloudTexture(
          body.entry.id,
          previous.texture.image.width,
          previous.texture.image.height,
          style,
        );
        body.cloudStorm = createPlanetCloudStormMaterial(body.entry.id, style, body.clouds.texture);
        body.cloudMesh.material = body.cloudStorm.material;
        body.cloudStyle = style;
        previousMaterial?.dispose();
        previous.texture.dispose();
      }
      body?.clouds?.setCoverage(coverage);
      body?.cloudStorm?.setActivity(stormActivity);
      if (body?.cloudMesh) body.cloudMesh.visible = enabled;
      invalidate();
    });
    effect(() => {
      const palette = this.gasGiantSettings.palette();
      const rings = this.gasGiantSettings.rings();
      const stormActivity = this.cloudSettings.stormActivity();
      if (body?.giant && body.entry.id !== 'sol-saturn' && body.giantLook !== `${palette}|${rings}`) {
        const quality = untracked(() => this.state.quality());
        const archetype = resolveSplashAppearance(body.entry);
        const next = createSplashGasGiant({
          bodyId: body.entry.id,
          surfaceArchetype:
            archetype.valid && archetype.input.surfaceArchetype === 'ice-giant' ? 'ice-giant' : 'gas-giant',
          quality,
          palette,
          rings,
          stormActivity,
        });
        body.giant = replaceSplashGasGiant(body.giant, next);
        body.object = body.giant.group;
        body.giantLook = `${palette}|${rings}`;
      }
      body?.giant?.setStormActivity(stormActivity);
      invalidate();
    });
    effect(() => {
      const flareActivity = this.starSettings.flareActivity();
      const choice = this.starSettings.spectralClass();
      if (body?.star) {
        const spectralClass = resolveStarSpectralClassChoice(choice, body.entry.spectralClass ?? null);
        if (body.starClass !== spectralClass) {
          const quality = untracked(() => this.state.quality());
          const next = createSplashStar({ bodyId: body.entry.id, spectralClass, quality, flareActivity });
          body.star = replaceSplashStar(body.star, next);
          body.object = body.star.group;
          body.starClass = spectralClass;
        }
      }
      body?.star?.setFlareActivity(flareActivity);
      invalidate();
    });
    /** Current overlay settings; `seeded` drops per-body overrides so a newly picked body shows its own look. */
    const bodySettings = (entry: SplashPlanetEntry, seeded: boolean): SplashBodySettings =>
      untracked(() => ({
        cloudsEnabled: this.cloudSettings.enabled(),
        cloudStyle: this.cloudSettings.style(),
        cloudCoverage: this.cloudSettings.coverage(),
        stormActivity: this.cloudSettings.stormActivity(),
        giantPalette: seeded ? 'seeded' : this.gasGiantSettings.palette(),
        giantRings: seeded ? 'seeded' : this.gasGiantSettings.rings(),
        starClass: resolveStarSpectralClassChoice(
          seeded ? 'seeded' : this.starSettings.spectralClass(),
          entry.spectralClass ?? null,
        ),
        flareActivity: this.starSettings.flareActivity(),
      }));
    effect(() => {
      sceneLoaded();
      const entry = this.state.planet();
      untracked(() => {
        if (!bodySlot || !body) return;
        if (body.entry.id === entry.id) {
          // Re-selecting the shown body cancels any swap still loading.
          swapToken++;
          this.state.bodySwapping.set(false);
          return;
        }
        const slot = bodySlot;
        const displayed = body.entry;
        const token = ++swapToken;
        this.state.bodySwapping.set(true);
        createSplashBody(entry, {
          quality: this.state.quality(),
          renderer: gl,
          settings: bodySettings(entry, true),
        }).then(
          (next) => {
            if (token !== swapToken || slot !== bodySlot) {
              next.dispose();
              return;
            }
            body?.dispose();
            body = next;
            slot.add(next.object);
            // The new body was built seeded; aligning the controls keeps the effects from rebuilding it.
            this.starSettings.spectralClass.set('seeded');
            this.gasGiantSettings.palette.set('seeded');
            this.gasGiantSettings.rings.set('seeded');
            this.state.bodySwapping.set(false);
            invalidate();
          },
          (error: unknown) => {
            if (token !== swapToken) return;
            this.state.bodySwapping.set(false);
            this.state.rejectPlanet(displayed, entry, error);
          },
        );
      });
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
      let loadedBody: SplashBody | undefined;
      const quality = this.state.quality();
      const modelUrl = this.state.modelAsset().url;
      const entry = untracked(() => this.state.planet());
      void Promise.allSettled([
        loader.loadAsync(modelUrl),
        createSplashBody(entry, { quality, renderer: gl, settings: bodySettings(entry, false) }),
      ]).then(([rig, created]) => {
        if (cancelled || rig.status === 'rejected' || created.status === 'rejected') {
          if (rig.status === 'fulfilled') disposeSplashObject(rig.value.scene);
          if (created.status === 'fulfilled') created.value.dispose();
          if (cancelled) return;
          this.state.fail(rig.status === 'rejected' ? rig.reason : (created as PromiseRejectedResult).reason);
          return;
        }
        try {
          model = rig.value.scene;
          loadedBody = created.value;
          const slot = new Group();
          slot.add(loadedBody.object);
          backdrop = createSplashBackdropAround(quality, slot);
          placeSplashCelestialBody(slot, referenceCameraPosition);
          root.add(backdrop);
          const bounds = new Box3().setFromObject(model);
          const size = bounds.getSize(new Vector3());
          const center = bounds.getCenter(new Vector3());
          model.position.sub(center);
          const wrapper = new Group();
          wrapper.add(model);
          wrapper.scale.setScalar(1.9 / Math.max(size.x, size.y, size.z));
          root.add(wrapper);
          bodySlot = slot;
          body = loadedBody;
          pendingFrames = 2;
          sceneLoaded.update((value) => value + 1);
          invalidate();
        } catch (error: unknown) {
          release();
          this.state.fail(error);
        }
      });
      const release = () => {
        swapToken++;
        if (model) {
          model.parent?.removeFromParent();
          disposeSplashObject(model);
          model = undefined;
        }
        // The body owns its GPU resources (bakes, catalog textures, shaders); release it before the backdrop.
        (body ?? loadedBody)?.dispose();
        loadedBody = undefined;
        body = undefined;
        bodySlot = undefined;
        if (backdrop) {
          backdrop.removeFromParent();
          disposeSplashObject(backdrop);
          backdrop = undefined;
        }
        untracked(() => this.state.bodySwapping.set(false));
      };
      onCleanup(() => {
        cancelled = true;
        pendingFrames = 0;
        ktx.dispose();
        release();
      });
    });
    beforeRender(({ delta }) => {
      const cloudMesh = body?.cloudMesh;
      if (
        cloudMesh &&
        this.state.status() === 'ready' &&
        !this.state.reducedMotion() &&
        !this.state.documentHidden() &&
        this.cloudSettings.enabled()
      ) {
        cloudMesh.rotation.y += Math.min(delta, 0.05) * CLOUD_DRIFT_RADIANS_PER_SECOND;
        body?.cloudStorm?.advance(delta);
      }
      const giant = body?.giant;
      if (giant && this.state.status() === 'ready' && !this.state.reducedMotion() && !this.state.documentHidden()) {
        giant.advance(delta);
      }
      const star = body?.star;
      if (star && this.state.status() === 'ready' && !this.state.reducedMotion() && !this.state.documentHidden()) {
        star.advance(delta);
      }
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
