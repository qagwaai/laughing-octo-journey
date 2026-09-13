import * as THREE from 'three';
import { resolveAsteroidMeshProfile } from '../../model/catalog/asteroid-mesh-profiles';

export interface AsteroidGeometryDescriptor {
  geometry: 'preview' | 'rock';
  detail: number;
  scale: [number, number, number];
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function random01(seed: number, salt: number): number {
  const mixed = Math.imul(seed ^ salt, 2246822519) >>> 0;
  return mixed / 0xffffffff;
}

export function resolveAsteroidGeometryDescriptor(
  meshProfileKey: string | null | undefined,
  scanned: boolean,
  detail: number,
): AsteroidGeometryDescriptor {
  const profile = resolveAsteroidMeshProfile(meshProfileKey, {
    meshProfileKey: 'fallback',
    geometry: 'icosahedron',
    detail: Math.max(0, Math.min(1, detail)),
    revealGeometry: 'rock',
    revealDetail: 2,
    scale: [1, 1, 1],
  });

  return {
    geometry: scanned ? 'rock' : 'preview',
    detail: scanned ? profile.revealDetail : profile.detail,
    scale: profile.scale,
  };
}

export function buildDeterministicRockGeometry(radius: number, detail: number, seedSource: string): THREE.BufferGeometry {
  const geometry = new THREE.IcosahedronGeometry(radius, Math.max(1, Math.min(2, detail)));
  const position = geometry.getAttribute('position');
  const seed = hashSeed(seedSource);
  const phaseA = random01(seed, 0x1001) * Math.PI * 2;
  const phaseB = random01(seed, 0x1002) * Math.PI * 2;
  const phaseC = random01(seed, 0x1003) * Math.PI * 2;

  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const length = Math.hypot(x, y, z) || 1;
    const nx = x / length;
    const ny = y / length;
    const nz = z / length;
    const macro =
      Math.sin(nx * 2.7 + ny * 0.8 + nz * 0.45 + phaseA) +
      Math.sin(ny * 2.4 + nz * 0.7 + nx * 0.35 + phaseB) +
      Math.sin(nz * 2.9 + nx * 0.6 + ny * 0.3 + phaseC);
    const lobe = Math.pow(Math.max(0, nx), 2.2) * 0.18 - Math.pow(Math.max(0, -ny), 2.1) * 0.12;
    const displacement = Math.max(-0.28, Math.min(0.24, macro * 0.075 + lobe));
    const nextRadius = radius * (1 + displacement);
    position.setXYZ(index, nx * nextRadius, ny * nextRadius, nz * nextRadius);
  }

  geometry.computeVertexNormals();
  return geometry;
}
