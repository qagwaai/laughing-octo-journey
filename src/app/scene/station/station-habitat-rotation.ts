import { Quaternion, Vector3, type Object3D } from 'three';

const RADIANS_PER_SECOND = (Math.PI * 2) / 60;

export function createStationHabitatRotation(model: Object3D): (delta: number, enabled: boolean) => void {
  const ring = model.getObjectByName('HabitatRing');
  if (!ring) throw new Error('Station model is missing its HabitatRing node.');
  const initial = ring.quaternion.clone();
  const axle = new Vector3(0, 1, 0);
  const spin = new Quaternion();
  let angle = 0;
  let running = false;

  return (delta, enabled) => {
    if (!enabled) {
      running = false;
      return;
    }
    for (let object: Object3D | null = ring; object; object = object.parent) {
      if (!object.visible) {
        running = false;
        return;
      }
    }
    if (!running) {
      running = true;
      return;
    }
    // glTF's local Y is the ring axle; its exported orientation aligns it with the spine.
    angle = (angle + delta * RADIANS_PER_SECOND) % (Math.PI * 2);
    ring.quaternion.copy(initial).multiply(spin.setFromAxisAngle(axle, angle));
  };
}
