import {
  BoxGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  SphereGeometry,
  Texture,
  Vector3,
} from 'three';
import { describe, expect, it, vi } from 'vitest';
import { SPLASH_GAS_GIANT_RADIUS } from './gas-giant/splash-gas-giant';
import {
  createMiningBackdrop,
  createMiningBackdropAround,
  disposeMiningObject,
  MINING_BODY_DISTANCE_SCALE,
  MINING_BODY_EXCLUSION_RADIUS,
  MINING_CAMERA_DIRECTION,
  MINING_DEBRIS_CLEARANCE,
  MINING_PLANET_POSITION,
  placeMiningCelestialBody,
} from './mining-splash-composition';
import { selectMiningQuality } from './mining-splash-state';
import { selectSplashPlanetPreset, SPLASH_PLANET_CPU_PRESET, SPLASH_PLANET_PRESETS } from './planet/splash-planet';
import { SPLASH_STAR_RADIUS } from './star/splash-star';

describe('Mining splash asset policy', () => {
  it('uses standard quality only on sufficiently wide, capable devices', () => {
    expect(selectMiningQuality(1440, 8, false)).toBe('standard');
    expect(selectMiningQuality(390, 8, false)).toBe('low');
    expect(selectMiningQuality(1440, 4, false)).toBe('low');
    expect(selectMiningQuality(1440, 8, true)).toBe('low');
  });

  describe.each(['standard', 'low'] as const)('%s foreground separation', (quality) => {
    it.each([1.75, 3.3, 6, 12])('preserves framing and puts all debris in front at camera distance %s', (distance) => {
      const camera = new PerspectiveCamera(75, 0.75, 0.1, 1000);
      camera.position.copy(MINING_CAMERA_DIRECTION).multiplyScalar(distance);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      const body = new Mesh(new SphereGeometry(4), new MeshStandardMaterial());
      const backdrop = createMiningBackdropAround(quality, body);
      const rocks = backdrop.children.find((object): object is InstancedMesh => object instanceof InstancedMesh)!;
      const originalMatrices = Array.from(rocks.instanceMatrix.array);
      const surfacePoints = [
        new Vector3(0, 0, 0),
        new Vector3(4, 0, 0),
        new Vector3(-4, 0, 0),
        new Vector3(0, 4, 0),
        new Vector3(0, 0, 4),
      ];
      body.updateMatrixWorld();
      const projections = surfacePoints.map((point) => point.clone().applyMatrix4(body.matrixWorld).project(camera));
      placeMiningCelestialBody(body, camera.position);
      body.updateMatrixWorld();
      surfacePoints.forEach((point, index) => {
        const projected = point.clone().applyMatrix4(body.matrixWorld).project(camera);
        expect(projected.x).toBeCloseTo(projections[index].x, 10);
        expect(projected.y).toBeCloseTo(projections[index].y, 10);
      });
      const nearestBodyDepth =
        body.position.dot(MINING_CAMERA_DIRECTION) + MINING_BODY_EXCLUSION_RADIUS * MINING_BODY_DISTANCE_SCALE;
      const matrix = new Matrix4();
      const center = new Vector3();
      const scale = new Vector3();
      for (let i = 0; i < rocks.count; i++) {
        rocks.getMatrixAt(i, matrix);
        center.setFromMatrixPosition(matrix);
        scale.setFromMatrixScale(matrix);
        const asteroidRadius = rocks.geometry.boundingSphere!.radius * Math.max(scale.x, scale.y, scale.z);
        expect(center.dot(MINING_CAMERA_DIRECTION) - asteroidRadius - nearestBodyDepth).toBeGreaterThan(
          MINING_DEBRIS_CLEARANCE,
        );
        expect(center.distanceTo(body.position) - asteroidRadius).toBeGreaterThan(
          MINING_BODY_EXCLUSION_RADIUS * MINING_BODY_DISTANCE_SCALE + MINING_DEBRIS_CLEARANCE,
        );
      }
      expect(Array.from(rocks.instanceMatrix.array)).toEqual(originalMatrices);
      // Reframing must be absolute, not compound the body's scale on resize.
      placeMiningCelestialBody(body, camera.position);
      expect(body.scale.toArray()).toEqual([4, 4, 4]);
      disposeMiningObject(backdrop);
    });
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
    const firstRocks = first.children.find((object): object is InstancedMesh => object instanceof InstancedMesh)!;
    const secondRocks = second.children.find((object): object is InstancedMesh => object instanceof InstancedMesh)!;
    expect(firstRocks.count).toBe(quality === 'standard' ? 85 : 35);
    expect(Array.from(firstRocks.instanceMatrix.array)).toEqual(Array.from(secondRocks.instanceMatrix.array));
    disposeMiningObject(first);
    disposeMiningObject(second);
  });

  describe.each(['standard', 'low'] as const)('%s debris clearance', (quality) => {
    it.each([
      ['terran cloud shell', 4 * 1.012],
      ['gas giant', SPLASH_GAS_GIANT_RADIUS],
      ['star', SPLASH_STAR_RADIUS],
    ] as const)('keeps every complete asteroid outside the %s', (_name, bodyRadius) => {
      const body = new Group();
      body.add(new Mesh(new SphereGeometry(bodyRadius), new MeshStandardMaterial()));
      const backdrop = createMiningBackdropAround(quality, body);
      const rocks = backdrop.children.find((object): object is InstancedMesh => object instanceof InstancedMesh)!;
      expect(body.position.toArray()).toEqual(MINING_PLANET_POSITION.toArray());
      expect(MINING_BODY_EXCLUSION_RADIUS).toBeGreaterThanOrEqual(bodyRadius);
      const matrix = new Matrix4();
      const center = new Vector3();
      const scale = new Vector3();
      const vertex = new Vector3();
      const positions = rocks.geometry.getAttribute('position');
      for (let i = 0; i < rocks.count; i++) {
        rocks.getMatrixAt(i, matrix);
        center.setFromMatrixPosition(matrix);
        scale.setFromMatrixScale(matrix);
        const asteroidRadius = rocks.geometry.boundingSphere!.radius * Math.max(scale.x, scale.y, scale.z);
        // Instance transforms are stored as float32, so allow only rounding error.
        expect(center.distanceTo(body.position) - asteroidRadius).toBeGreaterThanOrEqual(
          MINING_BODY_EXCLUSION_RADIUS + MINING_DEBRIS_CLEARANCE - 1e-6,
        );
        for (let j = 0; j < positions.count; j++) {
          vertex.fromBufferAttribute(positions, j).applyMatrix4(matrix);
          expect(vertex.distanceTo(body.position)).toBeGreaterThanOrEqual(bodyRadius + MINING_DEBRIS_CLEARANCE - 1e-6);
        }
      }
      disposeMiningObject(backdrop);
    });
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
