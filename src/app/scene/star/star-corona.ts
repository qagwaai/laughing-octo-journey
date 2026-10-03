/**
 * Corona for procedural stars: an additive, camera-facing glow.
 *
 * The quad is billboarded in the vertex shader, so it faces the camera from
 * every angle without per-frame CPU work. It sits at the star's centre, which
 * lets the opaque photosphere hide the inner disk. Brightness falls off with
 * distance, carries slow noise streamers (stellar wind for Wolf-Rayet stars)
 * and breathes with a gentle pulse.
 */
import { AdditiveBlending, Color, Mesh, PlaneGeometry, ShaderMaterial, Vector3 } from 'three';
import type { StarProfile } from '../../model/star/star-profile';
import { linearStarColor } from './star-photosphere-material';
import { STAR_NOISE_GLSL } from './star-noise-glsl';

export interface StarCoronaUniforms {
  uTime: { value: number };
  uColor: { value: Color };
  uRadius: { value: number };
  uCoronaScale: { value: number };
  uIntensity: { value: number };
  uStreamerStrength: { value: number };
  uNoiseOffset: { value: Vector3 };
}

export interface StarCoronaHandle {
  mesh: Mesh<PlaneGeometry, ShaderMaterial>;
  uniforms: StarCoronaUniforms;
  dispose(): void;
}

/** Slightly whiter than the photosphere, as the hot corona is. */
export function coronaColor(profile: StarProfile): Color {
  return linearStarColor(profile.color).lerp(new Color(1, 1, 1), 0.2);
}

export function createStarCorona(profile: StarProfile, radius: number): StarCoronaHandle {
  const uniforms: StarCoronaUniforms = {
    uTime: { value: 0 },
    uColor: { value: coronaColor(profile) },
    uRadius: { value: radius },
    uCoronaScale: { value: Math.max(profile.coronaScale, 1.05) },
    uIntensity: { value: profile.coronaIntensity },
    uStreamerStrength: { value: profile.streamerStrength },
    uNoiseOffset: { value: new Vector3(...profile.noiseOffset) },
  };
  const material = new ShaderMaterial({
    name: 'star-corona',
    uniforms: uniforms as unknown as ShaderMaterial['uniforms'],
    vertexShader: CORONA_VERTEX_GLSL,
    fragmentShader: CORONA_FRAGMENT_GLSL,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
  });
  const geometry = new PlaneGeometry(2, 2);
  const mesh = new Mesh(geometry, material);
  mesh.name = 'star-corona';
  // The billboard is placed in the shader, so CPU bounds and picking would use the wrong plane.
  mesh.frustumCulled = false;
  mesh.raycast = () => undefined;
  mesh.renderOrder = 2;

  return {
    mesh,
    uniforms,
    dispose() {
      geometry.dispose();
      material.dispose();
    },
  };
}

const CORONA_VERTEX_GLSL = `
uniform float uRadius;
uniform float uCoronaScale;
varying vec2 vOffset;
void main() {
  vOffset = position.xy;
  float worldScale = length(modelMatrix[0].xyz);
  vec4 centre = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  centre.xy += position.xy * uRadius * uCoronaScale * worldScale;
  gl_Position = projectionMatrix * centre;
}
`;

const CORONA_FRAGMENT_GLSL = `
uniform float uTime;
uniform vec3 uColor;
uniform float uCoronaScale;
uniform float uIntensity;
uniform float uStreamerStrength;
uniform vec3 uNoiseOffset;
varying vec2 vOffset;
${STAR_NOISE_GLSL}

void main() {
  // Distance from the centre in star radii.
  float d = length(vOffset) * uCoronaScale;
  if (d < 0.98 || d > uCoronaScale) discard;
  float span = max(uCoronaScale - 1.0, 0.05);
  float t = clamp((d - 1.0) / span, 0.0, 1.0);
  float falloff = pow(1.0 - t, 2.4) * 0.8 + 0.25 / (d * d) * (1.0 - t);

  float angle = atan(vOffset.y, vOffset.x);
  vec3 streamerSample = vec3(cos(angle) * 2.2, sin(angle) * 2.2, d * 0.6 - uTime * 0.05) + uNoiseOffset;
  float streamers = starFbm(streamerSample);
  float rays = mix(1.0, 0.35 + 1.4 * streamers * streamers * 2.0, uStreamerStrength);
  float pulse = 1.0 + 0.08 * sin(uTime * 0.7) + 0.04 * sin(uTime * 1.9 + 1.3);

  float glow = falloff * rays * pulse * uIntensity;
  vec3 color = uColor * glow;
  gl_FragColor = vec4(color, glow);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
