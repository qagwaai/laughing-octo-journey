import { CYGNUS_X1_SPLASH_PRESENTATION } from '../../model/black-hole/cygnus-x1';
import { BLACK_HOLE_TRACE_STEP_FRACTION } from '../../model/black-hole/schwarzschild';

export const BLACK_HOLE_VERTEX_SHADER = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const BLACK_HOLE_FRAGMENT_SHADER = `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform vec3 uOrigin;
uniform vec3 uRight;
uniform vec3 uUp;
const float INNER = ${CYGNUS_X1_SPLASH_PRESENTATION.diskInnerRadiusRs.toFixed(1)};
const float OUTER = ${CYGNUS_X1_SPLASH_PRESENTATION.diskOuterRadiusRs.toFixed(1)};

float hash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
}
float noise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash(i), hash(i+vec3(1,0,0)), f.x),
                 mix(hash(i+vec3(0,1,0)), hash(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash(i+vec3(0,0,1)), hash(i+vec3(1,0,1)), f.x),
                 mix(hash(i+vec3(0,1,1)), hash(i+vec3(1,1,1)), f.x), f.y), f.z);
}
vec3 sky(vec3 d) {
  vec3 color = vec3(0.001214, 0.002732, 0.006995);
  vec3 cell = d * 480.0;
  float star = smoothstep(0.997, 1.0, hash(floor(cell)));
  vec3 offset = fract(cell) - 0.5;
  color += vec3(0.45, 0.57, 0.7) * star * exp(-dot(offset, offset) * 38.0);
  return color;
}
vec3 disk(vec3 p, vec3 direction) {
  float r = length(p.xz);
  float angle = atan(p.z, p.x);
  float orbit = uTime * 0.65 / pow(r / INNER, 1.5);
  vec3 flow = vec3(cos(angle-orbit), sin(angle-orbit), r * 0.75);
  float turbulence = noise(flow * vec3(8.0, 8.0, 3.0));
  turbulence += 0.5 * noise(flow * vec3(21.0, 21.0, 7.0));
  float filament = noise(flow * vec3(32.0, 32.0, 12.0) + turbulence);
  float heat = pow(INNER / r, 1.65);
  float edge = smoothstep(INNER, INNER + 0.35, r) * (1.0-smoothstep(OUTER-1.4, OUTER, r));
  vec3 velocity = normalize(vec3(-p.z, 0.0, p.x));
  float beta = sqrt(0.5 / max(r-1.0, 1.0));
  float doppler = sqrt(1.0-beta*beta) / (1.0-beta*dot(velocity, -normalize(direction)));
  float shift = sqrt(max(0.0, 1.0-1.0/r)) * doppler;
  vec3 tint = mix(vec3(0.65, 0.13, 0.025), vec3(1.0, 0.79, 0.48), heat);
  tint = mix(tint, vec3(1.0, 0.94, 0.81), pow(heat, 3.0));
  return tint * edge * heat * (2.0 + turbulence * 2.0 + filament) * pow(shift, 3.0);
}
vec3 acceleration(vec3 p, float l2) {
  float r2 = dot(p,p);
  return -1.5 * l2 * p / (r2 * r2 * sqrt(r2));
}
void main() {
  vec2 image = (vUv-0.5) * vec2(${CYGNUS_X1_SPLASH_PRESENTATION.imageWidthRs.toFixed(1)}, ${CYGNUS_X1_SPLASH_PRESENTATION.imageHeightRs.toFixed(1)});
  vec3 p = uOrigin;
  vec3 v = normalize(-p + uRight * image.x + uUp * image.y);
  vec3 momentum = cross(p,v);
  float l2 = dot(momentum, momentum);
  vec3 color = vec3(0.0);
  float transmission = 1.0;
  float escaped = 0.0;
  for (int i = 0; i < TRACE_STEPS; i++) {
    float r = length(p);
    if (r < 1.0) { break; }
    if (r > 36.0 && dot(p,v)>0.0) {
      escaped = 1.0;
      #if PROCEDURAL_SKY
      color += transmission * sky(normalize(v));
      #endif
      break;
    }
    float dt = min(1.2, r * ${BLACK_HOLE_TRACE_STEP_FRACTION});
    vec3 a = acceleration(p,l2);
    vec3 next = p + v * dt + 0.5 * a * dt * dt;
    if (p.y * next.y < 0.0) {
      vec3 hit = mix(p, next, p.y / (p.y-next.y));
      float radius = length(hit.xz);
      if (radius > INNER && radius < OUTER) {
        color += transmission * disk(hit,v);
        transmission *= 0.08;
      }
    }
    v += 0.5 * (a + acceleration(next,l2)) * dt;
    p = next;
  }
  // Unresolved near-critical rays never receive a fictitious background escape.
  color = color / (1.0 + color);
  vec2 border = smoothstep(vec2(0.0), vec2(0.06), vUv) *
                smoothstep(vec2(0.0), vec2(0.06), 1.0-vUv);
  #if PROCEDURAL_SKY
    gl_FragColor = vec4(color, border.x * border.y);
  #else
    float opacity = 1.0 - escaped * transmission;
    // Store straight alpha; the host scene performs the only compositing blend.
    gl_FragColor = vec4(color / max(opacity, 0.0001), opacity * border.x * border.y);
  #endif
}
`;
