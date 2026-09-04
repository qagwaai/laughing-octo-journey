import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';
import type { ShipExteriorMissionGateState } from '../../mission/ship-exterior-mission';
import {
  createShipExteriorBareSceneTestApi,
  registerShipExteriorBareSceneTestApi,
  unregisterShipExteriorBareSceneTestApi,
  type ShipExteriorBareSceneTestApiFactoryDeps,
  type ShipExteriorLegacyTestApi,
} from './ship-exterior-bare-scene-test-api';
import type { ShipSceneContext } from './ship-scene-context';

type MissionStateCallbacks = Pick<
  ShipExteriorBareSceneTestApiFactoryDeps['formal'],
  'getMissionGateState' | 'resetMissionGateState'
>;

interface ShipExteriorBareSceneMissionStateCallbacks {
  formal: MissionStateCallbacks;
  legacy: Pick<ShipExteriorLegacyTestApi, 'getMissionGateState' | 'resetMissionGateState'>;
}

interface ShipExteriorBareSceneContextCallbacks {
  snapshotActiveContext: ShipExteriorBareSceneTestApiFactoryDeps['formal']['snapshotActiveContext'];
  getTargetedAsteroidId: ShipExteriorLegacyTestApi['getTargetedAsteroidId'];
  getHoveredAsteroidId: ShipExteriorLegacyTestApi['getHoveredAsteroidId'];
  getHoveredScannableDebrisId: ShipExteriorLegacyTestApi['getHoveredScannableDebrisId'];
  getHoveredScannableShipId: ShipExteriorLegacyTestApi['getHoveredScannableShipId'];
}

interface ShipExteriorBareSceneInspectionCallbacks {
  getAsteroidSamples: ShipExteriorLegacyTestApi['getAsteroidSamples'];
  getScannableDebrisSamples: ShipExteriorLegacyTestApi['getScannableDebrisSamples'];
  getScannableShipSamples: ShipExteriorLegacyTestApi['getScannableShipSamples'];
}

export interface ShipExteriorBareSceneTestAdapterSources
  extends ShipExteriorBareSceneFormalCallbacks,
    ShipExteriorBareSceneInspectionCallbacks,
    ShipExteriorBareSceneScanControlCallbacks,
    ShipExteriorBareSceneLaunchCallbacks {
  getActiveContext: () => ShipSceneContext | null;
  getMissionGateState: () => ShipExteriorMissionGateState;
  resetMissionGateState: () => ShipExteriorMissionGateState;
}

type ShipExteriorBareSceneScanControlCallbacks = Pick<
  ShipExteriorLegacyTestApi,
  | 'beginAsteroidTargetHold'
  | 'unhoverAsteroid'
  | 'getTargetHoldCandidateId'
  | 'forceCompleteIronScan'
  | 'forceTargetAsteroid'
  | 'forceCompleteDebrisScan'
  | 'forceCompleteShipScan'
>;

type ShipExteriorBareSceneLaunchCallbacks = Pick<
  ShipExteriorLegacyTestApi,
  'launchFromHotkey' | 'getActiveShipInventoryItemTypes' | 'getActiveLaunchToast'
>;

type ShipExteriorBareSceneFormalCallbacks = Pick<
  ShipExteriorBareSceneTestApiFactoryDeps['formal'],
  | 'contextKeys'
  | 'activeContextKey'
  | 'activateContext'
  | 'toggleFlightMode'
  | 'setFlightInvertY'
  | 'setFlightMouseSensitivityFromSliderValue'
  | 'getActiveRouteFeedCounts'
>;

@Injectable({ providedIn: 'root' })
export class ShipExteriorBareSceneTestAdapter {
  registerFromSources(sources: ShipExteriorBareSceneTestAdapterSources): void {
    this.registerApi(this.createDependenciesFromSources(sources));
  }

  private createDependenciesFromSources(
    sources: ShipExteriorBareSceneTestAdapterSources,
  ): ShipExteriorBareSceneTestApiFactoryDeps {
    const context = this.createContextCallbacks(sources.getActiveContext);
    const mission = this.createMissionStateCallbacks(
      sources.getMissionGateState,
      sources.resetMissionGateState,
    );
    return {
      formal: {
        contextKeys: sources.contextKeys,
        activeContextKey: sources.activeContextKey,
        activateContext: sources.activateContext,
        toggleFlightMode: sources.toggleFlightMode,
        setFlightInvertY: sources.setFlightInvertY,
        setFlightMouseSensitivityFromSliderValue: sources.setFlightMouseSensitivityFromSliderValue,
        getActiveRouteFeedCounts: sources.getActiveRouteFeedCounts,
        snapshotActiveContext: context.snapshotActiveContext,
        ...mission.formal,
      },
      legacy: {
        getAsteroidSamples: sources.getAsteroidSamples,
        getScannableDebrisSamples: sources.getScannableDebrisSamples,
        getScannableShipSamples: sources.getScannableShipSamples,
        beginAsteroidTargetHold: sources.beginAsteroidTargetHold,
        unhoverAsteroid: sources.unhoverAsteroid,
        getTargetHoldCandidateId: sources.getTargetHoldCandidateId,
        forceCompleteIronScan: sources.forceCompleteIronScan,
        forceTargetAsteroid: sources.forceTargetAsteroid,
        forceCompleteDebrisScan: sources.forceCompleteDebrisScan,
        forceCompleteShipScan: sources.forceCompleteShipScan,
        ...mission.legacy,
        getTargetedAsteroidId: context.getTargetedAsteroidId,
        getHoveredAsteroidId: context.getHoveredAsteroidId,
        getHoveredScannableDebrisId: context.getHoveredScannableDebrisId,
        getHoveredScannableShipId: context.getHoveredScannableShipId,
        launchFromHotkey: sources.launchFromHotkey,
        getActiveShipInventoryItemTypes: sources.getActiveShipInventoryItemTypes,
        getActiveLaunchToast: sources.getActiveLaunchToast,
      },
    };
  }

  private createContextCallbacks(
    getActiveContext: () => ShipSceneContext | null,
  ): ShipExteriorBareSceneContextCallbacks {
    return {
      snapshotActiveContext: () => getActiveContext()?.snapshotRuntime() ?? null,
      getTargetedAsteroidId: () => getActiveContext()?.getTargetedAsteroidId() ?? null,
      getHoveredAsteroidId: () => getActiveContext()?.getHoveredAsteroidId() ?? null,
      getHoveredScannableDebrisId: () => getActiveContext()?.getHoveredScannableDebrisId() ?? null,
      getHoveredScannableShipId: () => getActiveContext()?.getHoveredScannableShipId() ?? null,
    };
  }

  private createMissionStateCallbacks(
    getMissionGateState: () => ShipExteriorMissionGateState,
    resetMissionGateState: () => ShipExteriorMissionGateState,
  ): ShipExteriorBareSceneMissionStateCallbacks {
    return {
      formal: { getMissionGateState, resetMissionGateState },
      legacy: { getMissionGateState, resetMissionGateState },
    };
  }

  private registerApi(deps: ShipExteriorBareSceneTestApiFactoryDeps): void {
    unregisterShipExteriorBareSceneTestApi();
    registerShipExteriorBareSceneTestApi(
      createShipExteriorBareSceneTestApi(deps),
      environment.e2eTestApiEnabled && !environment.production,
    );
  }

  unregister(): void {
    unregisterShipExteriorBareSceneTestApi();
  }
}
