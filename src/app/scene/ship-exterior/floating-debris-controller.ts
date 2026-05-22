import { appLogger } from '../../services/logger';
import { FloatingDebrisStateService } from '../../services/floating-debris-state.service';
import { ShipExteriorSocketService } from '../../services/ship-exterior-socket.service';
import { SessionService } from '../../services/session.service';
import type { FloatingDebrisItem } from '../../model/floating-debris-item';
import type { ItemListByLocationResponse } from '../../model/item-list-by-location';
import { DEFAULT_SOLAR_SYSTEM_ID } from '../../model/celestial-body-upsert';
import type { Triple } from '../../model/triple';

export const FLOATING_DEBRIS_RADIUS_KM = 50;
export const FLOATING_DEBRIS_POLL_INTERVAL_MS = 5_000;

const TRACTOR_BEAM_ITEM_TYPE = 'ship-tractor-beam';
const TRACTOR_BEAM_DISPLAY_NAME = 'Tractor Beam';

export interface FloatingDebrisControllerDeps {
  socketService: ShipExteriorSocketService;
  sessionService: SessionService;
  stateService: FloatingDebrisStateService;
  getPlayerName: () => string;
  getCharacterId: () => string | null;
  getActiveShipId: () => string | null;
  getShipPositionKm: () => Triple | null;
  getSolarSystemId: () => string;
  /** Injectable timer hooks for deterministic unit testing. */
  setInterval?: (handler: () => void, intervalMs: number) => number;
  clearInterval?: (handle: number) => void;
}

/**
 * Owns the location-based debris hydration for the ship-exterior scene.
 *
 * Phase 2 scope (only this mechanism is wired):
 *  - On scene enter, issue one `item-list-by-location` request around the ship.
 *  - Re-issue the same request on a low-frequency timer.
 *  - If a response returns no items, seed a single client-side Tractor Beam so
 *    cold-boot scenes always have one floating item available.
 */
export class FloatingDebrisController {
  private unsubscribeListResponse?: () => void;
  private pollHandle: number | null = null;
  private started = false;
  private hasIngestedAnyResponse = false;
  private hasSeededColdBoot = false;
  private static readonly COLD_BOOT_TRACTOR_BEAM_ID = 'local-cold-boot-ship-tractor-beam';

  constructor(private readonly deps: FloatingDebrisControllerDeps) {}

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.deps.stateService.clear();
    this.requestNearbyItems();

    const setIntervalFn = this.deps.setInterval ?? ((handler, interval) => window.setInterval(handler, interval));
    this.pollHandle = setIntervalFn(() => this.requestNearbyItems(), FLOATING_DEBRIS_POLL_INTERVAL_MS);
  }

  stop(): void {
    if (!this.started) {
      return;
    }
    this.started = false;
    this.hasIngestedAnyResponse = false;
    this.hasSeededColdBoot = false;
    this.unsubscribeListResponse?.();
    this.unsubscribeListResponse = undefined;
    if (this.pollHandle !== null) {
      const clearIntervalFn = this.deps.clearInterval ?? ((handle) => window.clearInterval(handle));
      clearIntervalFn(this.pollHandle);
      this.pollHandle = null;
    }
  }

  /** Exposed for tests; production code triggers this via start()/timer. */
  requestNearbyItems(): void {
    const playerName = this.deps.getPlayerName().trim();
    const shipId = this.deps.getActiveShipId()?.trim() ?? '';
    const sessionKey = this.deps.sessionService.getSessionKey()?.trim() ?? '';
    const positionKm = this.deps.getShipPositionKm();
    const solarSystemId = this.deps.getSolarSystemId().trim() || DEFAULT_SOLAR_SYSTEM_ID;

    // Proactive cold-boot seed: as soon as we have a ship position, drop a
    // local Tractor Beam into the scene so the player has something to
    // tractor-beam regardless of backend availability. Real server items will
    // replace it via handleListResponse when they arrive.
    if (positionKm && !this.hasSeededColdBoot && !this.hasIngestedAnyResponse) {
      this.seedColdBootTractorBeam(positionKm);
    }

    if (!playerName || !shipId || !sessionKey || !positionKm) {
      appLogger.debug?.('FloatingDebrisController skipped request (missing context)', {
        hasPlayerName: !!playerName,
        hasShipId: !!shipId,
        hasSessionKey: !!sessionKey,
        hasPosition: !!positionKm,
      });
      return;
    }

    this.unsubscribeListResponse?.();
    this.unsubscribeListResponse = this.deps.socketService.listNearbyDeployedItems(
      {
        sessionKey,
        playerName,
        shipId,
        location: {
          solarSystemId,
          positionKm: { x: positionKm.x, y: positionKm.y, z: positionKm.z },
        },
        maxDistanceKm: FLOATING_DEBRIS_RADIUS_KM,
      },
      (response) => this.handleListResponse(response, positionKm, solarSystemId),
    );
  }

  private handleListResponse(
    response: ItemListByLocationResponse,
    shipPositionKm: Triple,
    solarSystemId: string,
  ): void {
    if (!response.success) {
      appLogger.warn('FloatingDebrisController list response unsuccessful', { message: response.message });
      return;
    }

    const items = response.items ?? [];
    if (items.length > 0) {
      // Real server items take over; drop the local cold-boot seed if it's still around.
      if (this.hasSeededColdBoot) {
        this.deps.stateService.removeById(FloatingDebrisController.COLD_BOOT_TRACTOR_BEAM_ID);
      }
      this.deps.stateService.upsertFromShipItems(items);
      this.hasIngestedAnyResponse = true;
      return;
    }

    if (!this.hasSeededColdBoot && this.deps.stateService.getAll().length === 0) {
      this.seedColdBootTractorBeam(shipPositionKm);
    }
    this.hasIngestedAnyResponse = true;
  }

  private seedColdBootTractorBeam(shipPositionKm: Triple): void {
    if (this.hasSeededColdBoot) {
      return;
    }
    const tractorBeam: FloatingDebrisItem = {
      id: FloatingDebrisController.COLD_BOOT_TRACTOR_BEAM_ID,
      itemType: TRACTOR_BEAM_ITEM_TYPE,
      displayName: TRACTOR_BEAM_DISPLAY_NAME,
      positionKm: {
        x: shipPositionKm.x + 5,
        y: shipPositionKm.y,
        z: shipPositionKm.z + 5,
      },
    };
    this.deps.stateService.upsertLocal([tractorBeam]);
    this.hasSeededColdBoot = true;
    appLogger.info('FloatingDebrisController seeded cold-boot Tractor Beam', { id: tractorBeam.id });
  }
}
