import { type AsteroidHoverEvent } from '../../component/asteroid';
import {
  evaluateMissionGateOnDebrisCollection,
  evaluateMissionGateOnManufacture,
  evaluateMissionGateOnRepair,
  type ShipExteriorMissionDefinition,
  type ShipExteriorMissionGateState,
} from '../../mission/ship-exterior-mission';
import type { AsteroidScanSample } from '../../model/ship-exterior-asteroid-sample';
import { cloneForTest } from './ship-exterior-formatters';

interface ManufactureHookPayload {
  manufacturedItemType: string;
  gateState: ShipExteriorMissionGateState;
}

interface RepairHookPayload {
  repairKind: string;
  gateState: ShipExteriorMissionGateState;
}

export interface ShipExteriorViewTestApi {
  getMissionGateState(): ShipExteriorMissionGateState | null;
  getMissionObjectiveText(): string;
  getAsteroidSamples(): AsteroidScanSample[];
  getActiveShipInventoryItemTypes(): string[];
  getTargetedAsteroidId(): string | null;
  hoverAsteroid(sampleId: string): boolean;
  unhoverAsteroid(sampleId: string): boolean;
  forceTargetAsteroid(sampleId: string): boolean;
  tickScanTicks(ticks?: number): AsteroidScanSample[];
  forceCompleteIronScan(sampleId?: string): ShipExteriorMissionGateState | null;
  simulateDebrisCollection(remainingDebrisCount?: number): ShipExteriorMissionGateState | null;
  simulateManufacture(itemType: string): ShipExteriorMissionGateState | null;
  simulateRepair(repairKind: string): ShipExteriorMissionGateState | null;
  launchFromHotkey(hotkey: 1 | 2 | 3 | 4 | 5): void;
  clearToast(): void;
}

export interface RegisterShipExteriorTestUtilsContext {
  isProduction: boolean;
  missionDefinition: ShipExteriorMissionDefinition;
  getMissionGateState: () => ShipExteriorMissionGateState | null;
  setMissionGateState: (gateState: ShipExteriorMissionGateState) => void;
  persistMissionGateState: (gateState: ShipExteriorMissionGateState) => void;
  getMissionObjectiveText: () => string;
  getAsteroidSamples: () => AsteroidScanSample[];
  updateAsteroidSamples: (updater: (samples: AsteroidScanSample[]) => AsteroidScanSample[]) => void;
  getActiveShipInventoryItemTypes: () => string[];
  getTargetedAsteroidId: () => string | null;
  onAsteroidHoverChange: (event: AsteroidHoverEvent) => void;
  canTargetAsteroids: () => boolean;
  setTargetedAsteroidId: (sampleId: string) => void;
  tickScene: () => void;
  persistAsteroidSamples: () => void;
  evaluateMissionGateForCompletedSamples: (sampleIds: readonly string[]) => void;
  invokePluginOnManufacture: (payload: ManufactureHookPayload) => void;
  invokePluginOnRepair: (payload: RepairHookPayload) => void;
  launchFromHotkeySlot: (hotkey: 1 | 2 | 3 | 4 | 5) => void;
  clearLaunchToast: () => void;
}

declare global {
  interface Window {
    __shipExteriorTestUtils?: ShipExteriorViewTestApi;
  }
}

export function registerShipExteriorTestUtils(context: RegisterShipExteriorTestUtilsContext): void {
  if (context.isProduction || typeof window === 'undefined') {
    return;
  }

  window.__shipExteriorTestUtils = {
    getMissionGateState: () => {
      const gateState = context.getMissionGateState();
      return gateState ? cloneForTest(gateState) : null;
    },
    getMissionObjectiveText: () => context.getMissionObjectiveText(),
    getAsteroidSamples: () => cloneForTest(context.getAsteroidSamples()),
    getActiveShipInventoryItemTypes: () => context.getActiveShipInventoryItemTypes(),
    getTargetedAsteroidId: () => context.getTargetedAsteroidId(),
    hoverAsteroid: (sampleId: string) => {
      const exists = context.getAsteroidSamples().some((sample) => sample.id === sampleId);
      if (!exists) {
        return false;
      }
      context.onAsteroidHoverChange({ id: sampleId, hovering: true });
      return true;
    },
    unhoverAsteroid: (sampleId: string) => {
      const exists = context.getAsteroidSamples().some((sample) => sample.id === sampleId);
      if (!exists) {
        return false;
      }
      context.onAsteroidHoverChange({ id: sampleId, hovering: false });
      return true;
    },
    forceTargetAsteroid: (sampleId: string) => {
      const exists = context.getAsteroidSamples().some((sample) => sample.id === sampleId);
      if (!exists || !context.canTargetAsteroids()) {
        return false;
      }
      context.setTargetedAsteroidId(sampleId);
      return true;
    },
    tickScanTicks: (ticks: number = 1) => {
      const safeTicks = Math.max(1, Math.min(500, Math.floor(ticks)));
      for (let index = 0; index < safeTicks; index += 1) {
        context.tickScene();
      }
      return cloneForTest(context.getAsteroidSamples());
    },
    forceCompleteIronScan: (sampleId?: string) => {
      const targetId = sampleId ?? context.getAsteroidSamples()[0]?.id;
      if (!targetId) {
        return null;
      }

      let updated = false;
      context.updateAsteroidSamples((samples) =>
        samples.map((sample) => {
          if (sample.id !== targetId) {
            return sample;
          }
          updated = true;
          return {
            ...sample,
            scanProgress: 100,
            scanned: true,
            revealedMaterial: {
              rarity: 'Common',
              material: 'Iron',
              textureColor: '#8f8f8f',
            },
            revealedKinematics: sample.revealedKinematics ?? sample.capturedKinematics,
          };
        }),
      );

      if (!updated) {
        return context.getMissionGateState();
      }

      context.persistAsteroidSamples();
      context.evaluateMissionGateForCompletedSamples([targetId]);
      const gateState = context.getMissionGateState();
      return gateState ? cloneForTest(gateState) : null;
    },
    simulateManufacture: (itemType: string) => {
      const gateState = context.getMissionGateState();
      if (!gateState) {
        return null;
      }

      const evaluation = evaluateMissionGateOnManufacture({
        mission: context.missionDefinition,
        gateState,
        manufacturedItemType: itemType,
      });
      if (evaluation.changed) {
        context.setMissionGateState(evaluation.gateState);
        context.persistMissionGateState(evaluation.gateState);
        context.invokePluginOnManufacture({
          manufacturedItemType: itemType,
          gateState: evaluation.gateState,
        });
      }
      return cloneForTest(context.getMissionGateState());
    },
    simulateDebrisCollection: (remainingDebrisCount: number = 0) => {
      const gateState = context.getMissionGateState();
      if (!gateState) {
        return null;
      }

      const evaluation = evaluateMissionGateOnDebrisCollection({
        mission: context.missionDefinition,
        gateState,
        remainingDebrisCount,
      });
      if (evaluation.changed) {
        context.setMissionGateState(evaluation.gateState);
        context.persistMissionGateState(evaluation.gateState);
      }
      return cloneForTest(context.getMissionGateState());
    },
    simulateRepair: (repairKind: string) => {
      const gateState = context.getMissionGateState();
      if (!gateState) {
        return null;
      }

      const evaluation = evaluateMissionGateOnRepair({
        mission: context.missionDefinition,
        gateState,
        repairKind,
      });
      if (evaluation.changed) {
        context.setMissionGateState(evaluation.gateState);
        context.persistMissionGateState(evaluation.gateState);
        context.invokePluginOnRepair({ repairKind, gateState: evaluation.gateState });
      }
      return cloneForTest(context.getMissionGateState());
    },
    launchFromHotkey: (hotkey: 1 | 2 | 3 | 4 | 5) => {
      context.launchFromHotkeySlot(hotkey);
    },
    clearToast: () => {
      context.clearLaunchToast();
    },
  };
}

export function unregisterShipExteriorTestUtils(isProduction: boolean): void {
  if (isProduction || typeof window === 'undefined') {
    return;
  }

  if (window.__shipExteriorTestUtils) {
    delete window.__shipExteriorTestUtils;
  }
}
