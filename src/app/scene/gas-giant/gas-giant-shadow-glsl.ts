import { Vector3, Vector4, type Texture } from 'three';

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
    ggRingNormal: { value: new Vector3(0, 1, 0) },
    ggRingInner: { value: 0 },
    ggRingOuter: { value: 0 },
    ggRingMap: { value: ringMap },
    ggHasRings: { value: ringMap ? 1 : 0 },
    ggMoons: { value: Array.from({ length: GAS_GIANT_MAX_MOON_SHADOWS }, () => new Vector4()) },
    ggMoonCount: { value: 0 },
  };
}

/** Ring and moon shadows cast onto the planet surface. */
export const GAS_GIANT_SHADOW_GLSL = `
uniform vec3 ggLightDirection;
uniform vec3 ggPlanetCenter;
uniform float ggPlanetRadius;
uniform vec3 ggRingNormal;
uniform float ggRingInner;
uniform float ggRingOuter;
uniform sampler2D ggRingMap;
uniform float ggHasRings;
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
          float ringAlpha = texture2D(ggRingMap, vec2((r - ggRingInner) / (ggRingOuter - ggRingInner), 0.5)).a;
          shadow *= 1.0 - 0.85 * ringAlpha;
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
  float along = dot(toCenter, ggLightDirection);
  if (along <= 0.0) return 1.0;
  float miss = length(toCenter - ggLightDirection * along);
  return mix(0.06, 1.0, smoothstep(ggPlanetRadius * 0.97, ggPlanetRadius * 1.02, miss));
}
`;
