import { Group, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { createStationHabitatRotation } from './station-habitat-rotation';

function station() {
  const root = new Group();
  const ring = new Group();
  ring.name = 'HabitatRing';
  ring.position.set(0, 0, -5.1);
  ring.rotation.x = Math.PI / 2;
  const core = new Group();
  root.add(ring, core);
  const advance = createStationHabitatRotation(root);
  advance(0, true);
  return { root, ring, core, advance };
}

describe('station habitat rotation', () => {
  it.each([1, 5, 30, 60, 120])(
    'makes one revolution in 60 seconds at %s fps without moving the axle or core',
    (fps) => {
      const { root, ring, core, advance } = station();
      const initial = ring.quaternion.clone();
      const position = ring.position.clone();
      const rootOrientation = root.quaternion.clone();
      for (let frame = 0; frame < fps * 60; frame++) {
        advance(1 / fps, true);
        if (frame === fps * 15 - 1) {
          expect(ring.quaternion.angleTo(initial)).toBeCloseTo(Math.PI / 2);
          expect(new Vector3(0, 1, 0).applyQuaternion(ring.quaternion).distanceTo(new Vector3(0, 0, 1))).toBeLessThan(
            1e-10,
          );
        }
      }
      expect(ring.quaternion.angleTo(initial)).toBeLessThan(1e-6);
      expect(ring.position).toEqual(position);
      expect(root.quaternion.toArray()).toEqual(rootOrientation.toArray());
      expect(core.quaternion.toArray()).toEqual([0, 0, 0, 1]);
    },
  );

  it('pauses without accumulating time and resumes from the same orientation', () => {
    const { ring, advance } = station();
    advance(0.02, true);
    const paused = ring.quaternion.clone();
    advance(60, false);
    expect(ring.quaternion.toArray()).toEqual(paused.toArray());
    advance(60, true);
    expect(ring.quaternion.toArray()).toEqual(paused.toArray());
    advance(0.02, true);
    expect(ring.quaternion.angleTo(paused)).toBeCloseTo((Math.PI * 2 * 0.02) / 60);
  });

  it('pauses for an invisible ring or ancestor and skips the first resumed delta', () => {
    const { root, ring, advance } = station();
    const initial = ring.quaternion.clone();
    root.visible = false;
    advance(1, true);
    root.visible = true;
    ring.visible = false;
    advance(1, true);
    expect(ring.quaternion.toArray()).toEqual(initial.toArray());
    ring.visible = true;
    advance(60, true);
    expect(ring.quaternion.toArray()).toEqual(initial.toArray());
    advance(0.02, true);
    expect(ring.quaternion.angleTo(initial)).toBeCloseTo((Math.PI * 2 * 0.02) / 60);
  });

  it('reports an incompatible station asset', () => {
    expect(() => createStationHabitatRotation(new Group())).toThrow('missing its HabitatRing node');
  });
});
