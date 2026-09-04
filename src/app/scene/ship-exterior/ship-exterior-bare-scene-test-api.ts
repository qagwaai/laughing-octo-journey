import { Signal } from '@angular/core';
import type { ShipExteriorMissionGateState } from '../../mission/ship-exterior-mission';
import type { ShipSceneRuntimeSnapshot } from './ship-scene-types';

declare global {
  interface Window {
    __shipExteriorBareSceneTestUtils?: ShipExteriorBareSceneTestApi;
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

export interface ShipExteriorLegacyScannableShipSample {
  id: string;
  displayName: string;
  modelAssetPath?: string | null;
  scanned: boolean;
  scanProgress: number;
}

export interface ShipExteriorLegacyScannableDebrisSample {
  id: string;
  displayName: string;
  itemType: string;
  scanned: boolean;
  scanProgress: number;
}

export interface ShipExteriorLegacyTestApi {
  getAsteroidSamples: () => ShipExteriorLegacyAsteroidSample[];
  getScannableDebrisSamples: () => ShipExteriorLegacyScannableDebrisSample[];
  getScannableShipSamples: () => ShipExteriorLegacyScannableShipSample[];
  beginAsteroidTargetHold: (sampleId: string) => boolean;
  unhoverAsteroid: (sampleId: string) => boolean;
  getTargetHoldCandidateId: () => string | null;
  getMissionGateState: () => ShipExteriorMissionGateState;
  resetMissionGateState: () => ShipExteriorMissionGateState;
  forceCompleteIronScan: (sampleId?: string) => ShipExteriorMissionGateState | null;
  forceTargetAsteroid: (sampleId: string) => boolean;
  getTargetedAsteroidId: () => string | null;
  getHoveredAsteroidId: () => string | null;
  forceCompleteDebrisScan: (sampleId?: string) => boolean;
  getHoveredScannableDebrisId: () => string | null;
  forceCompleteShipScan: (sampleId?: string) => boolean;
  getHoveredScannableShipId: () => string | null;
  launchFromHotkey: (hotkey: 1 | 2 | 3 | 4 | 5) => void;
  getActiveShipInventoryItemTypes: () => string[];
  getActiveLaunchToast: () => { message: string; tone: 'success' | 'error'; seed: number | null } | null;
}

export interface ShipExteriorBareSceneTestApi {
  contextKeys: Signal<readonly string[]>;
  activeContextKey: Signal<string | null>;
  activateContext: (contextKey: string) => boolean;
  snapshotActiveContext: () => ShipSceneRuntimeSnapshot | null;
  toggleFlightMode: () => void;
  setFlightInvertY: (enabled: boolean) => void;
  setFlightMouseSensitivityFromSliderValue: (rawValue: number) => void;
  getActiveRouteFeedCounts: () => { gates: number; stations: number; encounterShips: number } | null;
  getMissionGateState: () => ShipExteriorMissionGateState;
  resetMissionGateState: () => ShipExteriorMissionGateState;
  legacy: ShipExteriorLegacyTestApi;
}

export interface ShipExteriorBareSceneTestApiFactoryDeps {
  formal: Omit<ShipExteriorBareSceneTestApi, 'legacy'>;
  legacy: ShipExteriorLegacyTestApi;
}

export function createShipExteriorBareSceneTestApi(
  deps: ShipExteriorBareSceneTestApiFactoryDeps,
): ShipExteriorBareSceneTestApi {
  return {
    ...deps.formal,
    legacy: deps.legacy,
  };
}

export function registerShipExteriorBareSceneTestApi(
  api: ShipExteriorBareSceneTestApi,
  enabled = true,
): void {
  if (!enabled) {
    return;
  }

  if (typeof window === 'undefined') {
    return;
  }
  window.__shipExteriorBareSceneTestUtils = api;
}

export function unregisterShipExteriorBareSceneTestApi(): void {
  if (typeof window === 'undefined') {
    return;
  }
  delete window.__shipExteriorBareSceneTestUtils;
}
