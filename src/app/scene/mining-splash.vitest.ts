import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { EARTH_ALBEDO_URL } from '../component/earth-textures';
import { createMiningBackdrop, disposeMiningObject } from './mining-splash-composition';
import { selectMiningQuality } from './mining-splash-state';

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

  it('reuses the image source used by the existing Earth component', () => {
    expect(EARTH_ALBEDO_URL).toMatch(/\/Albedo\.jpg$/);
  });
});
