import { describe, expect, it } from 'vitest';
import {
  applyMouseLook,
  integrateFlightStep,
  quantizeCoordinate,
  resolveWorldRelativeTransform,
  resolveMovementInput,
  type FlightOrientation,
} from './ship-exterior-flight-controls';

describe('ship-exterior-flight-controls', () => {
  it('maps key presses to 6DoF movement input', () => {
    const input = resolveMovementInput(new Set(['KeyW', 'KeyD', 'Space', 'KeyE', 'ShiftLeft']));

    expect(input).toEqual({
      forward: 1,
      right: 1,
      up: 1,
      roll: 0,
      boosting: true,
    });
  });

  it('applies mouse look with pitch clamp and invert option', () => {
    const start: FlightOrientation = { yawRad: 0, pitchRad: 0, rollRad: 0 };

    const regular = applyMouseLook(start, 3, 4, {
      sensitivity: 0.1,
      invertY: false,
      maxPitchRad: 0.2,
    });
    const inverted = applyMouseLook(start, 3, 4, {
      sensitivity: 0.1,
      invertY: true,
      maxPitchRad: 0.2,
    });

    expect(regular.yawRad).toBeCloseTo(-0.3, 4);
    expect(regular.pitchRad).toBeCloseTo(-0.2, 4);
    expect(inverted.pitchRad).toBeCloseTo(0.2, 4);
  });

  it('integrates flight step with normalized diagonal movement and boost', () => {
    const start: FlightOrientation = { yawRad: 0, pitchRad: 0, rollRad: 0 };
    const result = integrateFlightStep(
      start,
      {
        forward: 1,
        right: 1,
        up: 0,
        roll: 0,
        boosting: true,
      },
      {
        deltaSeconds: 0.5,
        baseSpeedSceneUnitsPerSec: 2,
        boostMultiplier: 2,
        rollSpeedRadPerSec: 1,
      },
    );

    expect(result.speedSceneUnitsPerSec).toBe(4);
    expect(result.worldDelta.x).toBeCloseTo(Math.SQRT1_2 * 2, 4);
    expect(result.worldDelta.z).toBeCloseTo(-Math.SQRT1_2 * 2, 4);
  });

  it('moves forward along the steered ship heading', () => {
    const result = integrateFlightStep(
      { yawRad: Math.PI / 2, pitchRad: 0, rollRad: 0 },
      { forward: 1, right: 0, up: 0, roll: 0, boosting: false },
      {
        deltaSeconds: 1,
        baseSpeedSceneUnitsPerSec: 3,
        boostMultiplier: 1,
        rollSpeedRadPerSec: 1,
      },
    );

    expect(result.worldDelta.x).toBeCloseTo(-3, 4);
    expect(result.worldDelta.y).toBeCloseTo(0, 4);
    expect(result.worldDelta.z).toBeCloseTo(0, 4);
  });

  it('maps the authoritative ship transform to the inverse rendered-world transform', () => {
    const transform = resolveWorldRelativeTransform(
      { x: -3, y: 0, z: 0 },
      { yawRad: Math.PI / 2, pitchRad: 0, rollRad: 0 },
    );

    expect(transform.worldOffset.x).toBeCloseTo(0, 3);
    expect(transform.worldOffset.y).toBeCloseTo(0, 3);
    expect(transform.worldOffset.z).toBeCloseTo(3, 3);
    expect(transform.worldRotation.y).toBeCloseTo(-Math.PI / 2, 4);
  });

  it('quantizes coordinates to a fixed precision step', () => {
    expect(quantizeCoordinate(12.347, 0.05)).toBeCloseTo(12.35, 4);
    expect(quantizeCoordinate(-12.347, 0.05)).toBeCloseTo(-12.35, 4);
  });
});
