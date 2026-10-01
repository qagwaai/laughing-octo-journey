import {
  BufferAttribute,
  BufferGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  Material,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Points,
  PointsMaterial,
  Quaternion,
  SphereGeometry,
  Texture,
  Vector3,
} from 'three';
import type { MiningQuality } from './mining-splash-state';

export function disposeMiningObject(root: Object3D): void {
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  root.traverse((object) => {
    if (!(object instanceof Mesh || object instanceof Points)) return;
    geometries.add(object.geometry);
    const values = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of values) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
    }
    if (object instanceof InstancedMesh) object.dispose();
  });
  textures.forEach((texture) => {
    const image: unknown = texture.source.data;
    if (typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) image.close();
    texture.dispose();
  });
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}

export function createMiningBackdrop(
  quality: MiningQuality,
  albedo: Texture,
  normalMap?: Texture | null,
  materialMap?: Texture | null,
  cloudLayer?: Mesh,
): Group {
  const group = new Group();
  const fill = new HemisphereLight('#9cbbe7', '#211208', 2.5);
  group.add(fill);
  for (const [position, color, intensity] of [
    [new Vector3(3, 4, 4), '#e0edff', 4],
    [new Vector3(-3, 1, 2), '#ffb16a', 2],
    [new Vector3(1, 2, -3), '#5c9dff', 4],
  ] as const) {
    const light = new DirectionalLight(color, intensity);
    light.position.copy(position);
    group.add(light);
  }
  let seed = 1729;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const stars = new Float32Array(750 * 3);
  for (let i = 0; i < stars.length; i += 3) {
    stars[i] = (random() - 0.5) * 65;
    stars[i + 1] = (random() - 0.5) * 55;
    stars[i + 2] = -10 - random() * 20;
  }
  const starGeometry = new BufferGeometry();
  starGeometry.setAttribute('position', new BufferAttribute(stars, 3));
  group.add(new Points(starGeometry, new PointsMaterial({ color: '#c8dcff', size: 0.045, sizeAttenuation: true })));
  const count = quality === 'standard' ? 85 : 35;
  const rockGeometry = new IcosahedronGeometry(1, 1);
  const positions = rockGeometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      y = positions.getY(i),
      z = positions.getZ(i);
    const factor = 1 + 0.16 * Math.sin(x * 19 + y * 27 + z * 13);
    positions.setXYZ(i, x * factor, y * factor, z * factor);
  }
  rockGeometry.computeVertexNormals();
  const rocks = new InstancedMesh(
    rockGeometry,
    new MeshStandardMaterial({ color: '#373336', roughness: 0.95, flatShading: true }),
    count,
  );
  const matrix = new Matrix4();
  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 2.5 + random() * 7;
    const size = 0.03 + random() * 0.2;
    matrix.compose(
      new Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.65, -2 - random() * 6),
      new Quaternion().setFromAxisAngle(new Vector3(1, 1, 0).normalize(), angle),
      new Vector3(size, size * 0.75, size * 1.2),
    );
    rocks.setMatrixAt(i, matrix);
  }
  group.add(rocks);
  const planet = new Mesh(
    new SphereGeometry(4, 48, 32),
    // Roughness and metalness multiply their maps, so both scalars go to 1 when
    // a material map is present and let the texture drive water versus land.
    new MeshStandardMaterial({
      map: albedo,
      normalMap: normalMap ?? null,
      roughnessMap: materialMap ?? null,
      metalnessMap: materialMap ?? null,
      roughness: 1,
      metalness: materialMap ? 1 : 0,
    }),
  );
  planet.position.set(-2.8, -0.8, -6);
  planet.rotation.z = -0.3;
  if (cloudLayer) planet.add(cloudLayer);
  group.add(planet);
  return group;
}
