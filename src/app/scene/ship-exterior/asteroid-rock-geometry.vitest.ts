import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildDeterministicRockGeometry, resolveAsteroidGeometryDescriptor } from './asteroid-rock-geometry';

describe('asteroid rock geometry', () => {
  it('keeps preview geometry low detail and switches to rock geometry after scanning', () => {
    const profile = 'v1|pv=dodecahedron:0|rv=rock:2|s=1.00,1.10,0.95';
    expect(resolveAsteroidGeometryDescriptor(profile, false, 0)).toEqual({
      geometry: 'preview',
      detail: 0,
      scale: [1, 1.1, 0.95],
    });
    expect(resolveAsteroidGeometryDescriptor(profile, true, 0)).toEqual({
      geometry: 'rock',
      detail: 2,
      scale: [1, 1.1, 0.95],
    });
  });

  it('generates deterministic but displaced geometry from the profile identity', () => {
    const first = buildDeterministicRockGeometry(1, 2, 'profile-a');
    const second = buildDeterministicRockGeometry(1, 2, 'profile-a');
    const different = buildDeterministicRockGeometry(1, 2, 'profile-b');

    expect(Array.from(first.getAttribute('position').array)).toEqual(Array.from(second.getAttribute('position').array));
    expect(Array.from(first.getAttribute('position').array)).not.toEqual(
      Array.from(different.getAttribute('position').array),
    );
    expect(first).toBeInstanceOf(THREE.BufferGeometry);
    first.dispose();
    second.dispose();
    different.dispose();
  });
});
