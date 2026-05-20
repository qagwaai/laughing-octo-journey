/**
 * Mission initialization strategy contract.
 *
 * Each mission can declare how it should be initialized when entered from
 * various entry points (cold-boot, character-list join, ship-hangar). The
 * strategy is the source of truth for mission-specific initialization parameters
 * like damage presets, seed policies, and HUD configuration.
 *
 * Strategies are registered by mission ID and resolved by
 * MissionNavigationService to prepare navigation state without coupling
 * entry points to mission-specific knowledge.
 */

import type { ShipExteriorViewMissionContext } from '../../model/ship-exterior-view-context';
import type { ShipDamagePreset } from '../../model/ship-damage';
import type { MissionStatus } from '../../model/mission';

/**
 * Initialization parameters passed to a strategy to build mission context.
 */
export interface MissionInitializationParams {
  /**
   * Mission-agnostic mission ID (e.g., 'first-target', 'generic-exploration').
   */
  missionId: string;

  /**
   * The mission's current status (if known). Used to infer seed policy
   * when seedPolicy is 'auto'.
   */
  missionStatus?: MissionStatus | null;
}

/**
 * Mission-specific strategy for building initialization context.
 *
 * Implementations are provided by mission definitions (or mission metadata)
 * and should be registered via `registerMissionInitializationStrategy()`.
 */
export interface MissionInitializationStrategy {
  /**
   * Resolve a mission ID. Typically just echoes the input, but allows
   * strategies to normalize or override the mission ID if needed.
   */
  getMissionId(): string;

  /**
   * Build the mission context for ship-exterior-view. This includes:
   * - missionId
   * - missionStatusHint (optional: guides seed policy)
   * - seedPolicy (optional: 'new', 'resume', 'auto')
   * - shipDamagePreset (optional: mission-specific damage state)
   */
  buildMissionContext(params: MissionInitializationParams): ShipExteriorViewMissionContext;

  /**
   * Resolve the damage preset that should be applied to the ship when
   * entering this mission. Return undefined to skip damage preset.
   */
  resolveDamagePreset(params: MissionInitializationParams): ShipDamagePreset | undefined;
}

/**
 * Per-mission strategy registry. Strategies are registered once at module load time
 * and resolved by MissionNavigationService.
 *
 * Uses a lazy-initialization Map to avoid circular-import issues (similar to
 * the mission scene plugin registry pattern).
 */
let missionInitializationStrategies: Map<string, MissionInitializationStrategy> | null = null;

function getStrategyRegistry(): Map<string, MissionInitializationStrategy> {
  if (!missionInitializationStrategies) {
    missionInitializationStrategies = new Map();
  }
  return missionInitializationStrategies;
}

/**
 * Register a mission initialization strategy. Intended to be called from the
 * mission's own module at module-load time.
 *
 * @example
 * // In src/app/mission/first-target-ship-exterior-mission.ts
 * registerMissionInitializationStrategy(FIRST_TARGET_MISSION_ID, {
 *   getMissionId: () => FIRST_TARGET_MISSION_ID,
 *   buildMissionContext: (params) => ({
 *     missionId: params.missionId,
 *     missionStatusHint: params.missionStatus,
 *     seedPolicy: 'auto',
 *     shipDamagePreset: 'cold-boot-starter-damaged',
 *   }),
 *   resolveDamagePreset: () => 'cold-boot-starter-damaged',
 * });
 */
export function registerMissionInitializationStrategy(
  missionId: string,
  strategy: MissionInitializationStrategy,
): void {
  getStrategyRegistry().set(missionId, strategy);
}

/**
 * Resolve the initialization strategy for a given mission ID.
 * Falls back to a default strategy if no custom registration exists.
 */
export function resolveMissionInitializationStrategy(missionId?: string | null): MissionInitializationStrategy {
  const registry = getStrategyRegistry();
  const resolved = missionId ? registry.get(missionId) : null;

  if (resolved) {
    return resolved;
  }

  // Default strategy: minimal context, no damage preset
  return {
    getMissionId: () => missionId ?? 'unknown',
    buildMissionContext: (params) => ({
      missionId: params.missionId,
      seedPolicy: 'auto',
      ...(params.missionStatus ? { missionStatusHint: params.missionStatus } : {}),
    }),
    resolveDamagePreset: () => undefined,
  };
}
