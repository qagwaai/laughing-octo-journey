/**
 * Mission navigation service orchestrator.
 *
 * Prepares complete navigation state for mission entry points by:
 * 1. Resolving mission-specific initialization strategy
 * 2. Building mission context (missionId, seedPolicy, damagePreset, etc.)
 * 3. Fetching the active ship from backend
 * 4. Assembling the complete router navigation state
 *
 * This centralizes mission-aware navigation logic so entry points
 * (cold-boot, character-list, ship-hangar) can delegate to this service
 * instead of duplicating context-building logic.
 */

import { Injectable, inject } from '@angular/core';
import { resolveActiveShipSelection } from '../../model/active-ship-selection';
import type { PlayerCharacterSummary } from '../../model/character-list';
import type { ShipListByOwnerRequest, ShipListByOwnerResponse } from '../../model/ship-list-by-owner';
import type { ShipExteriorViewMissionContext } from '../../model/ship-exterior-view-context';
import type { ShipSummary } from '../../model/ship-list';
import type { MissionStatus } from '../../model/mission';
import { SessionService } from '../session.service';
import { ShipService } from '../ship.service';
import { appLogger } from '../logger';
import {
  resolveMissionInitializationStrategy,
  type MissionInitializationStrategy,
} from './mission-initialization-strategy';

/**
 * Input context for preparing mission navigation.
 */
export interface MissionNavigationContext {
  /** Mission ID (e.g., 'first-target', 'generic-exploration'). */
  missionId?: string | null;
  /** Player name from session or navigation state. */
  playerName: string;
  /** Character being joined or played. */
  joinCharacter: PlayerCharacterSummary;
  /** Session key for backend requests. */
  sessionKey: string;
  /** Optional: current mission status to guide seed policy. */
  missionStatus?: MissionStatus | null;
}

/**
 * Complete navigation state prepared for ship-exterior-view entry points.
 */
export interface PreparedMissionNavigationState {
  /** Player name for session context. */
  playerName: string;
  /** Character being joined. */
  joinCharacter: PlayerCharacterSummary;
  /** Active ship fetched from backend. */
  joinShip?: ShipSummary;
  /** Mission context for ship-exterior-view seeding and behavior. */
  missionContext: ShipExteriorViewMissionContext;
  /** Backward compatibility: legacy mission status hint. */
  firstTargetMissionStatus?: MissionStatus;
}

/**
 * Result of attempting to fetch a ship from backend.
 */
interface ShipFetchResult {
  ship: ShipSummary | null;
  success: boolean;
  message?: string;
}

@Injectable({
  providedIn: 'root',
})
/**
 * Orchestrates mission initialization and navigation state preparation.
 */
export class MissionNavigationService {
  private sessionService = inject(SessionService);
  private shipService = inject(ShipService);

  /**
   * Prepares complete navigation state for mission entry points.
   *
   * Resolves the mission's initialization strategy, builds the mission context,
   * fetches the active ship from backend, and assembles the router state.
   *
   * @param context Mission navigation context (mission ID, player name, character, etc.)
   * @returns Promise resolving to prepared navigation state
   * @throws Will log warnings but not throw; returns fallback state on fetch failures
   */
  async prepareNavigation(context: MissionNavigationContext): Promise<PreparedMissionNavigationState> {
    const missionId = context.missionId?.trim() ?? '';
    const playerName = context.playerName.trim();
    const characterId = context.joinCharacter?.id?.trim() ?? '';

    // Validate input
    if (!playerName || !characterId) {
      appLogger.warn('MissionNavigationService.prepareNavigation: missing playerName or characterId');
      return this.buildFallbackState(context);
    }

    // Resolve mission strategy and build mission context
    const strategy = resolveMissionInitializationStrategy(missionId);
    const missionContext = strategy.buildMissionContext({
      missionId: strategy.getMissionId(),
      missionStatus: context.missionStatus,
    });

    // Fetch the real ship from backend
    const shipFetchResult = await this.fetchActiveShip(
      playerName,
      characterId,
      context.sessionKey,
    );

    // Build navigation state
    const navigationState: PreparedMissionNavigationState = {
      playerName,
      joinCharacter: context.joinCharacter,
      ...(shipFetchResult.ship ? { joinShip: shipFetchResult.ship } : {}),
      missionContext,
      // Backward compatibility: include legacy status hint for in-progress missions
      ...(context.missionStatus ? { firstTargetMissionStatus: context.missionStatus } : {}),
    };

    // If ship fetch failed, log warning but continue (scene handles missing ship)
    if (!shipFetchResult.success) {
      appLogger.warn(
        'MissionNavigationService: ship fetch failed, proceeding without active ship:',
        shipFetchResult.message,
      );
    }

    return navigationState;
  }

  /**
   * Fetches the active ship from backend via ShipService.
   * @private
   */
  private async fetchActiveShip(
    playerName: string,
    characterId: string,
    sessionKey: string,
  ): Promise<ShipFetchResult> {
    if (!sessionKey.trim()) {
      return { ship: null, success: false, message: 'missing-session-key' };
    }

    return new Promise<ShipFetchResult>((resolve) => {
      const request: ShipListByOwnerRequest = {
        playerName,
        sessionKey,
        owner: {
          ownerType: 'player-character',
          characterId,
        },
      };

      this.shipService.listShipsByOwner(
        request,
        (response: ShipListByOwnerResponse) => {
          if (response.success) {
            const selectedShip = resolveActiveShipSelection({
              ships: response.ships ?? [],
              sessionActiveShipId: this.sessionService.activeShip()?.id,
            });

            if (selectedShip.ship) {
              const ship = selectedShip.ship;
              this.sessionService.setActiveShip(ship);
              resolve({ ship, success: true });
              return;
            }

            appLogger.log(
              'MissionNavigationService.fetchActiveShip: hard fail selecting ship with usable spatial data',
              {
                reason: selectedShip.reason,
                playerName,
                characterId,
              },
            );
            resolve({
              ship: null,
              success: false,
              message: selectedShip.reason,
            });
            return;
          }

          resolve({
            ship: null,
            success: false,
            message: response.message || 'ship-list-failed',
          });
        },
      );
    });
  }

  /**
   * Builds a fallback navigation state when input validation fails.
   * @private
   */
  private buildFallbackState(context: MissionNavigationContext): PreparedMissionNavigationState {
    const strategy = resolveMissionInitializationStrategy(context.missionId);
    return {
      playerName: context.playerName,
      joinCharacter: context.joinCharacter,
      missionContext: strategy.buildMissionContext({
        missionId: strategy.getMissionId(),
        missionStatus: context.missionStatus,
      }),
    };
  }
}
