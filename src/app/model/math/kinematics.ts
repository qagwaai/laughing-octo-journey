import { Triple } from '../shared/triple';
import { ShipMotion } from '../ship-list';

const MIN_SPEED_EPSILON_KM_PER_SEC = 1e-9;

export interface ShipMotionSummary {
  speedKmPerSec: number;
  headingUnitVector: Triple | null;
}

/**
 * Computes Euclidean magnitude for a 3D vector in kilometers-based units.
 */
export function getVectorMagnitude(vector: Triple): number {
  return Math.sqrt(vector.x ** 2 + vector.y ** 2 + vector.z ** 2);
}

/**
 * Normalizes a velocity vector into heading direction, or null at near-zero speed.
 */
export function getHeadingUnitVector(velocity: Triple): Triple | null {
  const speedKmPerSec = getVectorMagnitude(velocity);
  if (speedKmPerSec <= MIN_SPEED_EPSILON_KM_PER_SEC) {
    return null;
  }

  return {
    x: velocity.x / speedKmPerSec,
    y: velocity.y / speedKmPerSec,
    z: velocity.z / speedKmPerSec,
  };
}

/**
 * Produces a compact speed + heading summary from full ship motion data.
 */
export function summarizeShipMotion(motion: ShipMotion): ShipMotionSummary {
  return {
    speedKmPerSec: getVectorMagnitude(motion.velocityKmPerSec),
    headingUnitVector: getHeadingUnitVector(motion.velocityKmPerSec),
  };
}
