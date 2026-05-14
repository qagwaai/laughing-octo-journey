/**
 * Spatial frame/state contracts used by ship and market positioning.
 */
import { Triple } from '../shared/triple';

export type SpatialFrame = 'barycentric';

export interface SpatialState {
  solarSystemId: string;
  frame: SpatialFrame;
  positionKm: Triple;
  epochMs: number;
}

export interface ObservabilityState {
  visibility: 'visible' | 'not-visible' | 'cloaked';
  scanState: 'unscanned' | 'scanned';
}

export interface MotionState {
  velocityKmPerSec: Triple;
  angularVelocityRadPerSec?: Triple;
}

export interface PhysicalState {
  estimatedMassKg?: number;
  estimatedDiameterM?: number;
}

export function assertSameSpatialFrame(a: SpatialState, b: SpatialState): void {
  if (a.solarSystemId !== b.solarSystemId) {
    throw new Error(`Spatial comparison requires matching solarSystemId: ${a.solarSystemId} !== ${b.solarSystemId}`);
  }

  if (a.frame !== b.frame) {
    throw new Error(`Spatial comparison requires matching frame: ${a.frame} !== ${b.frame}`);
  }
}

export function relativePositionKm(from: SpatialState, to: SpatialState): Triple {
  assertSameSpatialFrame(from, to);

  return {
    x: to.positionKm.x - from.positionKm.x,
    y: to.positionKm.y - from.positionKm.y,
    z: to.positionKm.z - from.positionKm.z,
  };
}

export function distanceSquaredKm(a: SpatialState, b: SpatialState): number {
  const delta = relativePositionKm(a, b);
  return delta.x ** 2 + delta.y ** 2 + delta.z ** 2;
}

export function distanceKm(a: SpatialState, b: SpatialState): number {
  return Math.sqrt(distanceSquaredKm(a, b));
}

export function isWithinRange(a: SpatialState, b: SpatialState, rangeKm: number): boolean {
  return distanceSquaredKm(a, b) <= rangeKm ** 2;
}

/**
 * Returns true when a ship's spatial state is usable for rendering / placement.
 *
 * Ships float free in the solar system like celestial bodies; their canonical
 * representation is barycentric. A spatial is considered invalid when it is
 * missing, malformed, or sitting at the system origin `(0, 0, 0)` — which
 * collides with the star and indicates a starter-ship-upsert that never ran
 * or failed, or a synthetic placeholder. Use this to drive lazy repair and
 * viewer fallback rendering.
 */
export function isValidShipSpatial(spatial: SpatialState | null | undefined): spatial is SpatialState {
  if (!spatial) return false;
  if (spatial.frame !== 'barycentric') return false;
  if (!spatial.solarSystemId) return false;
  const pos = spatial.positionKm;
  if (!pos || typeof pos.x !== 'number' || typeof pos.y !== 'number' || typeof pos.z !== 'number') {
    return false;
  }
  if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(pos.z)) {
    return false;
  }
  // Reject sun-origin placement. Any reasonable ship position is at least
  // thousands of km from the barycenter; a magnitude floor of 1 km is more
  // than safe to detect uninitialized data without rejecting valid positions.
  const magnitudeSquared = pos.x * pos.x + pos.y * pos.y + pos.z * pos.z;
  return magnitudeSquared >= 1;
}
