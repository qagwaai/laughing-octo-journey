import { DataTexture } from 'three';
import { describe, expect, it } from 'vitest';
import { createCloudStorms, createPlanetCloudStormMaterial, stormRadiusScale } from './planet-cloud-storms';
import { DEFAULT_STORM_ACTIVITY } from './planet-clouds';

describe('local cloud storms', () => {
  it.each(['thin', 'thick'] as const)(
    'places repeatable %s storms away from the poles and from each other',
    (style) => {
      const first = createCloudStorms('world-a', style).map(({ center }) => center.toArray());
      const repeated = createCloudStorms('world-a', style).map(({ center }) => center.toArray());
      const other = createCloudStorms('world-b', style).map(({ center }) => center.toArray());
      expect(first).toEqual(repeated);
      expect(first).not.toEqual(other);
      for (const [u, v, radius] of first) {
        expect(u).toBeGreaterThanOrEqual(0);
        expect(u).toBeLessThan(1);
        expect(v).toBeGreaterThan(0.39);
        expect(v).toBeLessThan(0.73);
        expect(radius).toBe(style === 'thin' ? 0.095 : 0.17);
      }
      expect(Math.abs(first[0][0] - first[1][0])).toBeGreaterThan(0.3);
      expect(first[0][3]).toBe(1);
      expect(first[1][3]).toBe(-1);
    },
  );

  it('animates a shared material uniform rather than regenerating the cloud texture or adding meshes', () => {
    const texture = new DataTexture();
    const layer = createPlanetCloudStormMaterial('world-a', 'thick', texture);
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      fragmentShader: '#include <map_pars_fragment>\nvoid main() { #include <map_fragment> }',
    };
    layer.material.onBeforeCompile(shader as Parameters<typeof layer.material.onBeforeCompile>[0], {} as never);
    expect(shader.fragmentShader).toContain('cloudStormSample(vMapUv, cloudStormA');
    expect(shader.fragmentShader).toContain('cloudStormSample(vMapUv, cloudStormB');
    expect(shader.fragmentShader).toContain('smoothstep(storm.z * 0.75, storm.z, distanceToStorm)');
    expect(shader.fragmentShader).toContain('2.2 * (1.0 - distanceToStorm / storm.z)');
    expect(shader.fragmentShader).toContain('cloudStormContrast * arm * influence');
    expect(shader.uniforms['cloudStormContrast'].value).toBe(0.2);
    expect(shader.uniforms['cloudStormTime'].value).toBe(0);
    layer.advance(1);
    expect(shader.uniforms['cloudStormTime'].value).toBeGreaterThan(0);
    expect(layer.material.map).toBe(texture);
    layer.material.dispose();
    texture.dispose();
  });

  it('scales storm size from activity through a uniform without recompiling', () => {
    expect(stormRadiusScale(0)).toBe(0);
    expect(stormRadiusScale(80)).toBeCloseTo(1);
    expect(stormRadiusScale(100)).toBe(1.25);
    expect(stormRadiusScale(150)).toBe(1.25);
    expect(stormRadiusScale(-5)).toBe(0);

    const texture = new DataTexture();
    const layer = createPlanetCloudStormMaterial('world-a', 'thin', texture);
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      fragmentShader: '#include <map_pars_fragment>\nvoid main() { #include <map_fragment> }',
    };
    layer.material.onBeforeCompile(shader as Parameters<typeof layer.material.onBeforeCompile>[0], {} as never);
    expect(shader.fragmentShader).toContain('storm.z *= cloudStormActivity');
    expect(shader.fragmentShader).toContain('if (storm.z <= 0.0) return baseColor');
    expect(shader.uniforms['cloudStormActivity'].value).toBeCloseTo(stormRadiusScale(DEFAULT_STORM_ACTIVITY));
    const version = layer.material.version;
    layer.setActivity(0);
    expect(shader.uniforms['cloudStormActivity'].value).toBe(0);
    layer.setActivity(100);
    expect(shader.uniforms['cloudStormActivity'].value).toBe(1.25);
    expect(layer.material.version).toBe(version);
    layer.material.dispose();
    texture.dispose();
  });
});
