import {
  ClampToEdgeWrapping,
  Color,
  DataTexture,
  LinearFilter,
  MeshStandardMaterial,
  NoColorSpace,
  RGBAFormat,
  UnsignedByteType,
  Vector3,
  Vector4,
  type Texture,
} from 'three';
import {
  GAS_GIANT_MAX_OVALS,
  sampleBandFlow,
  vToLatitude,
  type GasGiantProfile,
  type GasGiantVortex,
} from '../../model/planet/gas-giant-profile';
import { SWIRL_STORM_GLSL } from '../planet/swirl-storm-glsl';
import { GAS_GIANT_SHADOW_GLSL, type GasGiantShadowUniforms } from './gas-giant-shadow-glsl';

export const GAS_GIANT_MATERIAL_CACHE_KEY = 'gas-giant-atmosphere-v1';

/** Assumed equilibrium temperature for a hot variant with no catalog value. */
export const HOT_GIANT_DEFAULT_TEMPERATURE_K = 1500;
/** Super-Jupiters only glow when they are hot enough to emit visibly. */
export const SUPER_JUPITER_GLOW_MIN_TEMPERATURE_K = 1000;

export type GasGiantVariantDefine =
  | 'GG_VARIANT_HAZE'
  | 'GG_VARIANT_DAYGLOW'
  | 'GG_VARIANT_NIGHTGLOW'
  | 'GG_VARIANT_UNIFORMGLOW';

/** Per-type look on top of the shared banded atmosphere. Colours are linear RGB. */
export interface GasGiantVariantShading {
  defines: readonly GasGiantVariantDefine[];
  hazeColor: readonly [number, number, number];
  hazeStrength: number;
  glowColor: readonly [number, number, number];
  glowStrength: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Rough blackbody tint (linear) for 1000-3000 K: deep red to orange-white. */
export function thermalGlowColor(temperatureK: number): readonly [number, number, number] {
  const t = clamp01((temperatureK - 1000) / 2000);
  const lerp = (a: number, b: number, c: number) =>
    t < 0.5 ? a + (b - a) * (t / 0.5) : b + (c - b) * ((t - 0.5) / 0.5);
  return [lerp(0.6, 1, 1), lerp(0.1, 0.35, 0.6), lerp(0.02, 0.08, 0.3)];
}

/** Glow strength grows from 0.15 at 1000 K to 0.6 at 2500 K and above. */
export function thermalGlowStrength(temperatureK: number): number {
  return 0.15 + 0.45 * clamp01((temperatureK - 1000) / 1500);
}

export function resolveGasGiantVariantShading(
  profile: Pick<GasGiantProfile, 'variant' | 'meanTemperatureK'>,
): GasGiantVariantShading {
  const none: GasGiantVariantShading = {
    defines: [],
    hazeColor: [0, 0, 0],
    hazeStrength: 0,
    glowColor: [0, 0, 0],
    glowStrength: 0,
  };
  const temperature = profile.meanTemperatureK ?? HOT_GIANT_DEFAULT_TEMPERATURE_K;
  switch (profile.variant) {
    case 'sub-neptune':
      return { ...none, defines: ['GG_VARIANT_HAZE'], hazeColor: [0.62, 0.74, 0.82], hazeStrength: 0.55 };
    case 'hot-neptune':
      return {
        defines: ['GG_VARIANT_HAZE', 'GG_VARIANT_DAYGLOW'],
        hazeColor: [0.78, 0.7, 0.6],
        hazeStrength: 0.3,
        glowColor: thermalGlowColor(temperature),
        glowStrength: thermalGlowStrength(temperature) * 0.6,
      };
    case 'hot-jupiter':
      return {
        ...none,
        defines: ['GG_VARIANT_NIGHTGLOW'],
        glowColor: thermalGlowColor(temperature),
        glowStrength: thermalGlowStrength(temperature),
      };
    case 'super-jupiter':
      if (profile.meanTemperatureK === null || profile.meanTemperatureK < SUPER_JUPITER_GLOW_MIN_TEMPERATURE_K) {
        return none;
      }
      return {
        ...none,
        defines: ['GG_VARIANT_UNIFORMGLOW'],
        glowColor: thermalGlowColor(profile.meanTemperatureK),
        glowStrength: thermalGlowStrength(profile.meanTemperatureK) * 0.5,
      };
    default:
      return none;
  }
}

export function gasGiantMaterialCacheKey(shading: GasGiantVariantShading): string {
  return shading.defines.length ? `${GAS_GIANT_MATERIAL_CACHE_KEY}|${shading.defines.join(',')}` : GAS_GIANT_MATERIAL_CACHE_KEY;
}

/** Seconds per flow-map cycle; two phases half a cycle apart are crossfaded. */
export const GAS_GIANT_FLOW_PERIOD_SECONDS = 24;
/** Maximum band shift in `u` across one flow cycle at full jet speed. */
export const GAS_GIANT_FLOW_STRENGTH = 0.025;
const FLOW_SAMPLES = 256;
export const GAS_GIANT_ALBEDO_SCALE = 0.72;

/** Storm activity percent mapped to a vortex size scale; 60% (the default) keeps seeded sizes. */
export function gasGiantVortexScale(percent: number): number {
  return Math.max(0, Math.min(100, percent)) / 60;
}

/** Packs zonal jet speed per latitude into a 256x1 lookup (row is `v`, 0 south). */
export function createGasGiantFlowTexture(profile: GasGiantProfile): DataTexture {
  const data = new Uint8Array(FLOW_SAMPLES * 4);
  for (let index = 0; index < FLOW_SAMPLES; index++) {
    const flow = sampleBandFlow(profile.bands, vToLatitude((index + 0.5) / FLOW_SAMPLES));
    const encoded = Math.round((Math.max(-1, Math.min(1, flow)) * 0.5 + 0.5) * 255);
    data.set([encoded, encoded, encoded, 255], index * 4);
  }
  const texture = new DataTexture(data, FLOW_SAMPLES, 1, RGBAFormat, UnsignedByteType);
  texture.colorSpace = NoColorSpace;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function vortexShape(vortex: GasGiantVortex): Vector4 {
  return new Vector4(vortex.u, vortex.v, vortex.radiusU, vortex.radiusV);
}

function vortexTint(vortex: GasGiantVortex): Vector4 {
  // Palette colours are authored in sRGB; the shader works in linear space.
  const linear = new Color(vortex.color[0], vortex.color[1], vortex.color[2]).convertSRGBToLinear();
  return new Vector4(linear.r, linear.g, linear.b, vortex.direction);
}

export interface GasGiantMaterialOptions {
  profile: GasGiantProfile;
  bandTexture: Texture;
  flowTexture: Texture;
  shadows: GasGiantShadowUniforms;
}

export interface GasGiantMaterialHandle {
  material: MeshStandardMaterial;
  /** Live uniform values; vortex `x` components drift as `advance` runs. */
  readonly uniforms: {
    flowPhase: { value: number };
    vortexTime: { value: number };
    swirlTime: { value: number };
    vortexScale: { value: number };
    swirlActivity: { value: number };
    anticyclone: { value: Vector4 };
    ovalShapes: { value: Vector4[] };
  };
}

export function createGasGiantMaterial(options: GasGiantMaterialOptions): GasGiantMaterialHandle {
  const { profile, bandTexture, flowTexture, shadows } = options;
  const anticyclone = profile.anticyclone;
  const ovalShapes = Array.from({ length: GAS_GIANT_MAX_OVALS }, (_, index) =>
    profile.ovals[index] ? vortexShape(profile.ovals[index]) : new Vector4(),
  );
  const ovalTints = Array.from({ length: GAS_GIANT_MAX_OVALS }, (_, index) =>
    profile.ovals[index] ? vortexTint(profile.ovals[index]) : new Vector4(),
  );
  const uniforms = {
    flowPhase: { value: 0 },
    vortexTime: { value: 0 },
    swirlTime: { value: 0 },
    vortexScale: { value: 1 },
    swirlActivity: { value: 1 },
    anticyclone: { value: anticyclone ? vortexShape(anticyclone) : new Vector4() },
    ovalShapes: { value: ovalShapes },
  };
  const swirls = profile.swirls
    .slice(0, 2)
    .map((swirl) => new Vector4(swirl.u, swirl.v, swirl.radius, swirl.direction));

  const material = new MeshStandardMaterial({
    map: bandTexture,
    // Band palettes are authored bright; a real giant's albedo sits near 0.5.
    color: new Color(GAS_GIANT_ALBEDO_SCALE, GAS_GIANT_ALBEDO_SCALE, GAS_GIANT_ALBEDO_SCALE),
    roughness: 0.92,
    metalness: 0,
  });
  const shading = resolveGasGiantVariantShading(profile);
  material.defines = Object.fromEntries(shading.defines.map((define) => [define, '']));
  material.onBeforeCompile = (shader) => {
    if (!shader.fragmentShader.includes('#include <map_fragment>')) {
      throw new Error('Gas giant shader requires the three.js map_fragment chunk.');
    }
    Object.assign(shader.uniforms, {
      ggFlowMap: { value: flowTexture },
      ggFlowPhase: uniforms.flowPhase,
      ggFlowStrength: { value: GAS_GIANT_FLOW_STRENGTH },
      ggVortexTime: uniforms.vortexTime,
      ggVortexScale: uniforms.vortexScale,
      ggAnticyclone: uniforms.anticyclone,
      ggAnticycloneTint: { value: anticyclone ? vortexTint(anticyclone) : new Vector4() },
      ggHasAnticyclone: { value: anticyclone ? 1 : 0 },
      ggOvalShapes: uniforms.ovalShapes,
      ggOvalTints: { value: ovalTints },
      ggOvalCount: { value: Math.min(GAS_GIANT_MAX_OVALS, profile.ovals.length) },
      ggSwirlA: { value: swirls[0] ?? new Vector4() },
      ggSwirlB: { value: swirls[1] ?? new Vector4() },
      ggSwirlTime: uniforms.swirlTime,
      ggSwirlActivity: uniforms.swirlActivity,
      ggHazeColor: { value: new Vector3(...shading.hazeColor) },
      ggHazeStrength: { value: shading.hazeStrength },
      ggGlowColor: { value: new Vector3(...shading.glowColor) },
      ggGlowStrength: { value: shading.glowStrength },
      ...shadows,
    });

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGgWorldPosition;')
      .replace(
        '#include <project_vertex>',
        '#include <project_vertex>\nvGgWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <map_pars_fragment>',
        `#include <map_pars_fragment>
${GAS_GIANT_ATMOSPHERE_PARS_GLSL}
${GAS_GIANT_SHADOW_GLSL}
${GAS_GIANT_VARIANT_GLSL}`,
      )
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
          diffuseColor *= ggAtmosphereColor(vMapUv);
        #endif
        #ifdef GG_VARIANT_HAZE
          diffuseColor.rgb = ggApplyHaze(diffuseColor.rgb);
        #endif`,
      )
      .replace(
        '#include <lights_fragment_end>',
        `#include <lights_fragment_end>
        float ggShadow = ggShadowFactor(vGgWorldPosition);
        reflectedLight.directDiffuse *= ggShadow;
        reflectedLight.directSpecular *= ggShadow;
        totalEmissiveRadiance += ggVariantGlow();`,
      );
  };
  material.customProgramCacheKey = () => gasGiantMaterialCacheKey(shading);
  return { material, uniforms };
}

const GAS_GIANT_ATMOSPHERE_PARS_GLSL = `
varying vec3 vGgWorldPosition;
uniform sampler2D ggFlowMap;
uniform float ggFlowPhase;
uniform float ggFlowStrength;
uniform float ggVortexTime;
uniform float ggVortexScale;
uniform vec4 ggAnticyclone;
uniform vec4 ggAnticycloneTint;
uniform float ggHasAnticyclone;
uniform vec4 ggOvalShapes[${GAS_GIANT_MAX_OVALS}];
uniform vec4 ggOvalTints[${GAS_GIANT_MAX_OVALS}];
uniform int ggOvalCount;
uniform vec4 ggSwirlA;
uniform vec4 ggSwirlB;
uniform float ggSwirlTime;
uniform float ggSwirlActivity;
${SWIRL_STORM_GLSL}

// Two flow phases half a cycle apart, crossfaded so the shift never grows unbounded.
vec4 ggBandSample(vec2 uv) {
  float flow = texture2D(ggFlowMap, vec2(uv.y, 0.5)).r * 2.0 - 1.0;
  float shift = flow * ggFlowStrength;
  float phaseA = fract(ggFlowPhase);
  float phaseB = fract(ggFlowPhase + 0.5);
  vec4 a = texture2D(map, vec2(uv.x + shift * phaseA, uv.y));
  vec4 b = texture2D(map, vec2(uv.x + shift * phaseB, uv.y));
  return mix(a, b, abs(1.0 - 2.0 * phaseA));
}

// Elliptical vortex: a spun, tinted core inside a pale collar.
vec4 ggVortexSample(vec2 uv, vec4 shape, vec4 tint, vec4 baseColor, float collarStrength, float coreStrength) {
  vec2 radii = shape.zw * ggVortexScale;
  if (radii.x <= 0.0 || radii.y <= 0.0) return baseColor;
  vec2 offset = vec2(fract(uv.x - shape.x + 0.5) - 0.5, uv.y - shape.y);
  vec2 normalized = offset / radii;
  float r = length(normalized);
  if (r >= 1.45) return baseColor;
  float angle = tint.w * (ggVortexTime + 3.4 * (1.0 - min(r, 1.0)));
  float c = cos(angle);
  float s = sin(angle);
  vec2 spun = mat2(c, s, -s, c) * normalized;
  vec2 sampleUv = vec2(fract(shape.x + spun.x * radii.x), clamp(shape.y + spun.y * radii.y, 0.0, 1.0));
  float core = 1.0 - smoothstep(0.6, 1.0, r);
  vec4 spunColor = ggBandSample(sampleUv);
  vec3 color = mix(baseColor.rgb, spunColor.rgb, core);
  float luminance = dot(spunColor.rgb, vec3(0.299, 0.587, 0.114));
  vec3 tinted = tint.rgb * (0.75 + 0.5 * luminance);
  color = mix(color, tinted, core * coreStrength);
  float spiral = 0.5 + 0.5 * sin(2.0 * atan(spun.y, spun.x) + 9.0 * r);
  color *= 1.0 - 0.14 * spiral * core;
  float collar = smoothstep(0.82, 1.0, r) * (1.0 - smoothstep(1.0, 1.42, r));
  color = mix(color, vec3(0.96, 0.93, 0.86), collar * collarStrength);
  return vec4(color, baseColor.a);
}

vec4 ggAtmosphereColor(vec2 uv) {
  vec4 color = ggBandSample(uv);
  if (ggHasAnticyclone > 0.5) {
    color = ggVortexSample(uv, ggAnticyclone, ggAnticycloneTint, color, 0.32, 0.78);
  }
  for (int index = 0; index < ${GAS_GIANT_MAX_OVALS}; index++) {
    if (index >= ggOvalCount) break;
    color = ggVortexSample(uv, ggOvalShapes[index], ggOvalTints[index], color, 0.12, 0.85);
  }
  color = swirlStormSample(map, uv, ggSwirlA, color, ggSwirlTime, ggSwirlActivity, 0.12);
  color = swirlStormSample(map, uv, ggSwirlB, color, ggSwirlTime, ggSwirlActivity, 0.12);
  return color;
}
`;

/** Haze and thermal glow per type; needs the shadow uniforms (light direction, planet centre). */
const GAS_GIANT_VARIANT_GLSL = `
uniform vec3 ggHazeColor;
uniform float ggHazeStrength;
uniform vec3 ggGlowColor;
uniform float ggGlowStrength;

vec3 ggSurfaceNormal() {
  return normalize(vGgWorldPosition - ggPlanetCenter);
}

// Muted bands overall, thicker toward the limb.
vec3 ggApplyHaze(vec3 color) {
  vec3 viewDir = normalize(cameraPosition - vGgWorldPosition);
  float rim = 1.0 - max(dot(ggSurfaceNormal(), viewDir), 0.0);
  float amount = ggHazeStrength * (0.45 + 0.55 * rim * rim);
  float luminance = dot(color, vec3(0.299, 0.587, 0.114));
  vec3 muted = mix(color, vec3(luminance), 0.5);
  return mix(muted, ggHazeColor * max(luminance, 0.35) * 1.4, clamp(amount, 0.0, 1.0));
}

vec3 ggVariantGlow() {
  float facing = dot(ggSurfaceNormal(), normalize(ggLightDirection));
  #if defined(GG_VARIANT_NIGHTGLOW)
    return ggGlowColor * ggGlowStrength * (1.0 - smoothstep(-0.15, 0.25, facing));
  #elif defined(GG_VARIANT_DAYGLOW)
    return ggGlowColor * ggGlowStrength * smoothstep(0.0, 1.0, facing);
  #elif defined(GG_VARIANT_UNIFORMGLOW)
    return ggGlowColor * ggGlowStrength;
  #else
    return vec3(0.0);
  #endif
}
`;

/** Default light direction (toward the light) when the caller has not provided one. */
export const DEFAULT_GAS_GIANT_LIGHT_DIRECTION = new Vector3(3, 4, 4).normalize();
