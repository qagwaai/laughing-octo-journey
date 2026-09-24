import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShipExteriorFlightController } from './ship-exterior-flight-controller';

describe('ShipExteriorFlightController input lifecycle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function createController(commitTrackedLocation = vi.fn()): ShipExteriorFlightController {
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
      commitTrackedLocation,
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
    vi.advanceTimersByTime(64);
    expect(controller.flightSpeedKmPerSec()).toBeCloseTo(0.64);

    controller.clearMovementInput();
    const committedLocation = controller.getCurrentLocationKm();
    expect(controller.flightSpeedKmPerSec()).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(controller.getCurrentLocationKm()).toEqual(committedLocation);
    expect(committedLocation).not.toEqual({ x: 0, y: 0, z: 0 });
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

  it('commits a short movement when the final movement key is released before a tracking checkpoint', () => {
    const commitTrackedLocation = vi.fn();
    const controller = createController(commitTrackedLocation);
    controller.initializeCurrentLocation({ x: 100, y: 0, z: 0 });
    controller.setFlightModeEnabled(true);
    controller.start();

    controller.captureFlightMovementKey('KeyW');
    vi.advanceTimersByTime(32);
    expect(commitTrackedLocation).not.toHaveBeenCalled();
    const liveLocation = controller.getCurrentLocationKm();
    expect(liveLocation.z).toBeLessThan(0);

    controller.releaseFlightMovementKey('KeyW');

    expect(commitTrackedLocation).toHaveBeenCalledTimes(1);
    expect(commitTrackedLocation).toHaveBeenCalledWith({ x: 100, y: 0, z: -0 });
    expect(controller.getCurrentLocationKm()).toEqual(liveLocation);
    controller.dispose();
  });

  it('does not lose cumulative sub-grid movement across repeated stop commits', () => {
    const commitTrackedLocation = vi.fn();
    const controller = createController(commitTrackedLocation);
    controller.initializeCurrentLocation({ x: 100, y: 0, z: 0 });
    controller.setFlightModeEnabled(true);
    controller.start();

    for (let cycle = 0; cycle < 6; cycle += 1) {
      controller.captureFlightMovementKey('KeyW');
      vi.advanceTimersByTime(32);
      controller.releaseFlightMovementKey('KeyW');
    }

    expect(controller.getCurrentLocationKm().z).toBeLessThan(-0.025);
    expect(commitTrackedLocation).toHaveBeenLastCalledWith({ x: 100, y: 0, z: -0.05 });
    controller.dispose();
  });
});
