import { Injectable, inject } from '@angular/core';
import type { ShipSummary } from '../model/ship-list';
import type { SpatialState } from '../model/spatial';
import type { Triple } from '../model/triple';
import { appLogger } from './logger';
import { SessionService } from './session.service';
import { SocketService } from './socket.service';

const ACTIVE_FLIGHT_SAVE_INTERVAL_MS = 2_000;
const MOVEMENT_STOP_FLUSH_DELAY_MS = 500;

interface PendingShipPosition {
  playerName: string;
  characterId: string;
  shipId: string;
  sessionKey: string;
  spatial: SpatialState;
}

export interface QueueShipFlightPositionInput {
  playerName: string;
  characterId: string;
  shipId: string;
  positionKm: Triple;
}

@Injectable({ providedIn: 'root' })
export class ShipFlightPositionPersistenceService {
  private readonly sessionService = inject(SessionService);
  private readonly socketService = inject(SocketService);

  private pending: PendingShipPosition | null = null;
  private inFlight: Promise<void> | null = null;
  private throttleTimer: ReturnType<typeof setTimeout> | null = null;
  private trailingFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private lastSaveStartedAt = Number.NEGATIVE_INFINITY;

  queuePosition(input: QueueShipFlightPositionInput): void {
    const activeShip = this.sessionService.activeShip();
    const sessionKey = this.sessionService.getSessionKey()?.trim() ?? '';
    const playerName = input.playerName.trim();
    const characterId = input.characterId.trim();
    const shipId = input.shipId.trim();
    if (!activeShip || activeShip.id.trim() !== shipId || !sessionKey || !playerName || !characterId) {
      appLogger.warn('Ship flight position persistence skipped: missing active ship identity.');
      return;
    }

    const spatial: SpatialState = {
      ...activeShip.spatial,
      positionKm: { ...input.positionKm },
      epochMs: Date.now(),
    };
    this.sessionService.forceUpdateActiveShipSpatial(shipId, spatial);
    this.pending = { playerName, characterId, shipId, sessionKey, spatial };

    this.scheduleMovementStopFlush();
    this.scheduleThrottledSave();
  }

  async flushPending(): Promise<void> {
    this.clearTimer('throttle');
    this.clearTimer('trailing');

    if (this.inFlight) {
      await this.inFlight;
    }

    if (this.pending) {
      await this.persistPending();
    }
  }

  private scheduleMovementStopFlush(): void {
    this.clearTimer('trailing');
    this.trailingFlushTimer = setTimeout(() => {
      this.trailingFlushTimer = null;
      void this.flushPending().catch((error: unknown) => {
        appLogger.error('Failed to persist ship position after movement stopped.', error);
      });
    }, MOVEMENT_STOP_FLUSH_DELAY_MS);
  }

  private scheduleThrottledSave(): void {
    if (this.inFlight || this.throttleTimer) {
      return;
    }

    const delayMs = Math.max(0, ACTIVE_FLIGHT_SAVE_INTERVAL_MS - (Date.now() - this.lastSaveStartedAt));
    if (delayMs === 0) {
      void this.persistPending().catch((error: unknown) => {
        appLogger.error('Failed to persist throttled ship position.', error);
      });
      return;
    }

    this.throttleTimer = setTimeout(() => {
      this.throttleTimer = null;
      void this.persistPending().catch((error: unknown) => {
        appLogger.error('Failed to persist throttled ship position.', error);
      });
    }, delayMs);
  }

  private persistPending(): Promise<void> {
    if (this.inFlight) {
      return this.inFlight;
    }

    const update = this.pending;
    if (!update) {
      return Promise.resolve();
    }

    this.pending = null;
    this.lastSaveStartedAt = Date.now();
    const requestShip: Pick<ShipSummary, 'id' | 'spatial'> = {
      id: update.shipId,
      spatial: update.spatial,
    };

    const operation = new Promise<void>((resolve, reject) => {
      this.socketService.upsertShip(
        {
          playerName: update.playerName,
          characterId: update.characterId,
          sessionKey: update.sessionKey,
          correlationSource: 'ship-flight-position-persistence',
          ship: requestShip,
        },
        (response) => {
          if (!response.success) {
            this.restoreFailedUpdate(update);
            reject(new Error(response.message || 'The backend rejected the ship location update.'));
            return;
          }

          const hasNewerPendingUpdate = this.pending?.shipId === update.shipId;
          if (!hasNewerPendingUpdate) {
            const persistedSpatial = response.ship?.spatial ?? update.spatial;
            this.sessionService.forceUpdateActiveShipSpatial(update.shipId, persistedSpatial);
          }
          resolve();
        },
        () => {
          this.restoreFailedUpdate(update);
          reject(new Error('Timed out while saving the ship location.'));
        },
      );
    }).finally(() => {
      if (this.inFlight === operation) {
        this.inFlight = null;
      }
      if (this.pending) {
        this.scheduleThrottledSave();
      }
    });

    this.inFlight = operation;
    return operation;
  }

  private restoreFailedUpdate(failedUpdate: PendingShipPosition): void {
    if (!this.pending) {
      this.pending = failedUpdate;
    }
  }

  private clearTimer(kind: 'throttle' | 'trailing'): void {
    const timer = kind === 'throttle' ? this.throttleTimer : this.trailingFlushTimer;
    if (timer) {
      clearTimeout(timer);
    }
    if (kind === 'throttle') {
      this.throttleTimer = null;
    } else {
      this.trailingFlushTimer = null;
    }
  }
}
