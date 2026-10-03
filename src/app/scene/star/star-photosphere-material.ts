/**
 * Photosphere shader for procedural stars.
 *
 * Self-luminous and unlit: animated Worley granulation with a domain warp,
 * optional latitude bands and soot (brown dwarfs, carbon stars), seeded
 * starspots, flare brightening and limb darkening. Every input comes from a
 * `StarProfile`, so one material serves every spectral class.
 */
import { Color, ShaderMaterial, Vector3, Vector4 } from 'three';
import type { StarProfile, StarRgb } from '../../model/star/star-profile';
import { STAR_MAX_SPOTS } from '../../model/star/star-profile';
import { STAR_MAX_ACTIVE_FLARES, type StarFlareSample } from './star-flares';
import { STAR_NOISE_GLSL } from './star-noise-glsl';

export interface StarPhotosphereUniforms {
  uTime: { value: number };
  uColor: { value: Color };
  uNoiseOffset: { value: Vector3 };
  uGranulationScale: { value: number };
  uGranulationContrast: { value: number };
  uTurbulence: { value: number };
  uBandStrength: { value: number };
  uSootCoverage: { value: number };
  uLimbDarkening: { value: number };
  uEmission: { value: number };
  uSpots: { value: Vector4[] };
  uSpotCount: { value: number };
  uFlares: { value: Vector4[] };
  uHighlightColor: { value: Color };
  uHighlightAmount: { value: number };
}

export interface StarPhotosphereMaterialHandle {
  material: ShaderMaterial;
  uniforms: StarPhotosphereUniforms;
  setFlares(samples: readonly StarFlareSample[]): void;
}

export function linearStarColor(rgb: StarRgb): Color {
  return new Color(rgb[0], rgb[1], rgb[2]).convertSRGBToLinear();
}

export function createStarPhotosphereMaterial(profile: StarProfile): StarPhotosphereMaterialHandle {
  const spots = Array.from({ length: STAR_MAX_SPOTS }, (_, index) => {
    const spot = profile.spots[index];
    return spot
      ? new Vector4(spot.direction[0], spot.direction[1], spot.direction[2], spot.radius)
      : new Vector4(0, 1, 0, 0);
  });
  const uniforms: StarPhotosphereUniforms = {
    uTime: { value: 0 },
    uColor: { value: linearStarColor(profile.color) },
    uNoiseOffset: { value: new Vector3(...profile.noiseOffset) },
    uGranulationScale: { value: profile.granulationScale },
    uGranulationContrast: { value: profile.granulationContrast },
    uTurbulence: { value: profile.turbulence },
    uBandStrength: { value: profile.bandStrength },
    uSootCoverage: { value: profile.sootCoverage },
    uLimbDarkening: { value: profile.limbDarkening },
    uEmission: { value: profile.emission },
    uSpots: { value: spots },
    uSpotCount: { value: profile.spots.length },
    uFlares: { value: Array.from({ length: STAR_MAX_ACTIVE_FLARES }, () => new Vector4(0, 1, 0, 0)) },
    uHighlightColor: { value: new Color(1, 1, 1) },
    uHighlightAmount: { value: 0 },
  };
  const material = new ShaderMaterial({
    name: 'star-photosphere',
    uniforms: uniforms as unknown as ShaderMaterial['uniforms'],
    vertexShader: PHOTOSPHERE_VERTEX_GLSL,
    fragmentShader: PHOTOSPHERE_FRAGMENT_GLSL,
    toneMapped: false,
  });

  return {
    material,
    uniforms,
    setFlares(samples) {
      uniforms.uFlares.value.forEach((slot, index) => {
        const sample = samples[index];
        if (sample) slot.set(sample.direction[0], sample.direction[1], sample.direction[2], sample.envelope * sample.size);
        else slot.w = 0;
      });
    },
  };
}

const PHOTOSPHERE_VERTEX_GLSL = `
varying vec3 vSpherePosition;
varying vec3 vViewNormal;
varying vec3 vViewPosition;
void main() {
  vSpherePosition = normalize(position);
  vViewNormal = normalize(normalMatrix * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vViewPosition = mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const PHOTOSPHERE_FRAGMENT_GLSL = `
uniform float uTime;
uniform vec3 uColor;
uniform vec3 uNoiseOffset;
uniform float uGranulationScale;
uniform float uGranulationContrast;
uniform float uTurbulence;
uniform float uBandStrength;
uniform float uSootCoverage;
uniform float uLimbDarkening;
uniform float uEmission;
uniform vec4 uSpots[${STAR_MAX_SPOTS}];
uniform int uSpotCount;
uniform vec4 uFlares[${STAR_MAX_ACTIVE_FLARES}];
uniform vec3 uHighlightColor;
uniform float uHighlightAmount;
varying vec3 vSpherePosition;
varying vec3 vViewNormal;
varying vec3 vViewPosition;
${STAR_NOISE_GLSL}

void main() {
  vec3 p = vSpherePosition;
  vec3 cellPosition = p * uGranulationScale * 2.6 + uNoiseOffset;
  vec3 warp = vec3(
    starFbm(cellPosition * 0.25 + vec3(0.0, uTime * 0.04, 0.0)),
    starFbm(cellPosition * 0.25 + vec3(5.2, 1.3, uTime * 0.04)),
    starFbm(cellPosition * 0.25 + vec3(uTime * 0.04, 9.7, 2.8))
  ) - 0.5;
  vec2 worley = starWorley(cellPosition + warp * uTurbulence * 2.5, uTime * 0.6);
  // Bright upwelling cell centres, soft dark intergranular lanes, fine turbulent texture.
  float cells = 1.0 - smoothstep(0.05, 0.85, worley.x);
  float lanes = smoothstep(0.0, 0.45, worley.y - worley.x);
  float fine = starFbm(cellPosition * 2.7 + vec3(uTime * 0.05));
  float granule = clamp(cells * 0.45 + lanes * 0.18 + fine * 0.55 - 0.08, 0.0, 1.0);
  float supergranule = starFbm(p * 4.0 + uNoiseOffset.yzx + vec3(0.0, 0.0, uTime * 0.015));
  float heat = mix(1.0 - uGranulationContrast, 1.0, granule) * (0.86 + 0.28 * supergranule);

  if (uBandStrength > 0.0) {
    float wobble = starFbm(vec3(p.x * 3.0, p.y * 1.5, p.z * 3.0) + uNoiseOffset + vec3(uTime * 0.03, 0.0, 0.0));
    float bands = sin((p.y + (wobble - 0.5) * 0.25) * 18.0);
    heat *= 1.0 + uBandStrength * 0.35 * bands;
  }

  if (uSootCoverage > 0.0) {
    float soot = starFbm(p * 2.6 + uNoiseOffset.zxy + vec3(0.0, uTime * 0.02, 0.0));
    heat *= 1.0 - 0.75 * smoothstep(1.0 - uSootCoverage, 1.0 - uSootCoverage + 0.18, soot);
  }
  for (int index = 0; index < ${STAR_MAX_SPOTS}; index++) {
    if (index >= uSpotCount) break;
    vec4 spot = uSpots[index];
    float spotDistance = acos(clamp(dot(p, spot.xyz), -1.0, 1.0));
    float penumbra = 1.0 - smoothstep(spot.w * 0.45, spot.w, spotDistance);
    float umbra = 1.0 - smoothstep(spot.w * 0.2, spot.w * 0.45, spotDistance);
    heat *= 1.0 - penumbra * 0.4 - umbra * 0.35;
  }

  float flare = 0.0;
  for (int index = 0; index < ${STAR_MAX_ACTIVE_FLARES}; index++) {
    vec4 event = uFlares[index];
    if (event.w <= 0.0) continue;
    float closeness = max(dot(p, event.xyz), 0.0);
    flare += event.w * pow(closeness, 140.0) * 2.2;
  }

  vec3 viewDirection = normalize(-vViewPosition);
  float mu = clamp(dot(normalize(vViewNormal), viewDirection), 0.0, 1.0);
  float limb = 1.0 - uLimbDarkening * (1.0 - pow(mu, 0.6));

  // Colour ramp by heat: deep, saturated lanes through the class colour to a white-hot core.
  // Tone mapping is off for this material because it would wash every class toward white.
  float peak = max(max(uColor.r, uColor.g), max(uColor.b, 1e-3));
  vec3 base = uColor / peak;
  // Hot stars keep a paler, brighter ramp so blue does not sink toward navy.
  float hot = clamp((uEmission - 1.25) / 0.5, 0.0, 1.0);
  vec3 lane = pow(base, vec3(mix(9.0, 4.0, hot))) * mix(0.32, 0.5, hot);
  vec3 mid = pow(base, vec3(mix(3.5, 1.4, hot))) * 0.85;
  vec3 color = mix(lane, mid, smoothstep(0.25, 0.7, heat));
  color = mix(color, base, smoothstep(0.7, 1.05, heat));
  float whiteHot = clamp((uEmission - 1.0) * 0.5, 0.0, 0.45) * smoothstep(0.85, 1.15, heat);
  color = mix(color, vec3(1.0), whiteHot * mu);
  color *= limb * sqrt(peak) * pow(min(uEmission, 1.0), 2.0) * mix(0.85, 1.12, smoothstep(0.6, 1.1, heat));
  // Cool, reddened limb, as in real photospheres.
  color *= mix(vec3(1.0, 0.72, 0.5), vec3(1.0), smoothstep(0.0, 0.55, mu));
  color += mix(uColor, vec3(1.0), 0.6) * flare;
  color = mix(color, uHighlightColor * max(uEmission, 1.0), uHighlightAmount);
  gl_FragColor = vec4(max(color, vec3(0.0)), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
