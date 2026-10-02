/**
 * Shared GLSL for the rotating swirl storm used by terran cloud layers and gas
 * giant atmospheres. Each storm is a vec4 of (u, v, uv radius, direction).
 */
export const SWIRL_STORM_GLSL = `
vec4 swirlStormSample(sampler2D swirlTexture, vec2 uv, vec4 storm, vec4 baseColor, float swirlTime, float activity, float contrast) {
  storm.z *= activity;
  if (storm.z <= 0.0) return baseColor;
  vec2 offset = vec2(fract(uv.x - storm.x + 0.5) - 0.5, uv.y - storm.y);
  float latitudeScale = cos((storm.y - 0.5) * 3.14159265);
  offset.x *= latitudeScale;
  float distanceToStorm = length(offset);
  if (distanceToStorm >= storm.z) return baseColor;
  float angle = (swirlTime + 2.2 * (1.0 - distanceToStorm / storm.z)) * storm.w;
  float c = cos(angle);
  float s = sin(angle);
  vec2 spun = mat2(c, s, -s, c) * offset;
  vec2 sampleUv = vec2(fract(storm.x + spun.x / latitudeScale), clamp(storm.y + spun.y, 0.0, 1.0));
  float influence = 1.0 - smoothstep(storm.z * 0.75, storm.z, distanceToStorm);
  vec4 color = mix(baseColor, texture2D(swirlTexture, sampleUv), influence);
  float arm = 0.5 + 0.5 * sin(3.0 * atan(spun.y, spun.x) + 14.0 * distanceToStorm / storm.z);
  color.rgb *= 1.0 - contrast * arm * influence;
  return color;
}
`;
