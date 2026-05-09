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
