import { Vector2, Vector3, Vector4, type Texture } from 'three';

/** Maximum moons that can cast shadows on the giant in a single frame. */
export const GAS_GIANT_MAX_MOON_SHADOWS = 4;

/**
 * World-space shadow inputs shared by the planet and ring materials. The same
 * uniform objects are referenced by both programs and refreshed once per frame.
 */
export interface GasGiantShadowUniforms {
  [name: string]: { value: unknown };
  ggLightDirection: { value: Vector3 };
  ggPlanetCenter: { value: Vector3 };
  ggPlanetRadius: { value: number };
  ggPlanetPolarRatio: { value: number };
  ggRingOpticalDepth: { value: number };
  ggRingMapSize: { value: Vector2 };
  ggRingMapSamples: { value: number };
  ggRingNormal: { value: Vector3 };
  ggRingInner: { value: number };
  ggRingOuter: { value: number };
  ggRingMap: { value: Texture | null };
  ggHasRings: { value: number };
  ggMoons: { value: Vector4[] };
  ggMoonCount: { value: number };
}

export function createGasGiantShadowUniforms(ringMap: Texture | null): GasGiantShadowUniforms {
  return {
    ggLightDirection: { value: new Vector3(0, 0, 1) },
    ggPlanetCenter: { value: new Vector3() },
    ggPlanetRadius: { value: 1 },
    ggPlanetPolarRatio: { value: 1 },
    ggRingOpticalDepth: { value: 0 },
    ggRingMapSize: { value: new Vector2(512, 1) },
    ggRingMapSamples: { value: 512 },
    ggRingNormal: { value: new Vector3(0, 1, 0) },
    ggRingInner: { value: 0 },
    ggRingOuter: { value: 0 },
    ggRingMap: { value: ringMap },
    ggHasRings: { value: ringMap ? 1 : 0 },
    ggMoons: { value: Array.from({ length: GAS_GIANT_MAX_MOON_SHADOWS }, () => new Vector4()) },
    ggMoonCount: { value: 0 },
  };
}

export const GAS_GIANT_RING_SAMPLE_GLSL = `
uniform sampler2D ggRingMap;
uniform vec2 ggRingMapSize;
uniform float ggRingMapSamples;
vec2 ggRingTexel(float index) {
  return (vec2(mod(index, ggRingMapSize.x), floor(index / ggRingMapSize.x)) + 0.5) / ggRingMapSize;
}
vec4 ggSampleRing(float t) {
  if (ggRingMapSize.y < 1.5) return texture2D(ggRingMap, vec2(t, 0.5));
  float index = clamp(t * ggRingMapSamples - 0.5, 0.0, ggRingMapSamples - 1.0);
  float low = floor(index);
  return mix(texture2D(ggRingMap, ggRingTexel(low)),
    texture2D(ggRingMap, ggRingTexel(min(low + 1.0, ggRingMapSamples - 1.0))), fract(index));
}
`;

/** Ring and moon shadows cast onto the planet surface. */
export const GAS_GIANT_SHADOW_GLSL = `
uniform vec3 ggLightDirection;
uniform vec3 ggPlanetCenter;
uniform float ggPlanetRadius;
uniform vec3 ggRingNormal;
uniform float ggRingInner;
uniform float ggRingOuter;
${GAS_GIANT_RING_SAMPLE_GLSL}
uniform float ggHasRings;
uniform float ggRingOpticalDepth;
uniform vec4 ggMoons[${GAS_GIANT_MAX_MOON_SHADOWS}];
uniform int ggMoonCount;

float ggShadowFactor(vec3 worldPosition) {
  float shadow = 1.0;
  if (ggHasRings > 0.5) {
    float facing = dot(ggLightDirection, ggRingNormal);
    if (abs(facing) > 1e-4) {
      float t = dot(ggPlanetCenter - worldPosition, ggRingNormal) / facing;
      if (t > 0.0) {
        float r = length(worldPosition + ggLightDirection * t - ggPlanetCenter);
        if (r > ggRingInner && r < ggRingOuter) {
          float ringAlpha = ggSampleRing((r - ggRingInner) / (ggRingOuter - ggRingInner)).a;
          float transmission = pow(1.0 - ringAlpha, 1.0 / max(abs(facing), 0.08));
          shadow *= ggRingOpticalDepth > 0.5 ? 0.15 + 0.85 * transmission : 1.0 - 0.85 * ringAlpha;
        }
      }
    }
  }
  for (int index = 0; index < ${GAS_GIANT_MAX_MOON_SHADOWS}; index++) {
    if (index >= ggMoonCount) break;
    vec4 moon = ggMoons[index];
    vec3 toMoon = moon.xyz - worldPosition;
    float along = dot(toMoon, ggLightDirection);
    if (along <= 0.0) continue;
    float miss = length(toMoon - ggLightDirection * along);
    shadow *= mix(0.12, 1.0, smoothstep(moon.w * 0.8, moon.w * 1.2, miss));
  }
  return shadow;
}
`;

/** Planet shadow cast onto the rings: the ray toward the light through the planet sphere. */
export const GAS_GIANT_PLANET_SHADOW_GLSL = `
float ggPlanetShadow(vec3 worldPosition) {
  vec3 toCenter = ggPlanetCenter - worldPosition;
  float flattening = 1.0 / (ggPlanetPolarRatio * ggPlanetPolarRatio) - 1.0;
  float rayAxis = dot(ggLightDirection, ggRingNormal);
  float centerAxis = dot(toCenter, ggRingNormal);
  float rayLengthSq = 1.0 + flattening * rayAxis * rayAxis;
  float along = (dot(toCenter, ggLightDirection) + flattening * centerAxis * rayAxis) / rayLengthSq;
  if (along <= 0.0) return 1.0;
  vec3 closest = toCenter - ggLightDirection * along;
  float axis = dot(closest, ggRingNormal);
  float miss = sqrt(dot(closest, closest) + flattening * axis * axis);
  return mix(0.06, 1.0, smoothstep(ggPlanetRadius * 0.97, ggPlanetRadius * 1.02, miss));
}
`;
