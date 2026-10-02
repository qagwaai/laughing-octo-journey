import { Object3D, ShaderMaterial, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { GAS_GIANT_MAX_OVALS, deriveGasGiantProfile } from '../../model/planet/gas-giant-profile';
import { createGasGiant } from './gas-giant';
import { GAS_GIANT_MATERIAL_CACHE_KEY, createGasGiantFlowTexture, gasGiantVortexScale } from './gas-giant-material';
import { computeRingDensity } from './gas-giant-rings';

const SIZE = { width: 32, height: 16 };

function compile(material: { onBeforeCompile: (shader: never, renderer: never) => void }) {
  const shader = {
    uniforms: {} as Record<string, { value: unknown }>,
    vertexShader: '#include <common>\nvoid main() { #include <project_vertex> }',
    fragmentShader:
      '#include <map_pars_fragment>\nvoid main() { #include <map_fragment>\n#include <lights_fragment_end> }',
  };
  material.onBeforeCompile(shader as never, {} as never);
  return shader;
}

describe('createGasGiant', () => {
  it('builds a tilted planet and optional rings', () => {
    const ringed = createGasGiant(deriveGasGiantProfile('factory-a', { rings: true }), { textureSize: SIZE });
    const bare = createGasGiant(deriveGasGiantProfile('factory-a', { rings: false }), { textureSize: SIZE });
    expect(ringed.rings).not.toBeNull();
    expect(bare.rings).toBeNull();
    expect(ringed.planet.parent?.rotation.x).toBeCloseTo(deriveGasGiantProfile('factory-a').axialTilt);
    expect(ringed.rings!.material).toBeInstanceOf(ShaderMaterial);
    ringed.dispose();
    bare.dispose();
  });

  it('injects flow, vortex, swirl and shadow code into the standard material', () => {
    const giant = createGasGiant(deriveGasGiantProfile('factory-b', { rings: true }), { textureSize: SIZE });
    const material = giant.planet.material as unknown as Parameters<typeof compile>[0] & {
      customProgramCacheKey(): string;
    };
    const shader = compile(material);
    expect(material.customProgramCacheKey()).toBe(GAS_GIANT_MATERIAL_CACHE_KEY);
    expect(shader.vertexShader).toContain('vGgWorldPosition = (modelMatrix');
    expect(shader.fragmentShader).toContain('ggAtmosphereColor(vMapUv)');
    expect(shader.fragmentShader).toContain('swirlStormSample(map');
    expect(shader.fragmentShader).toContain(`ggOvalShapes[${GAS_GIANT_MAX_OVALS}]`);
    expect(shader.fragmentShader).toContain('reflectedLight.directDiffuse *= ggShadow');
    expect(shader.uniforms['ggHasRings']).toEqual({ value: 1 });
    giant.dispose();
  });

  it('advances bounded animation state and drifts vortices without recompiling', () => {
    const giant = createGasGiant(deriveGasGiantProfile('factory-c', { palette: 'jovian' }), { textureSize: SIZE });
    const shader = compile(giant.planet.material as never);
    const phase = shader.uniforms['ggFlowPhase'] as { value: number };
    const ovals = shader.uniforms['ggOvalShapes'] as { value: Vector3[] };
    const before = ovals.value.map((value) => value.x);
    for (let index = 0; index < 4000; index++) giant.advance(1 / 30);
    expect(phase.value).toBeGreaterThanOrEqual(0);
    expect(phase.value).toBeLessThan(1);
    for (const value of ovals.value) {
      expect(value.x).toBeGreaterThanOrEqual(0);
      expect(value.x).toBeLessThan(1);
    }
    if (before.length) expect(ovals.value.map((value) => value.x)).not.toEqual(before);
    giant.dispose();
  });

  it('maps storm activity onto vortex and swirl scales', () => {
    expect(gasGiantVortexScale(60)).toBe(1);
    expect(gasGiantVortexScale(0)).toBe(0);
    expect(gasGiantVortexScale(250)).toBeCloseTo(100 / 60);
    const giant = createGasGiant(deriveGasGiantProfile('factory-d'), { textureSize: SIZE });
    const shader = compile(giant.planet.material as never);
    giant.setStormActivity(0);
    expect((shader.uniforms['ggVortexScale'] as { value: number }).value).toBe(0);
    expect((shader.uniforms['ggSwirlActivity'] as { value: number }).value).toBe(0);
    giant.dispose();
  });

  it('feeds world-space light, moon and ring frame data to shadows', () => {
    const giant = createGasGiant(deriveGasGiantProfile('factory-e', { rings: true }), {
      radius: 2,
      textureSize: SIZE,
    });
    const shader = compile(giant.planet.material as never);
    const root = new Object3D();
    root.position.set(5, 0, 0);
    root.scale.setScalar(3);
    root.add(giant.group);
    root.updateMatrixWorld(true);
    giant.setLightDirection(new Vector3(0, 0, 10));
    giant.setMoons([
      { position: new Vector3(1, 2, 3), radius: 0.5 },
      ...Array.from({ length: 6 }, () => ({ position: new Vector3(), radius: 1 })),
    ]);
    giant.planet.onBeforeRender(...([] as unknown as Parameters<typeof giant.planet.onBeforeRender>));
    const value = <T>(name: string) => (shader.uniforms[name] as { value: T }).value;
    expect(value<Vector3>('ggLightDirection').toArray()).toEqual([0, 0, 1]);
    expect(value<Vector3>('ggPlanetCenter').toArray()).toEqual([5, 0, 0]);
    expect(value<number>('ggPlanetRadius')).toBeCloseTo(6);
    expect(value<number>('ggRingOuter')).toBeGreaterThan(value<number>('ggRingInner'));
    expect(value<number>('ggMoonCount')).toBe(4);
    giant.dispose();
  });
});

describe('gas giant lookup textures', () => {
  it('encodes jet speed per latitude', () => {
    const texture = createGasGiantFlowTexture(deriveGasGiantProfile('flow-tex'));
    expect(texture.image.width).toBe(256);
    expect(texture.image.height).toBe(1);
  });

  it('clears ring density inside gaps and at the edges', () => {
    const { rings } = deriveGasGiantProfile('ring-density', { palette: 'saturnian', rings: true });
    const density = computeRingDensity(rings!, 1000);
    expect(density[0]).toBeLessThan(0.1);
    expect(density[999]).toBeLessThan(0.1);
    const gap = rings!.gaps[0];
    expect(density[Math.floor(gap.center * 1000)]).toBeLessThan(0.05);
    expect(Math.max(...density)).toBeGreaterThan(0.4);
  });
});
