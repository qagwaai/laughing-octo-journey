import { Euler, Quaternion, Vector3 } from 'three';
import { Triple } from '../../model/shared/triple';

export type TractorBeamPhase = 'pulling' | 'committing' | 'reversing';

export interface TractorBeamAnimationState {
  debrisId: string;
  itemType: string;
  displayName: string;
  startPositionKm: Triple;
  currentPositionKm: Triple;
  phase: TractorBeamPhase;
  phaseStartedAtMs: number;
  phaseDurationMs: number;
  reverseFailureMessage: string | null;
}

export interface TractorBeamVisualState {
  conePosition: [number, number, number];
  coneRotation: [number, number, number];
  coneScale: [number, number, number];
  particlePositions: [number, number, number][];
}

interface ResolveTractorBeamVisualStateArgs {
  state: TractorBeamAnimationState | null;
  elapsedMs: number;
  particleCount: number;
  debrisScenePositionFromKm: (positionKm: Triple) => [number, number, number];
}

export function resolveTractorBeamVisualState({
  state,
  elapsedMs,
  particleCount,
  debrisScenePositionFromKm,
}: ResolveTractorBeamVisualStateArgs): TractorBeamVisualState | null {
  if (!state || (state.phase !== 'pulling' && state.phase !== 'reversing')) {
    return null;
  }

  const target = debrisScenePositionFromKm(state.currentPositionKm);
  const direction = new Vector3(target[0], target[1], target[2]);
  const length = direction.length();
  if (length < 1e-4) {
    return null;
  }

  const normalized = direction.clone().normalize();
  const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), normalized);
  const coneEuler = new Euler().setFromQuaternion(quaternion, 'XYZ');
  const midpoint: [number, number, number] = [target[0] * 0.5, target[1] * 0.5, target[2] * 0.5];

  const elapsedSeconds = elapsedMs / 1000;
  const particlePositions: [number, number, number][] = [];
  const tangent = Math.abs(normalized.y) > 0.93 ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0);
  const basisA = new Vector3().crossVectors(normalized, tangent).normalize();
  const basisB = new Vector3().crossVectors(normalized, basisA).normalize();

  for (let index = 0; index < particleCount; index += 1) {
    const travel = ((elapsedSeconds * 1.8 + index / particleCount) % 1 + 1) % 1;
    const along = direction.clone().multiplyScalar(travel);
    const swirlRadius = 0.05 + 0.035 * Math.sin((elapsedSeconds + index) * 2.4);
    const swirlAngle = elapsedSeconds * 7 + index * 0.9;
    const swirl = basisA
      .clone()
      .multiplyScalar(Math.cos(swirlAngle) * swirlRadius)
      .add(basisB.clone().multiplyScalar(Math.sin(swirlAngle) * swirlRadius));
    const point = along.add(swirl);
    particlePositions.push([point.x, point.y, point.z]);
  }

  return {
    conePosition: midpoint,
    coneRotation: [coneEuler.x, coneEuler.y, coneEuler.z],
    coneScale: [0.38, length, 0.38],
    particlePositions,
  };
}
