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

const SENSOR_ARRAY_ITEM_TYPE = 'sensor_array';
const SENSOR_ARRAY_DISPLAY_NAME = 'Sensor Array';

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
 *  - If a response returns no items, seed a single client-side Sensor Array so
 *    cold-boot scenes always have one floating item available.
 */
export class FloatingDebrisController {
  private unsubscribeListResponse?: () => void;
  private pollHandle: number | null = null;
  private started = false;
  private hasIngestedAnyResponse = false;

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
      this.deps.stateService.upsertFromShipItems(items);
      this.hasIngestedAnyResponse = true;
      return;
    }

    if (!this.hasIngestedAnyResponse && this.deps.stateService.getAll().length === 0) {
      this.seedColdBootSensorArray(shipPositionKm, solarSystemId);
    }
    this.hasIngestedAnyResponse = true;
  }

  private seedColdBootSensorArray(shipPositionKm: Triple, _solarSystemId: string): void {
    const sensorArray: FloatingDebrisItem = {
      id: `local-sensor-array-${Date.now()}`,
      itemType: SENSOR_ARRAY_ITEM_TYPE,
      displayName: SENSOR_ARRAY_DISPLAY_NAME,
      positionKm: {
        x: shipPositionKm.x + 5,
        y: shipPositionKm.y,
        z: shipPositionKm.z + 5,
      },
    };
    this.deps.stateService.upsertLocal([sensorArray]);
    appLogger.info('FloatingDebrisController seeded cold-boot Sensor Array', { id: sensorArray.id });
  }
}
