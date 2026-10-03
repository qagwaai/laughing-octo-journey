/**
 * GLSL noise shared by the star photosphere, corona and prominences.
 *
 * Sampled on the unit sphere in the star's local frame, so there is no UV seam
 * and no pole pinching. Hash-based to avoid texture lookups.
 */
export const STAR_NOISE_GLSL = `
float starHash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

vec3 starHash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

float starValueNoise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  float n000 = starHash13(i);
  float n100 = starHash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = starHash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = starHash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = starHash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = starHash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = starHash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = starHash13(i + vec3(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, u.x), mix(n010, n110, u.x), u.y),
    mix(mix(n001, n101, u.x), mix(n011, n111, u.x), u.y),
    u.z
  );
}

float starFbm(vec3 p) {
  float sum = 0.0;
  float amplitude = 0.5;
  for (int octave = 0; octave < 4; octave++) {
    sum += amplitude * starValueNoise(p);
    p = p * 2.03 + 17.1;
    amplitude *= 0.5;
  }
  return sum;
}

// Animated Worley noise: x is the distance to the nearest feature point, y to the second nearest.
vec2 starWorley(vec3 p, float time) {
  vec3 cell = floor(p);
  vec3 local = fract(p);
  float f1 = 8.0;
  float f2 = 8.0;
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      for (int z = -1; z <= 1; z++) {
        vec3 offset = vec3(float(x), float(y), float(z));
        vec3 jitter = starHash33(cell + offset);
        vec3 point = offset + 0.5 + 0.42 * sin(time * (0.35 + jitter * 0.4) + 6.2831 * jitter);
        float pointDistance = length(point - local);
        if (pointDistance < f1) {
          f2 = f1;
          f1 = pointDistance;
        } else if (pointDistance < f2) {
          f2 = pointDistance;
        }
      }
    }
  }
  return vec2(f1, f2);
}
`;
