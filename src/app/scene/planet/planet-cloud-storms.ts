import { MeshStandardMaterial, Vector4, type Texture } from 'three';
import { createSeededRng, fnv1a32 } from '../../model/planet/planet-seed';
import { DEFAULT_STORM_ACTIVITY, type PlanetCloudStyle } from './planet-clouds';
import { SWIRL_STORM_GLSL } from './swirl-storm-glsl';

export interface CloudStorm {
  /** Equirectangular UV center, UV radius, and direction (+1 or -1). */
  center: Vector4;
}

export function createCloudStorms(bodyId: string, style: PlanetCloudStyle): readonly [CloudStorm, CloudStorm] {
  const random = createSeededRng(fnv1a32(`terran-storms-v1|${style}|${bodyId}`));
  const firstU = 0.18 + random() * 0.16;
  const firstV = 0.62 + random() * 0.1;
  const secondU = (firstU + 0.47 + random() * 0.06) % 1;
  const secondV = 0.4 + random() * 0.2;
  const radius = style === 'thick' ? 0.17 : 0.095;
  return [{ center: new Vector4(firstU, firstV, radius, 1) }, { center: new Vector4(secondU, secondV, radius, -1) }];
}

export interface PlanetCloudStormMaterial {
  material: MeshStandardMaterial;
  advance(delta: number): void;
  /** 0-100; scales vortex size without affecting cloud coverage or spin rate. */
  setActivity(percent: number): void;
}

/** 100% activity yields vortices 25% wider than the seeded base radius. */
export function stormRadiusScale(percent: number): number {
  return (Math.max(0, Math.min(100, percent)) / 100) * 1.25;
}

export function createPlanetCloudStormMaterial(
  bodyId: string,
  style: PlanetCloudStyle,
  texture: Texture,
): PlanetCloudStormMaterial {
  const storms = createCloudStorms(bodyId, style);
  const time = { value: 0 };
  const activity = { value: stormRadiusScale(DEFAULT_STORM_ACTIVITY) };
  const material = new MeshStandardMaterial({
    map: texture,
    transparent: true,
    opacity: style === 'thick' ? 1 : 0.7,
    depthWrite: false,
    roughness: 1,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms['cloudStormTime'] = time;
    shader.uniforms['cloudStormActivity'] = activity;
    shader.uniforms['cloudStormA'] = { value: storms[0].center };
    shader.uniforms['cloudStormB'] = { value: storms[1].center };
    shader.uniforms['cloudStormContrast'] = { value: style === 'thick' ? 0.2 : 0.1 };
    if (!shader.fragmentShader.includes('#include <map_fragment>')) {
      throw new Error('Cloud storm shader requires the three.js map_fragment chunk.');
    }
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <map_fragment>',
        `
        #ifdef USE_MAP
          vec4 cloudColor = cloudStormSample(vMapUv, cloudStormA, texture2D(map, vMapUv));
          cloudColor = cloudStormSample(vMapUv, cloudStormB, cloudColor);
          diffuseColor *= cloudColor;
        #endif
        `,
      )
      .replace(
        '#include <map_pars_fragment>',
        `#include <map_pars_fragment>
        uniform float cloudStormTime;
        uniform float cloudStormActivity;
        uniform float cloudStormContrast;
        uniform vec4 cloudStormA;
        uniform vec4 cloudStormB;
        #ifdef USE_MAP
        ${SWIRL_STORM_GLSL}
        vec4 cloudStormSample(vec2 uv, vec4 storm, vec4 baseColor) {
          return swirlStormSample(map, uv, storm, baseColor, cloudStormTime, cloudStormActivity, cloudStormContrast);
        }
        #endif`,
      );
  };
  material.customProgramCacheKey = () => 'planet-cloud-storms-v1';
  const radiansPerSecond = (Math.PI * 2) / (style === 'thick' ? 150 : 110);
  return {
    material,
    advance(delta: number): void {
      time.value = (time.value + Math.min(delta, 0.05) * radiansPerSecond) % (Math.PI * 2);
    },
    setActivity(percent: number): void {
      activity.value = stormRadiusScale(percent);
    },
  };
}
