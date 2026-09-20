import { Euler, Quaternion, Vector3 } from 'three';

export interface FlightOrientation {
  yawRad: number;
  pitchRad: number;
  rollRad: number;
}

export interface FlightMovementInput {
  forward: number;
  right: number;
  up: number;
  roll: number;
  boosting: boolean;
}

export interface FlightMouseLookSettings {
  sensitivity: number;
  invertY: boolean;
  maxPitchRad: number;
}

export interface FlightStepConfig {
  deltaSeconds: number;
  baseSpeedSceneUnitsPerSec: number;
  boostMultiplier: number;
  rollSpeedRadPerSec: number;
}

export interface FlightStepResult {
  orientation: FlightOrientation;
  worldDelta: { x: number; y: number; z: number };
  speedSceneUnitsPerSec: number;
}

export interface WorldRelativeTransform {
  worldOffset: { x: number; y: number; z: number };
  worldRotation: { x: number; y: number; z: number };
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function resolveMovementInput(keys: ReadonlySet<string>): FlightMovementInput {
  const forward = (keys.has('KeyW') ? 1 : 0) + (keys.has('KeyS') ? -1 : 0);
  const right = (keys.has('KeyD') ? 1 : 0) + (keys.has('KeyA') ? -1 : 0);
  const up =
    (keys.has('Space') ? 1 : 0) + (keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC') ? -1 : 0);
  return {
    forward,
    right,
    up,
    // Roll is deliberately disabled for the initial pilot-camera migration.
    roll: 0,
    boosting: keys.has('ShiftLeft') || keys.has('ShiftRight'),
  };
}

export function applyMouseLook(
  orientation: FlightOrientation,
  movementX: number,
  movementY: number,
  settings: FlightMouseLookSettings,
): FlightOrientation {
  const nextYaw = orientation.yawRad - movementX * settings.sensitivity;
  const verticalDirection = settings.invertY ? 1 : -1;
  const nextPitch = clamp(
    orientation.pitchRad + movementY * settings.sensitivity * verticalDirection,
    -settings.maxPitchRad,
    settings.maxPitchRad,
  );

  return {
    ...orientation,
    yawRad: nextYaw,
    pitchRad: nextPitch,
  };
}

export function integrateFlightStep(
  orientation: FlightOrientation,
  input: FlightMovementInput,
  config: FlightStepConfig,
): FlightStepResult {
  const deltaSeconds = Math.max(0, config.deltaSeconds);
  const nextOrientation: FlightOrientation = {
    ...orientation,
    rollRad: 0,
  };

  // Three.js cameras look along local -Z. The pilot's forward input therefore
  // maps to -Z before it is rotated into authoritative world coordinates.
  const localVector = new Vector3(input.right, input.up, -input.forward);
  if (localVector.lengthSq() > 1) {
    localVector.normalize();
  }

  const speed =
    localVector.lengthSq() > 0 ? config.baseSpeedSceneUnitsPerSec * (input.boosting ? config.boostMultiplier : 1) : 0;

  const shipOrientation = new Quaternion().setFromEuler(
    new Euler(nextOrientation.pitchRad, nextOrientation.yawRad, nextOrientation.rollRad, 'YXZ'),
  );
  const worldDelta = localVector.applyQuaternion(shipOrientation).multiplyScalar(speed * deltaSeconds);

  return {
    orientation: nextOrientation,
    worldDelta: {
      x: worldDelta.x,
      y: worldDelta.y,
      z: worldDelta.z,
    },
    speedSceneUnitsPerSec: speed,
  };
}

export function resolveWorldRelativeTransform(
  shipDisplacementScene: { x: number; y: number; z: number },
  orientation: FlightOrientation,
): WorldRelativeTransform {
  const inverseShipOrientation = new Quaternion()
    .setFromEuler(new Euler(orientation.pitchRad, orientation.yawRad, orientation.rollRad, 'YXZ'))
    .invert();
  const worldOffset = new Vector3(
    shipDisplacementScene.x,
    shipDisplacementScene.y,
    shipDisplacementScene.z,
  )
    .applyQuaternion(inverseShipOrientation)
    .negate();
  const worldEuler = new Euler().setFromQuaternion(inverseShipOrientation, 'XYZ');

  return {
    worldOffset: {
      x: +worldOffset.x.toFixed(3),
      y: +worldOffset.y.toFixed(3),
      z: +worldOffset.z.toFixed(3),
    },
    worldRotation: {
      x: +worldEuler.x.toFixed(4),
      y: +worldEuler.y.toFixed(4),
      z: +worldEuler.z.toFixed(4),
    },
  };
}

export function quantizeCoordinate(value: number, step: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) {
    return value;
  }
  return Math.round(value / step) * step;
}
