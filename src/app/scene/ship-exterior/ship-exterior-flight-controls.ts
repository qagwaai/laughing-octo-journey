import { Vector3 } from 'three';

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

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function resolveMovementInput(keys: ReadonlySet<string>): FlightMovementInput {
  const forward = (keys.has('KeyW') ? 1 : 0) + (keys.has('KeyS') ? -1 : 0);
  const right = (keys.has('KeyD') ? 1 : 0) + (keys.has('KeyA') ? -1 : 0);
  const up =
    (keys.has('Space') ? 1 : 0) +
    (keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyC') ? -1 : 0);
  const roll = (keys.has('KeyE') ? 1 : 0) + (keys.has('KeyQ') ? -1 : 0);

  return {
    forward,
    right,
    up,
    roll,
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
  // Roll is disabled: OrbitControls cannot maintain roll after flight mode exits,
  // so we keep it at 0 to prevent a jarring snap on flight-mode toggle.
  const nextOrientation: FlightOrientation = {
    ...orientation,
    rollRad: 0,
  };

  const localVector = new Vector3(input.right, input.up, input.forward);
  if (localVector.lengthSq() > 1) {
    localVector.normalize();
  }

  const speed =
    localVector.lengthSq() > 0
      ? config.baseSpeedSceneUnitsPerSec * (input.boosting ? config.boostMultiplier : 1)
      : 0;

  // The camera is locked to world -Z while the scene rotates around the player.
  // So the displacement applied to the scene group is in the *camera* (world) frame,
  // not rotated by the flight orientation. W shifts -Z scene offset, etc.
  const worldDelta = localVector.multiplyScalar(speed * deltaSeconds);

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

export function quantizeCoordinate(value: number, step: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(step) || step <= 0) {
    return value;
  }
  return Math.round(value / step) * step;
}
