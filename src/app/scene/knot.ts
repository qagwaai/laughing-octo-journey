import { ChangeDetectionStrategy, Component, computed, DestroyRef, effect, inject, untracked } from '@angular/core';
import { beforeRender, injectStore } from 'angular-three';
import {
  Box3,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  SphereGeometry,
  Vector3,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { SceneVisibilityService } from '../services/scene-visibility.service';
import type { GasGiantHandle } from './gas-giant/gas-giant';
import { GasGiantSettings } from './gas-giant/gas-giant-settings';
import { createSplashGasGiant, replaceSplashGasGiant } from './gas-giant/splash-gas-giant';
import {
  createMiningBackdrop,
  createMiningBackdropAround,
  disposeMiningObject,
  MINING_CAMERA_DIRECTION,
  placeMiningCelestialBody,
} from './mining-splash-composition';
import { MiningSplashState } from './mining-splash-state';
import type { PlanetBakeResult } from './planet/planet-bake';
import { createPlanetCloudStormMaterial, type PlanetCloudStormMaterial } from './planet/planet-cloud-storms';
import {
  CLOUD_DRIFT_RADIANS_PER_SECOND,
  createPlanetCloudTexture,
  PlanetCloudSettings,
  type PlanetCloudStyle,
  type PlanetCloudTexture,
} from './planet/planet-clouds';
import { bakeSplashPlanet } from './planet/splash-planet';
import { createSplashStar, replaceSplashStar } from './star/splash-star';
import type { StarHandle } from './star/star';
import { resolveStarSpectralClassChoice, StarSettings } from './star/star-settings';

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
  private readonly cloudSettings = inject(PlanetCloudSettings);
  private readonly gasGiantSettings = inject(GasGiantSettings);
  private readonly starSettings = inject(StarSettings);

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
    let clouds: PlanetCloudTexture | undefined;
    let cloudStormLayer: PlanetCloudStormMaterial | undefined;
    let cloudMesh: Mesh<SphereGeometry, MeshStandardMaterial> | undefined;
    let cloudStyle: PlanetCloudStyle | undefined;
    let giant: GasGiantHandle | undefined;
    let giantLook: string | undefined;
    let star: StarHandle | undefined;
    let starClass: string | null = null;
    let celestialBody: Object3D | undefined;
    const cameraDirection = MINING_CAMERA_DIRECTION.clone();
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
      referenceCameraPosition.copy(cameraDirection).multiplyScalar(framing);
      if (celestialBody) placeMiningCelestialBody(celestialBody, referenceCameraPosition);
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
      if (clouds && cloudMesh && cloudStyle !== style) {
        const previous = clouds;
        const previousMaterial = cloudStormLayer?.material;
        clouds = createPlanetCloudTexture(
          this.state.planetBodyId,
          previous.texture.image.width,
          previous.texture.image.height,
          style,
        );
        cloudStormLayer = createPlanetCloudStormMaterial(this.state.planetBodyId, style, clouds.texture);
        cloudMesh.material = cloudStormLayer.material;
        cloudStyle = style;
        previousMaterial?.dispose();
        previous.texture.dispose();
      }
      clouds?.setCoverage(coverage);
      cloudStormLayer?.setActivity(stormActivity);
      if (cloudMesh) cloudMesh.visible = enabled;
      invalidate();
    });
    effect(() => {
      const palette = this.gasGiantSettings.palette();
      const rings = this.gasGiantSettings.rings();
      const stormActivity = this.cloudSettings.stormActivity();
      if (giant && giantLook !== `${palette}|${rings}`) {
        const quality = untracked(() => this.state.quality());
        const next = createSplashGasGiant({
          bodyId: this.state.planetBodyId,
          surfaceArchetype: this.state.planetSurfaceArchetype === 'ice-giant' ? 'ice-giant' : 'gas-giant',
          quality,
          palette,
          rings,
          stormActivity,
        });
        giant = replaceSplashGasGiant(giant, next);
        celestialBody = giant.group;
        giantLook = `${palette}|${rings}`;
      }
      giant?.setStormActivity(stormActivity);
      invalidate();
    });
    effect(() => {
      const flareActivity = this.starSettings.flareActivity();
      const spectralClass = resolveStarSpectralClassChoice(
        this.starSettings.spectralClass(),
        this.state.planetSpectralClass,
      );
      if (star && starClass !== spectralClass) {
        const quality = untracked(() => this.state.quality());
        const next = createSplashStar({ bodyId: this.state.planetBodyId, spectralClass, quality, flareActivity });
        star = replaceSplashStar(star, next);
        celestialBody = star.group;
        starClass = spectralClass;
      }
      star?.setFlareActivity(flareActivity);
      invalidate();
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
      let planet: PlanetBakeResult | undefined;
      const quality = this.state.quality();
      const version = quality === 'standard' ? 'b4eaa6b9' : '9b277b11';
      void loader
        .loadAsync(`models/asteroid-mining-rig.${quality}.glb?v=${version}`)
        .then((gltf) => {
          if (cancelled) {
            disposeMiningObject(gltf.scene);
            return;
          }
          model = gltf.scene;
          if (this.state.planetKind === 'gas-giant') {
            const palette = this.gasGiantSettings.palette();
            const rings = this.gasGiantSettings.rings();
            giant = createSplashGasGiant({
              bodyId: this.state.planetBodyId,
              surfaceArchetype:
                this.state.planetSurfaceArchetype === 'ice-giant' ? 'ice-giant' : 'gas-giant',
              quality,
              palette,
              rings,
              stormActivity: this.cloudSettings.stormActivity(),
            });
            giantLook = `${palette}|${rings}`;
            backdrop = createMiningBackdropAround(quality, giant.group);
            celestialBody = giant.group;
          } else if (this.state.planetKind === 'star') {
            starClass = resolveStarSpectralClassChoice(
              this.starSettings.spectralClass(),
              this.state.planetSpectralClass,
            );
            star = createSplashStar({
              bodyId: this.state.planetBodyId,
              spectralClass: starClass,
              quality,
              flareActivity: this.starSettings.flareActivity(),
            });
            backdrop = createMiningBackdropAround(quality, star.group);
            celestialBody = star.group;
          } else {
            if (!this.state.planetSurfaceArchetype) {
              throw new Error('Splash demo has no valid surface archetype.');
            }
            planet = bakeSplashPlanet(quality, gl, this.state.planetBodyId, this.state.planetSurfaceArchetype);
            clouds = createPlanetCloudTexture(
              this.state.planetBodyId,
              quality === 'standard' ? 512 : 256,
              quality === 'standard' ? 256 : 128,
              this.cloudSettings.style(),
            );
            cloudStyle = this.cloudSettings.style();
            clouds.setCoverage(this.cloudSettings.coverage());
            cloudStormLayer = createPlanetCloudStormMaterial(this.state.planetBodyId, cloudStyle, clouds.texture);
            cloudStormLayer.setActivity(this.cloudSettings.stormActivity());
            cloudMesh = new Mesh(new SphereGeometry(4 * 1.012, 64, 48), cloudStormLayer.material);
            cloudMesh.visible = this.cloudSettings.enabled();
            backdrop = createMiningBackdrop(quality, planet.albedo, planet.normal, planet.material, cloudMesh);
            celestialBody = cloudMesh.parent!;
          }
          placeMiningCelestialBody(celestialBody, referenceCameraPosition);
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
            cloudMesh?.geometry.dispose();
            cloudMesh?.material.dispose();
            clouds?.texture.dispose();
          }
          clouds = undefined;
          celestialBody = undefined;
          cloudMesh = undefined;
          cloudStormLayer = undefined;
          cloudStyle = undefined;
          giant?.dispose();
          giant = undefined;
          star?.dispose();
          star = undefined;
          // disposeMiningObject only releases the texture; the GPU bake also owns a render target.
          planet?.dispose();
          planet = undefined;
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
        else {
          cloudMesh?.geometry.dispose();
          cloudMesh?.material.dispose();
          clouds?.texture.dispose();
        }
        clouds = undefined;
        celestialBody = undefined;
        cloudMesh = undefined;
        cloudStormLayer = undefined;
        cloudStyle = undefined;
        giant?.dispose();
        giant = undefined;
        star?.dispose();
        star = undefined;
        planet?.dispose();
      });
    });
    beforeRender(({ delta }) => {
      if (
        cloudMesh &&
        this.state.status() === 'ready' &&
        !this.state.reducedMotion() &&
        !this.state.documentHidden() &&
        this.cloudSettings.enabled()
      ) {
        cloudMesh.rotation.y += Math.min(delta, 0.05) * CLOUD_DRIFT_RADIANS_PER_SECOND;
        cloudStormLayer?.advance(delta);
      }
      if (giant && this.state.status() === 'ready' && !this.state.reducedMotion() && !this.state.documentHidden()) {
        giant.advance(delta);
      }
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
