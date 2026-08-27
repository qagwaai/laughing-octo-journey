import { signal } from '@angular/core';
import { Euler, Quaternion, type Camera } from 'three';
import { Triple } from '../../model/shared/triple';
import {
  applyMouseLook,
  integrateFlightStep,
  quantizeCoordinate,
  resolveMovementInput,
  type FlightOrientation,
} from './ship-exterior-flight-controls';

interface ShipExteriorFlightControllerConfig {
  tickMs: number;
  trackingCheckpointMs: number;
  trackingQuantizeKm: number;
  sceneUnitToKm: number;
  baseSpeedSceneUnitsPerSec: number;
  boostMultiplier: number;
  rollSpeedRadPerSec: number;
  defaultMouseSensitivity: number;
  mouseSensitivityMin: number;
  mouseSensitivityMax: number;
  maxPitchRad: number;
}

interface ShipExteriorFlightControllerArgs {
  config: ShipExteriorFlightControllerConfig;
  getCamera: () => Camera | null;
  setActiveShipLocationKm: (location: Triple) => void;
  commitTrackedLocation: (location: Triple) => void;
}

const ZERO_LOCATION: Triple = { x: 0, y: 0, z: 0 };

export class ShipExteriorFlightController {
  readonly flightModeEnabled = signal(false);
  readonly flightInvertY = signal(false);
  readonly flightMouseSensitivity = signal(0);
  readonly flightSpeedKmPerSec = signal(0);
  readonly flightWorldOffset = signal<[number, number, number]>([0, 0, 0]);
  readonly flightWorldRotation = signal<[number, number, number]>([0, 0, 0]);
  readonly flightOrientation = signal<FlightOrientation>({ yawRad: 0, pitchRad: 0, rollRad: 0 });
  readonly cameraOrientation = signal<FlightOrientation>({ yawRad: 0, pitchRad: 0, rollRad: 0 });

  private flightTickIntervalId: number | null = null;
  private flightTrackingAccumulatorMs = 0;
  private readonly flightPressedKeys = new Set<string>();
  private flightDisplacementScene: Triple = { x: 0, y: 0, z: 0 };
  private flightCurrentLocationKm: Triple = { x: 0, y: 0, z: 0 };

  constructor(private readonly args: ShipExteriorFlightControllerArgs) {
    this.flightMouseSensitivity.set(this.args.config.defaultMouseSensitivity);
  }

  start(): void {
    this.stop();
    this.flightTickIntervalId = window.setInterval(() => this.tickFlight(), this.args.config.tickMs);
  }

  stop(): void {
    if (this.flightTickIntervalId !== null) {
      window.clearInterval(this.flightTickIntervalId);
      this.flightTickIntervalId = null;
    }
  }

  dispose(): void {
    this.stop();
  }

  initializeCurrentLocation(location: Triple): void {
    this.flightCurrentLocationKm = location;
  }

  initializeCurrentLocationFromReference(currentLocation: Triple, referenceLocation: Triple): void {
    this.flightCurrentLocationKm = currentLocation;
    const kmScale = this.args.config.sceneUnitToKm;
    if (!Number.isFinite(kmScale) || kmScale <= 0) {
      this.flightDisplacementScene = { x: 0, y: 0, z: 0 };
      this.syncFlightWorldTransform();
      return;
    }

    this.flightDisplacementScene = {
      x: (currentLocation.x - referenceLocation.x) / kmScale,
      y: (currentLocation.y - referenceLocation.y) / kmScale,
      z: (currentLocation.z - referenceLocation.z) / kmScale,
    };
    this.syncFlightWorldTransform();
  }

  syncCurrentLocationFromShip(location: Triple | null): void {
    if (this.flightModeEnabled()) {
      return;
    }

    this.flightCurrentLocationKm = location ?? ZERO_LOCATION;
  }

  setFlightModeEnabled(enabled: boolean): void {
    if (this.flightModeEnabled() === enabled) {
      return;
    }

    this.flightModeEnabled.set(enabled);
    this.flightPressedKeys.clear();
    this.flightTrackingAccumulatorMs = 0;
    this.flightSpeedKmPerSec.set(0);
  }

  setFlightInvertY(enabled: boolean): void {
    this.flightInvertY.set(enabled);
  }

  setFlightMouseSensitivity(rawValue: number): void {
    const clamped = Math.max(
      this.args.config.mouseSensitivityMin,
      Math.min(this.args.config.mouseSensitivityMax, rawValue),
    );
    this.flightMouseSensitivity.set(clamped);
  }

  getFlightMouseSensitivitySliderValue(): number {
    return Math.round(this.flightMouseSensitivity() * 10000);
  }

  setFlightMouseSensitivityFromSliderValue(rawValue: number): void {
    this.setFlightMouseSensitivity(rawValue / 10000);
  }

  getCurrentLocationKm(): Triple {
    return {
      x: this.flightCurrentLocationKm.x,
      y: this.flightCurrentLocationKm.y,
      z: this.flightCurrentLocationKm.z,
    };
  }

  restoreOrientation(orientation: FlightOrientation): void {
    const restored: FlightOrientation = {
      yawRad: Number.isFinite(orientation.yawRad) ? orientation.yawRad : 0,
      pitchRad: Number.isFinite(orientation.pitchRad) ? orientation.pitchRad : 0,
      rollRad: Number.isFinite(orientation.rollRad) ? orientation.rollRad : 0,
    };
    this.flightOrientation.set(restored);
    this.cameraOrientation.set(restored);
    this.syncFlightWorldTransform();
  }

  getPersistableViewOrientation(): FlightOrientation {
    if (this.flightModeEnabled()) {
      const orientation = this.flightOrientation();
      return {
        yawRad: orientation.yawRad,
        pitchRad: orientation.pitchRad,
        rollRad: orientation.rollRad,
      };
    }

    const orientation = this.getCurrentCameraOrientation() ?? this.cameraOrientation();
    return {
      yawRad: orientation.yawRad,
      pitchRad: orientation.pitchRad,
      rollRad: orientation.rollRad,
    };
  }

  captureFlightMovementKey(code: string): boolean {
    if (!this.flightModeEnabled()) {
      return false;
    }

    if (
      code === 'KeyW' ||
      code === 'KeyA' ||
      code === 'KeyS' ||
      code === 'KeyD' ||
      code === 'Space' ||
      code === 'ControlLeft' ||
      code === 'ControlRight' ||
      code === 'KeyC' ||
      code === 'ShiftLeft' ||
      code === 'ShiftRight' ||
      code === 'KeyQ' ||
      code === 'KeyE'
    ) {
      this.flightPressedKeys.add(code);
      return true;
    }

    return false;
  }

  releaseFlightMovementKey(code: string): boolean {
    if (!this.flightModeEnabled()) {
      return false;
    }

    return this.flightPressedKeys.delete(code);
  }

  applyMouseMove(movementX: number, movementY: number): void {
    if (!this.flightModeEnabled()) {
      return;
    }

    this.flightOrientation.set(
      applyMouseLook(this.flightOrientation(), movementX, movementY, {
        sensitivity: this.flightMouseSensitivity(),
        invertY: this.flightInvertY(),
        maxPitchRad: this.args.config.maxPitchRad,
      }),
    );
    this.syncFlightWorldTransform();
  }

  private getCurrentCameraOrientation(): FlightOrientation | null {
    const camera = this.args.getCamera();
    if (!camera) {
      return null;
    }

    const euler = new Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    return {
      yawRad: euler.y,
      pitchRad: euler.x,
      rollRad: euler.z,
    };
  }

  private pollCameraOrientation(): void {
    const next = this.getCurrentCameraOrientation();
    if (!next) {
      return;
    }
    const current = this.cameraOrientation();

    if (
      Math.abs(next.yawRad - current.yawRad) < 1e-4 &&
      Math.abs(next.pitchRad - current.pitchRad) < 1e-4 &&
      Math.abs(next.rollRad - current.rollRad) < 1e-4
    ) {
      return;
    }

    this.cameraOrientation.set(next);
  }

  private tickFlight(): void {
    if (!this.flightModeEnabled()) {
      this.pollCameraOrientation();
      return;
    }

    const step = integrateFlightStep(this.flightOrientation(), resolveMovementInput(this.flightPressedKeys), {
      deltaSeconds: this.args.config.tickMs / 1000,
      baseSpeedSceneUnitsPerSec: this.args.config.baseSpeedSceneUnitsPerSec,
      boostMultiplier: this.args.config.boostMultiplier,
      rollSpeedRadPerSec: this.args.config.rollSpeedRadPerSec,
    });
    this.flightOrientation.set(step.orientation);
    this.flightSpeedKmPerSec.set(step.speedSceneUnitsPerSec * this.args.config.sceneUnitToKm);

    if (step.speedSceneUnitsPerSec <= 0) {
      this.syncFlightWorldTransform();
      return;
    }

    this.flightDisplacementScene = {
      x: this.flightDisplacementScene.x + step.worldDelta.x,
      y: this.flightDisplacementScene.y + step.worldDelta.y,
      z: this.flightDisplacementScene.z + step.worldDelta.z,
    };

    const kmScale = this.args.config.sceneUnitToKm;
    this.flightCurrentLocationKm = {
      x: this.flightCurrentLocationKm.x + step.worldDelta.x * kmScale,
      y: this.flightCurrentLocationKm.y + step.worldDelta.y * kmScale,
      z: this.flightCurrentLocationKm.z + step.worldDelta.z * kmScale,
    };

    this.flightTrackingAccumulatorMs += this.args.config.tickMs;
    if (this.flightTrackingAccumulatorMs >= this.args.config.trackingCheckpointMs) {
      this.commitFlightTrackingCheckpoint();
      this.flightTrackingAccumulatorMs = 0;
    }

    this.syncFlightWorldTransform();
  }

  private commitFlightTrackingCheckpoint(): void {
    const nextLocation: Triple = {
      x: quantizeCoordinate(this.flightCurrentLocationKm.x, this.args.config.trackingQuantizeKm),
      y: quantizeCoordinate(this.flightCurrentLocationKm.y, this.args.config.trackingQuantizeKm),
      z: quantizeCoordinate(this.flightCurrentLocationKm.z, this.args.config.trackingQuantizeKm),
    };

    this.args.setActiveShipLocationKm(nextLocation);
    this.args.commitTrackedLocation(nextLocation);
  }

  private syncFlightWorldTransform(): void {
    const orientation = this.flightOrientation();
    this.flightWorldOffset.set([
      +(-this.flightDisplacementScene.x).toFixed(3),
      +(-this.flightDisplacementScene.y).toFixed(3),
      +(-this.flightDisplacementScene.z).toFixed(3),
    ]);

    const orientationQuaternion = new Quaternion().setFromEuler(
      new Euler(orientation.pitchRad, orientation.yawRad, orientation.rollRad, 'YXZ'),
    );
    const sceneEuler = new Euler().setFromQuaternion(orientationQuaternion.invert(), 'XYZ');
    this.flightWorldRotation.set([+(sceneEuler.x).toFixed(4), +(sceneEuler.y).toFixed(4), +(sceneEuler.z).toFixed(4)]);
  }
}
