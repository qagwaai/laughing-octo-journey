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

interface MissionProgressUpsertPayload {
  gateState: ShipExteriorMissionGateState;
  completedStepKey: string | null;
  toastMessage: string | null;
}

export interface ShipExteriorViewTestApi {
  getMissionGateState(): ShipExteriorMissionGateState | null;
  setMissionGateState(gateState: ShipExteriorMissionGateState): void;
  refreshMissionGateStateFromBackend(): Promise<void>;
  getMissionObjectiveText(): string;
  getAsteroidSamples(): AsteroidScanSample[];
  setAsteroidSamples(samples: AsteroidScanSample[]): void;
  getActiveShipInventoryItemTypes(): string[];
  getActiveShipLocationKm(): { x: number; y: number; z: number } | null;
  getCharacterName(): string;
  getRouteFeedCounts(): { gates: number; stations: number; encounterShips: number };
  getLaunchHotkeySlots(): Array<{ hotkey: 1 | 2 | 3 | 4 | 5; label: string; enabled: boolean; launching: boolean; itemType: string | null }>;
  getActiveSensorArrayTier(): number | null;
  getTargetedAsteroidId(): string | null;
  getTargetHoldCandidateId(): string | null;
  setTargetedAsteroidId(sampleId: string | null): void;
  getActiveScanAsteroidId(): string | null;
  getScanStatusLine(): string;
  getSw13DebugText(): {
    seed: string;
    tier: string;
    generator: string;
    bundleHash: string;
    profilePreset: string;
    surfaces: string;
    validation: string;
    paritySummary: string;
  };
  getActiveLaunchToast(): { message: string; tone: string } | null;
  hoverAsteroid(sampleId: string): boolean;
  unhoverAsteroid(sampleId: string): boolean;
  beginAsteroidTargetHold(sampleId: string): boolean;
  forceTargetAsteroid(sampleId: string): boolean;
  simulateShipListTargetingCapabilityUpdate(ships: unknown[] | undefined): void;
  tickScanTicks(ticks?: number): AsteroidScanSample[];
  forceCompleteIronScan(sampleId?: string): ShipExteriorMissionGateState | null;
  simulateDebrisCollection(remainingDebrisCount?: number): ShipExteriorMissionGateState | null;
  simulateManufacture(itemType: string): ShipExteriorMissionGateState | null;
  simulateRepair(repairKind: string): ShipExteriorMissionGateState | null;
  simulateLaunchItemResponse(response: unknown): void;
  launchFromHotkey(hotkey: 1 | 2 | 3 | 4 | 5): void;
  clearToast(): void;
}

export interface RegisterShipExteriorTestUtilsContext {
  isProduction: boolean;
  missionDefinition: ShipExteriorMissionDefinition;
  getMissionGateState: () => ShipExteriorMissionGateState | null;
  setMissionGateState: (gateState: ShipExteriorMissionGateState) => void;
  refreshMissionGateStateFromBackend: () => Promise<void>;
  persistMissionGateState: (gateState: ShipExteriorMissionGateState) => void;
  getMissionObjectiveText: () => string;
  getAsteroidSamples: () => AsteroidScanSample[];
  setAsteroidSamples: (samples: AsteroidScanSample[]) => void;
  updateAsteroidSamples: (updater: (samples: AsteroidScanSample[]) => AsteroidScanSample[]) => void;
  getActiveShipInventoryItemTypes: () => string[];
  getActiveShipLocationKm: () => { x: number; y: number; z: number } | null;
  getCharacterName: () => string;
  getRouteFeedCounts: () => { gates: number; stations: number; encounterShips: number };
  getLaunchHotkeySlots: () => Array<{ hotkey: 1 | 2 | 3 | 4 | 5; label: string; enabled: boolean; launching: boolean; itemType: string | null }>;
  getActiveSensorArrayTier: () => number | null;
  getTargetedAsteroidId: () => string | null;
  getTargetHoldCandidateId: () => string | null;
  setTargetedAsteroidId: (sampleId: string | null) => void;
  getActiveScanAsteroidId: () => string | null;
  getScanStatusLine: () => string;
  getSw13DebugText: () => {
    seed: string;
    tier: string;
    generator: string;
    bundleHash: string;
    profilePreset: string;
    surfaces: string;
    validation: string;
    paritySummary: string;
  };
  getActiveLaunchToast: () => { message: string; tone: string } | null;
  onAsteroidHoverChange: (event: AsteroidHoverEvent) => void;
  onAsteroidRightPointerDown: (event: { id: string; button: number }) => void;
  canTargetAsteroids: () => boolean;
  updateTargetingCapabilityFromShipList: (ships: unknown[] | undefined) => void;
  tickScene: () => void;
  persistAsteroidSamples: () => void;
  evaluateMissionGateForCompletedSamples: (sampleIds: readonly string[]) => void;
  enqueueMissionProgressUpsert: (payload: MissionProgressUpsertPayload) => void;
  invokePluginOnManufacture: (payload: ManufactureHookPayload) => void;
  invokePluginOnRepair: (payload: RepairHookPayload) => void;
  handleLaunchItemResponse: (response: unknown) => void;
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
    setMissionGateState: (gateState: ShipExteriorMissionGateState) => {
      context.setMissionGateState(cloneForTest(gateState));
    },
    refreshMissionGateStateFromBackend: async () => {
      await context.refreshMissionGateStateFromBackend();
    },
    getMissionObjectiveText: () => context.getMissionObjectiveText(),
    getAsteroidSamples: () => cloneForTest(context.getAsteroidSamples()),
    setAsteroidSamples: (samples: AsteroidScanSample[]) => context.setAsteroidSamples(cloneForTest(samples)),
    getActiveShipInventoryItemTypes: () => context.getActiveShipInventoryItemTypes(),
    getActiveShipLocationKm: () => {
      const location = context.getActiveShipLocationKm();
      return location ? cloneForTest(location) : null;
    },
    getCharacterName: () => context.getCharacterName(),
    getRouteFeedCounts: () => context.getRouteFeedCounts(),
    getLaunchHotkeySlots: () => cloneForTest(context.getLaunchHotkeySlots()),
    getActiveSensorArrayTier: () => context.getActiveSensorArrayTier(),
    getTargetedAsteroidId: () => context.getTargetedAsteroidId(),
    getTargetHoldCandidateId: () => context.getTargetHoldCandidateId(),
    setTargetedAsteroidId: (sampleId: string | null) => context.setTargetedAsteroidId(sampleId),
    getActiveScanAsteroidId: () => context.getActiveScanAsteroidId(),
    getScanStatusLine: () => context.getScanStatusLine(),
    getSw13DebugText: () => cloneForTest(context.getSw13DebugText()),
    getActiveLaunchToast: () => {
      const toast = context.getActiveLaunchToast();
      return toast ? cloneForTest(toast) : null;
    },
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
    beginAsteroidTargetHold: (sampleId: string) => {
      const exists = context.getAsteroidSamples().some((sample) => sample.id === sampleId);
      if (!exists) {
        return false;
      }
      context.onAsteroidRightPointerDown({ id: sampleId, button: 2 });
      return context.getTargetHoldCandidateId() === sampleId;
    },
    forceTargetAsteroid: (sampleId: string) => {
      const exists = context.getAsteroidSamples().some((sample) => sample.id === sampleId);
      if (!exists || !context.canTargetAsteroids()) {
        return false;
      }
      context.setTargetedAsteroidId(sampleId);
      return true;
    },
    simulateShipListTargetingCapabilityUpdate: (ships: unknown[] | undefined) => {
      context.updateTargetingCapabilityFromShipList(cloneForTest(ships));
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
        context.enqueueMissionProgressUpsert({
          gateState: evaluation.gateState,
          completedStepKey: evaluation.completedStepKey,
          toastMessage: evaluation.completionToastMessage,
        });
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
        context.enqueueMissionProgressUpsert({
          gateState: evaluation.gateState,
          completedStepKey: evaluation.completedStepKey,
          toastMessage: evaluation.completionToastMessage,
        });
        context.invokePluginOnRepair({ repairKind, gateState: evaluation.gateState });
      }
      return cloneForTest(context.getMissionGateState());
    },
    simulateLaunchItemResponse: (response: unknown) => {
      context.handleLaunchItemResponse(cloneForTest(response));
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
