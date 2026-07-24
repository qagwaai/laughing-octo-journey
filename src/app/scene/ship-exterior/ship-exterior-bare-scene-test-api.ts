import { Signal } from '@angular/core';
import type { ShipSceneRuntimeSnapshot } from './ship-scene-types';
import type { ShipExteriorMissionGateState } from '../../mission/ship-exterior-mission';

declare global {
  interface Window {
    __shipExteriorBareSceneTestUtils?: ShipExteriorBareSceneTestApi;
    __shipExteriorTestUtils?: ShipExteriorLegacyTestApi;
  }
}

export interface ShipExteriorLegacyAsteroidSample {
  id: string;
  scanned: boolean;
  scanProgress: number;
  revealedMaterial?: {
    material?: string;
    rarity?: string;
  };
}

export interface ShipExteriorLegacyTestApi {
  getAsteroidSamples: () => ShipExteriorLegacyAsteroidSample[];
  beginAsteroidTargetHold: (sampleId: string) => boolean;
  unhoverAsteroid: (sampleId: string) => boolean;
  getTargetHoldCandidateId: () => string | null;
  getMissionGateState: () => ShipExteriorMissionGateState;
  resetMissionGateState: () => ShipExteriorMissionGateState;
  forceCompleteIronScan: (sampleId?: string) => ShipExteriorMissionGateState | null;
  forceTargetAsteroid: (sampleId: string) => boolean;
  getTargetedAsteroidId: () => string | null;
  launchFromHotkey: (hotkey: 1 | 2 | 3 | 4 | 5) => void;
  simulateDebrisCollection: (remainingDebrisCount?: number) => ShipExteriorMissionGateState;
  simulateManufacture: (itemType: string) => ShipExteriorMissionGateState;
  simulateRepair: (repairKind: string) => ShipExteriorMissionGateState;
  getActiveShipInventoryItemTypes: () => string[];
  getActiveLaunchToast: () => { message: string; tone: 'success' | 'error' } | null;
}

export interface ShipExteriorBareSceneTestApi {
  contextKeys: Signal<readonly string[]>;
  activeContextKey: Signal<string | null>;
  activateContext: (contextKey: string) => boolean;
  snapshotActiveContext: () => ShipSceneRuntimeSnapshot | null;
  toggleFlightMode: () => void;
  setFlightInvertY: (enabled: boolean) => void;
  setFlightMouseSensitivityFromSliderValue: (rawValue: number) => void;
  legacy: ShipExteriorLegacyTestApi;
}

export function registerShipExteriorBareSceneTestApi(api: ShipExteriorBareSceneTestApi): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.__shipExteriorBareSceneTestUtils = api;
  window.__shipExteriorTestUtils = api.legacy;
}

export function unregisterShipExteriorBareSceneTestApi(): void {
  if (typeof window === 'undefined') {
    return;
  }
  delete window.__shipExteriorBareSceneTestUtils;
  delete window.__shipExteriorTestUtils;
}
