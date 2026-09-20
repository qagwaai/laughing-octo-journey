import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShipExteriorFlightController } from './ship-exterior-flight-controller';

describe('ShipExteriorFlightController input lifecycle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function createController(): ShipExteriorFlightController {
    return new ShipExteriorFlightController({
      config: {
        tickMs: 16,
        trackingCheckpointMs: 250,
        trackingQuantizeKm: 0.05,
        sceneUnitToKm: 1,
        baseSpeedSceneUnitsPerSec: 0.16,
        boostMultiplier: 4,
        rollSpeedRadPerSec: 0.75,
        defaultMouseSensitivity: 0.0023,
        mouseSensitivityMin: 0.0002,
        mouseSensitivityMax: 0.01,
        maxPitchRad: Math.PI / 2 - 0.02,
      },
      getCamera: () => null,
      applyWorldRelativeTransform: vi.fn(),
      setActiveShipLocationKm: vi.fn(),
      commitTrackedLocation: vi.fn(),
    });
  }

  it('clears held movement and boost without resetting position, orientation, or pilot mode', () => {
    const controller = createController();
    const orientation = { yawRad: 0.4, pitchRad: 0.2, rollRad: 0 };
    controller.restoreOrientation(orientation);
    controller.setFlightModeEnabled(true);
    controller.start();
    controller.captureFlightMovementKey('KeyW');
    controller.captureFlightMovementKey('ShiftLeft');
    vi.advanceTimersByTime(32);
    expect(controller.flightSpeedKmPerSec()).toBeCloseTo(0.64);
    const location = controller.getCurrentLocationKm();

    controller.clearMovementInput();
    expect(controller.flightSpeedKmPerSec()).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(controller.getCurrentLocationKm()).toEqual(location);
    expect(controller.getPersistableViewOrientation()).toEqual(orientation);
    expect(controller.flightModeEnabled()).toBe(true);

    controller.captureFlightMovementKey('KeyW');
    vi.advanceTimersByTime(16);
    expect(controller.flightSpeedKmPerSec()).toBeCloseTo(0.16);
    controller.dispose();
  });

  it('does not resume held movement after stopping and restarting the timer', () => {
    const controller = createController();
    controller.setFlightModeEnabled(true);
    controller.start();
    controller.captureFlightMovementKey('KeyW');
    vi.advanceTimersByTime(32);
    controller.stop();
    const location = controller.getCurrentLocationKm();

    expect(controller.flightSpeedKmPerSec()).toBe(0);
    controller.start();
    vi.advanceTimersByTime(1000);
    expect(controller.getCurrentLocationKm()).toEqual(location);
    controller.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
});
