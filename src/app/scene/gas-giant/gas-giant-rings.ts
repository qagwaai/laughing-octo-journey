import {
  ClampToEdgeWrapping,
  Color,
  DataTexture,
  DoubleSide,
  LinearFilter,
  NormalBlending,
  RGBAFormat,
  RingGeometry,
  SRGBColorSpace,
  ShaderMaterial,
  UnsignedByteType,
} from 'three';
import type { GasGiantRingProfile } from '../../model/planet/gas-giant-profile';
import { createSeededRng } from '../../model/planet/planet-seed';
import { GAS_GIANT_PLANET_SHADOW_GLSL, type GasGiantShadowUniforms } from './gas-giant-shadow-glsl';

export const GAS_GIANT_RING_SAMPLES = 512;

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Smooth 1D value noise over `cells` lattice points. */
function valueNoise1d(random: () => number, cells: number): (t: number) => number {
  const lattice = Array.from({ length: cells + 1 }, () => random());
  return (t: number) => {
    const x = Math.max(0, Math.min(1, t)) * cells;
    const index = Math.min(cells - 1, Math.floor(x));
    const f = x - index;
    const s = f * f * (3 - 2 * f);
    return lattice[index] + (lattice[index + 1] - lattice[index]) * s;
  };
}

/**
 * Radial ring density in [0, 1] for each sample from inner (0) to outer (1)
 * edge: layered ringlets, seeded gaps, and soft edges.
 */
export function computeRingDensity(ring: GasGiantRingProfile, samples = GAS_GIANT_RING_SAMPLES): Float32Array {
  const random = createSeededRng(ring.seed);
  const broad = valueNoise1d(random, 6);
  const ringlets = valueNoise1d(random, 48);
  const fine = valueNoise1d(random, 180);
  const density = new Float32Array(samples);
  for (let index = 0; index < samples; index++) {
    const t = (index + 0.5) / samples;
    let value =
      ring.style === 'narrow'
        ? 0.35 + 0.65 * Math.pow(ringlets(t), 2.2)
        : 0.25 + 0.45 * broad(t) + 0.2 * ringlets(t) + 0.1 * fine(t);
    if (ring.style === 'broad') value *= 0.55 + 0.45 * smoothstep(0, 0.35, t);
    for (const gap of ring.gaps) {
      const half = gap.width / 2;
      value *= smoothstep(half * 0.6, half * 1.2, Math.abs(t - gap.center));
    }
    value *= smoothstep(0, 0.03, t) * smoothstep(0, 0.04, 1 - t);
    density[index] = Math.max(0, Math.min(1, value));
  }
  return density;
}

/** 512x1 radial texture; alpha carries the ring's optical depth, rgb its tint. */
export function createGasGiantRingTexture(ring: GasGiantRingProfile): DataTexture {
  const density = computeRingDensity(ring);
  const data = new Uint8Array(density.length * 4);
  for (let index = 0; index < density.length; index++) {
    const shade = 0.75 + 0.35 * density[index];
    const offset = index * 4;
    data[offset] = Math.round(Math.min(1, ring.color[0] * shade) * 255);
    data[offset + 1] = Math.round(Math.min(1, ring.color[1] * shade) * 255);
    data[offset + 2] = Math.round(Math.min(1, ring.color[2] * shade) * 255);
    data[offset + 3] = Math.round(density[index] * ring.opacity * 255);
  }
  const texture = new DataTexture(data, density.length, 1, RGBAFormat, UnsignedByteType);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Ring annulus in the XY plane; rotate -PI/2 about X to lie in the equator. */
export function createGasGiantRingGeometry(ring: GasGiantRingProfile, planetRadius: number): RingGeometry {
  return new RingGeometry(ring.innerRadius * planetRadius, ring.outerRadius * planetRadius, 192, 1);
}

export interface GasGiantRingMaterialHandle {
  material: ShaderMaterial;
  uniforms: {
    ringLightColor: { value: Color };
    ringHighlight: { value: number };
  };
}

export function createGasGiantRingMaterial(shadows: GasGiantShadowUniforms): GasGiantRingMaterialHandle {
  const uniforms = {
    ringLightColor: { value: new Color(1, 1, 1) },
    ringHighlight: { value: 0 },
  };
  const material = new ShaderMaterial({
    uniforms: { ...shadows, ...uniforms },
    vertexShader: RING_VERTEX_GLSL,
    fragmentShader: RING_FRAGMENT_GLSL,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    blending: NormalBlending,
  });
  return { material, uniforms };
}

const RING_VERTEX_GLSL = `
varying vec3 vRingWorldPosition;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vRingWorldPosition = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const RING_FRAGMENT_GLSL = `
uniform vec3 ggLightDirection;
uniform vec3 ggPlanetCenter;
uniform float ggPlanetRadius;
uniform vec3 ggRingNormal;
uniform float ggRingInner;
uniform float ggRingOuter;
uniform sampler2D ggRingMap;
uniform vec3 ringLightColor;
uniform float ringHighlight;
varying vec3 vRingWorldPosition;
${GAS_GIANT_PLANET_SHADOW_GLSL}

void main() {
  float r = length(vRingWorldPosition - ggPlanetCenter);
  float t = (r - ggRingInner) / max(ggRingOuter - ggRingInner, 1e-5);
  if (t < 0.0 || t > 1.0) discard;
  vec4 ring = texture2D(ggRingMap, vec2(t, 0.5));
  if (ring.a < 0.004) discard;
  vec3 toCamera = normalize(cameraPosition - vRingWorldPosition);
  float lightSide = dot(ggRingNormal, ggLightDirection);
  float viewSide = dot(ggRingNormal, toCamera);
  // The unlit face only shows light scattered through the ring, more so where it is thin.
  float transmitted = lightSide * viewSide >= 0.0 ? 1.0 : mix(0.55, 0.12, ring.a);
  float incidence = 0.35 + 0.65 * abs(lightSide);
  float lit = ggPlanetShadow(vRingWorldPosition) * transmitted * incidence;
  vec3 color = ring.rgb * ringLightColor * (0.08 + lit) + ringHighlight * vec3(0.08, 0.1, 0.12);
  gl_FragColor = vec4(color, ring.a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
