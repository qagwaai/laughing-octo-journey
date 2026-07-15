import { Injectable, signal } from '@angular/core';
import { resolveShipExteriorMission, type ShipExteriorMissionGateStepState } from '../mission/ship-exterior-mission';
import type { ShipExteriorMissionGateState } from '../mission/ship-exterior-mission';

/**
 * Storage key identity used for mission gate-state persistence.
 */
export interface ShipExteriorMissionStateContext {
  missionId: string;
  playerName: string;
  characterId: string;
}

@Injectable({
  providedIn: 'root',
})
/**
 * Persists and restores ship-exterior mission gate state from local storage.
 */
export class ShipExteriorMissionStateService {
  private static readonly STORAGE_PREFIX = 'ship-exterior-mission-state';

  private readonly _lastSaved = signal<ShipExteriorMissionGateState | null>(null);
  readonly lastSaved = this._lastSaved.asReadonly();

  /**
   * Loads mission state for the context, including fallback lookup by mission and character.
   */
  loadState(context: ShipExteriorMissionStateContext): ShipExteriorMissionGateState | null {
    const key = this.buildStorageKey(context);
    if (!key || typeof window === 'undefined' || !window.localStorage) {
      return null;
    }

    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = this.parseStoredState(raw, context);
      if (parsed) {
        return parsed;
      }
    }

    return this.loadFallbackStateByMissionAndCharacter(context);
  }

  private loadFallbackStateByMissionAndCharacter(
    context: ShipExteriorMissionStateContext,
  ): ShipExteriorMissionGateState | null {
    const missionId = context.missionId?.trim();
    const characterId = context.characterId?.trim();
    if (!missionId || !characterId) {
      return null;
    }

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (!key || !key.startsWith(`${ShipExteriorMissionStateService.STORAGE_PREFIX}::`)) {
        continue;
      }

      const [prefix, storedMissionId, _storedPlayerName, storedCharacterId] = key.split('::');
      if (
        prefix !== ShipExteriorMissionStateService.STORAGE_PREFIX ||
        storedMissionId !== missionId ||
        storedCharacterId !== characterId
      ) {
        continue;
      }

      const raw = window.localStorage.getItem(key);
      if (!raw) {
        continue;
      }

      const parsed = this.parseStoredState(raw, context);
      if (parsed) {
        return parsed;
      }
    }

    return null;
  }

  private parseStoredState(raw: string, context: ShipExteriorMissionStateContext): ShipExteriorMissionGateState | null {
    try {
      const parsed = JSON.parse(raw) as ShipExteriorMissionGateState;
      if (!parsed || typeof parsed !== 'object') {
        return null;
      }

      if (parsed.missionId !== context.missionId || parsed.characterId !== context.characterId) {
        return null;
      }

      if (!Array.isArray(parsed.steps)) {
        return null;
      }

      return this.normalizeStoredState(parsed);
    } catch {
      return null;
    }
  }

  private normalizeStoredState(state: ShipExteriorMissionGateState): ShipExteriorMissionGateState {
    const mission = resolveShipExteriorMission(state.missionId);
    if (!mission) {
      return state;
    }

    const stepDefinitions = mission.getGateStepDefinitions();
    const storedStepsByKey = new Map(state.steps.map((step) => [step.key, step] as const));
    const completedStepKeys = new Set(
      state.steps.filter((step) => step.status === 'completed' || step.status === 'pending-retry').map((step) => step.key),
    );

    const mergedSteps: ShipExteriorMissionGateStepState[] = stepDefinitions.map((definition) => {
      const storedStep = storedStepsByKey.get(definition.key);
      if (storedStep) {
        return { ...storedStep };
      }

      return {
        key: definition.key,
        status: definition.prerequisiteStepKeys?.every((key) => completedStepKeys.has(key)) ? 'active' : 'locked',
      };
    });

    return {
      ...state,
      activeObjectiveText: this.resolveObjectiveText(mergedSteps, stepDefinitions),
      steps: mergedSteps,
    };
  }

  private resolveObjectiveText(
    stepStates: readonly ShipExteriorMissionGateStepState[],
    stepDefinitions: NonNullable<ReturnType<typeof resolveShipExteriorMission>> extends infer Mission
      ? Mission extends { getGateStepDefinitions: () => infer Steps }
        ? Steps extends readonly (infer StepDefinition)[]
          ? readonly StepDefinition[]
          : never
        : never
      : never,
  ): string {
    const activeStep = stepDefinitions.find((step) => {
      const state = stepStates.find((candidate) => candidate.key === step.key);
      return state?.status === 'active';
    });

    if (activeStep) {
      return activeStep.objectiveText;
    }

    const pendingStep = stepDefinitions.find((step) => {
      const state = stepStates.find((candidate) => candidate.key === step.key);
      return state?.status === 'pending-retry';
    });
    if (pendingStep) {
      return `${pendingStep.objectiveText} (sync pending)`;
    }

    return 'Mission objectives complete. Await further directives.';
  }

  /**
   * Saves mission gate-state snapshot to local storage and updates the last-saved signal.
   */
  saveState(context: ShipExteriorMissionStateContext, state: ShipExteriorMissionGateState): void {
    const key = this.buildStorageKey(context);
    if (!key || typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    window.localStorage.setItem(key, JSON.stringify(state));
    this._lastSaved.set(state);
  }

  /**
   * Removes persisted mission state for the given context.
   */
  clearState(context: ShipExteriorMissionStateContext): void {
    const key = this.buildStorageKey(context);
    if (!key || typeof window === 'undefined' || !window.localStorage) {
      return;
    }

    window.localStorage.removeItem(key);
  }

  private buildStorageKey(context: ShipExteriorMissionStateContext): string | null {
    const missionId = context.missionId?.trim();
    const playerName = context.playerName?.trim();
    const characterId = context.characterId?.trim();
    if (!missionId || !playerName || !characterId) {
      return null;
    }

    return `${ShipExteriorMissionStateService.STORAGE_PREFIX}::${missionId}::${playerName}::${characterId}`;
  }
}
