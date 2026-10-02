import { Group, Mesh, SphereGeometry, Vector3, Vector4, type ColorRepresentation, type Texture } from 'three';
import {
  sampleBandFlow,
  vToLatitude,
  type GasGiantProfile,
  type GasGiantVortex,
} from '../../model/planet/gas-giant-profile';
import { stormRadiusScale } from '../planet/planet-cloud-storms';
import { createGasGiantBandTexture, type GasGiantBandSize } from './gas-giant-bands';
import {
  createGasGiantFlowTexture,
  createGasGiantMaterial,
  GAS_GIANT_FLOW_PERIOD_SECONDS,
  gasGiantVortexScale,
} from './gas-giant-material';
import { createGasGiantRingGeometry, createGasGiantRingMaterial, createGasGiantRingTexture } from './gas-giant-rings';
import { createGasGiantShadowUniforms, GAS_GIANT_MAX_MOON_SHADOWS } from './gas-giant-shadow-glsl';

export interface GasGiantMoonShadowCaster {
  /** World-space centre. */
  position: Vector3;
  /** World-space radius. */
  radius: number;
}

export interface CreateGasGiantOptions {
  radius?: number;
  textureSize?: GasGiantBandSize;
  widthSegments?: number;
  heightSegments?: number;
  spinRadiansPerSecond?: number;
}

export interface GasGiantHandle {
  /** Root to place in the scene; holds the tilted planet and rings. */
  readonly group: Group;
  readonly planet: Mesh;
  readonly rings: Mesh | null;
  advance(delta: number): void;
  /** 0-100, shared with the terran storm activity control. */
  setStormActivity(percent: number): void;
  /** World-space direction from the planet toward its star. */
  setLightDirection(direction: Vector3): void;
  setLightColor(color: ColorRepresentation): void;
  setMoons(moons: readonly GasGiantMoonShadowCaster[]): void;
  setHighlight(highlighted: boolean): void;
  dispose(): void;
}

const VORTEX_SPIN_RADIANS_PER_SECOND = (Math.PI * 2) / 90;
const SWIRL_SPIN_RADIANS_PER_SECOND = (Math.PI * 2) / 120;
/** Vortices ride their band's jet slowly enough to lap the planet in tens of minutes. */
const VORTEX_DRIFT_U_PER_SECOND = 0.0007;

function vortexDrift(profile: GasGiantProfile, vortex: GasGiantVortex | null): number {
  return vortex ? sampleBandFlow(profile.bands, vToLatitude(vortex.v)) * VORTEX_DRIFT_U_PER_SECOND : 0;
}

export function createGasGiant(profile: GasGiantProfile, options: CreateGasGiantOptions = {}): GasGiantHandle {
  const radius = options.radius ?? 1;
  const spin = options.spinRadiansPerSecond ?? 0.02;
  const bandTexture = createGasGiantBandTexture(profile, options.textureSize ?? { width: 1024, height: 512 });
  const flowTexture = createGasGiantFlowTexture(profile);
  const ringTexture = profile.rings ? createGasGiantRingTexture(profile.rings) : null;
  const shadows = createGasGiantShadowUniforms(ringTexture);
  shadows.ggLightDirection.value.set(3, 4, 4).normalize();
  const atmosphere = createGasGiantMaterial({ profile, bandTexture, flowTexture, shadows });

  const group = new Group();
  group.name = 'gas-giant';
  group.userData['gasGiant'] = { bodyId: profile.bodyId, palette: profile.palette, rings: profile.rings !== null };
  const tilt = new Group();
  tilt.rotation.x = profile.axialTilt;
  group.add(tilt);

  const planet = new Mesh(
    new SphereGeometry(radius, options.widthSegments ?? 96, options.heightSegments ?? 64),
    atmosphere.material,
  );
  planet.name = 'gas-giant-planet';
  tilt.add(planet);

  let rings: Mesh | null = null;
  let ringHandle: ReturnType<typeof createGasGiantRingMaterial> | null = null;
  if (profile.rings) {
    ringHandle = createGasGiantRingMaterial(shadows);
    rings = new Mesh(createGasGiantRingGeometry(profile.rings, radius), ringHandle.material);
    rings.name = 'gas-giant-rings';
    rings.rotation.x = -Math.PI / 2;
    // Draw after the opaque planet so the far half of the ring blends over it correctly.
    rings.renderOrder = 1;
    tilt.add(rings);
  }

  const worldScale = new Vector3();
  const updateShadowFrame = () => {
    planet.getWorldPosition(shadows.ggPlanetCenter.value);
    planet.getWorldScale(worldScale);
    const scale = worldScale.x;
    shadows.ggPlanetRadius.value = radius * scale;
    shadows.ggRingNormal.value.set(0, 1, 0).transformDirection(planet.matrixWorld);
    if (profile.rings) {
      shadows.ggRingInner.value = profile.rings.innerRadius * radius * scale;
      shadows.ggRingOuter.value = profile.rings.outerRadius * radius * scale;
    }
  };
  planet.onBeforeRender = updateShadowFrame;
  if (rings) rings.onBeforeRender = updateShadowFrame;

  const anticycloneDrift = vortexDrift(profile, profile.anticyclone);
  const ovalDrift = profile.ovals.map((oval) => vortexDrift(profile, oval));
  const uniforms = atmosphere.uniforms;
  const wrap = (value: Vector4, drift: number, delta: number) => {
    value.x = (((value.x + drift * delta) % 1) + 1) % 1;
  };
  const textures: Texture[] = [bandTexture, flowTexture, ...(ringTexture ? [ringTexture] : [])];

  return {
    group,
    planet,
    rings,
    advance(delta: number): void {
      const step = Math.min(Math.max(delta, 0), 0.05);
      planet.rotation.y = (planet.rotation.y + step * spin) % (Math.PI * 2);
      uniforms.flowPhase.value = (uniforms.flowPhase.value + step / GAS_GIANT_FLOW_PERIOD_SECONDS) % 1;
      uniforms.vortexTime.value = (uniforms.vortexTime.value + step * VORTEX_SPIN_RADIANS_PER_SECOND) % (Math.PI * 2);
      uniforms.swirlTime.value = (uniforms.swirlTime.value + step * SWIRL_SPIN_RADIANS_PER_SECOND) % (Math.PI * 2);
      wrap(uniforms.anticyclone.value, anticycloneDrift, step);
      ovalDrift.forEach((drift, index) => wrap(uniforms.ovalShapes.value[index], drift, step));
    },
    setStormActivity(percent: number): void {
      uniforms.vortexScale.value = gasGiantVortexScale(percent);
      uniforms.swirlActivity.value = stormRadiusScale(percent);
    },
    setLightDirection(direction: Vector3): void {
      if (direction.lengthSq() > 0) shadows.ggLightDirection.value.copy(direction).normalize();
    },
    setLightColor(color: ColorRepresentation): void {
      ringHandle?.uniforms.ringLightColor.value.set(color);
    },
    setMoons(moons: readonly GasGiantMoonShadowCaster[]): void {
      const count = Math.min(GAS_GIANT_MAX_MOON_SHADOWS, moons.length);
      for (let index = 0; index < count; index++) {
        const { position, radius: moonRadius } = moons[index];
        shadows.ggMoons.value[index].set(position.x, position.y, position.z, moonRadius);
      }
      shadows.ggMoonCount.value = count;
    },
    setHighlight(highlighted: boolean): void {
      atmosphere.material.emissive.set(highlighted ? 0x1a2433 : 0x000000);
      if (ringHandle) ringHandle.uniforms.ringHighlight.value = highlighted ? 1 : 0;
    },
    dispose(): void {
      planet.geometry.dispose();
      atmosphere.material.dispose();
      rings?.geometry.dispose();
      ringHandle?.material.dispose();
      textures.forEach((texture) => texture.dispose());
    },
  };
}
