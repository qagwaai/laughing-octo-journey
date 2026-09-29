import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createMiningBackdrop, disposeMiningObject } from './mining-splash-composition';
import { selectMiningQuality } from './mining-splash-state';
import { SPLASH_PLANET_CPU_PRESET, SPLASH_PLANET_PRESETS, selectSplashPlanetPreset } from './planet/splash-planet';

describe('Mining splash asset policy', () => {
  it('uses standard quality only on sufficiently wide, capable devices', () => {
    expect(selectMiningQuality(1440, 8, false)).toBe('standard');
    expect(selectMiningQuality(390, 8, false)).toBe('low');
    expect(selectMiningQuality(1440, 4, false)).toBe('low');
    expect(selectMiningQuality(1440, 8, true)).toBe('low');
  });

  it('disposes shared geometry, materials and maps once per owned tree', () => {
    const root = new Group();
    const geometry = new BoxGeometry();
    const texture = new Texture();
    const material = new MeshStandardMaterial({ map: texture });
    root.add(new Mesh(geometry, material), new Mesh(geometry, material));
    const geometrySpy = vi.spyOn(geometry, 'dispose');
    const materialSpy = vi.spyOn(material, 'dispose');
    const textureSpy = vi.spyOn(texture, 'dispose');
    disposeMiningObject(root);
    expect(geometrySpy).toHaveBeenCalledTimes(1);
    expect(materialSpy).toHaveBeenCalledTimes(1);
    expect(textureSpy).toHaveBeenCalledTimes(1);
  });

  it.each(['standard', 'low'] as const)('creates a deterministic, bounded %s backdrop', (quality) => {
    const firstMap = new Texture();
    const first = createMiningBackdrop(quality, firstMap);
    const second = createMiningBackdrop(quality, new Texture());
    const meshes = first.children.filter((object) => object instanceof Mesh);
    expect(meshes).toHaveLength(2);
    const planet = meshes.find((mesh) => mesh.geometry.type === 'SphereGeometry');
    expect(planet?.material).toBeInstanceOf(MeshStandardMaterial);
    expect((planet?.material as MeshStandardMaterial).map).toBe(firstMap);
    expect(first.children.map((object) => object.position.toArray())).toEqual(
      second.children.map((object) => object.position.toArray()),
    );
    expect(first.children).toHaveLength(7);
    disposeMiningObject(first);
    disposeMiningObject(second);
  });

  it('applies the baked normal map when one was generated', () => {
    const albedo = new Texture();
    const normal = new Texture();
    const withNormal = createMiningBackdrop('standard', albedo, normal);
    const withoutNormal = createMiningBackdrop('low', albedo, undefined);
    const materialOf = (group: Group) =>
      group.children.find(
        (object): object is Mesh => object instanceof Mesh && object.geometry.type === 'SphereGeometry',
      )?.material as MeshStandardMaterial;

    expect(materialOf(withNormal).normalMap).toBe(normal);
    expect(materialOf(withoutNormal).normalMap).toBeNull();
    disposeMiningObject(withNormal);
    disposeMiningObject(withoutNormal);
  });

  it('drives roughness and metalness from the baked material map', () => {
    // Without this the splash planet kept roughness 1 / metalness 0 and the
    // oceans rendered as matte as the continents.
    const albedo = new Texture();
    const material = new Texture();
    const withMaterial = createMiningBackdrop('standard', albedo, null, material);
    const withoutMaterial = createMiningBackdrop('low', albedo, null, undefined);
    const materialOf = (group: Group) =>
      group.children.find(
        (object): object is Mesh => object instanceof Mesh && object.geometry.type === 'SphereGeometry',
      )?.material as MeshStandardMaterial;

    expect(materialOf(withMaterial).roughnessMap).toBe(material);
    expect(materialOf(withMaterial).metalnessMap).toBe(material);
    expect(materialOf(withMaterial).metalness).toBe(1);
    expect(materialOf(withoutMaterial).roughnessMap).toBeNull();
    expect(materialOf(withoutMaterial).metalness).toBe(0);
    disposeMiningObject(withMaterial);
    disposeMiningObject(withoutMaterial);
  });

  it('generates the splash planet instead of fetching a third-party image', () => {
    expect(selectSplashPlanetPreset('standard', null)).toBe(SPLASH_PLANET_CPU_PRESET);
    expect(SPLASH_PLANET_PRESETS.standard.width).toBe(2048);
    expect(SPLASH_PLANET_PRESETS.standard.includeNormal).toBe(true);
    expect(SPLASH_PLANET_PRESETS.low.width).toBe(1024);
  });

  it('keeps the renderer-less bake cheap enough to stay off the main thread budget', () => {
    expect(SPLASH_PLANET_CPU_PRESET.width * SPLASH_PLANET_CPU_PRESET.height).toBeLessThan(
      SPLASH_PLANET_PRESETS.low.width * SPLASH_PLANET_PRESETS.low.height,
    );
    expect(SPLASH_PLANET_CPU_PRESET.includeNormal).toBe(false);
  });
});
