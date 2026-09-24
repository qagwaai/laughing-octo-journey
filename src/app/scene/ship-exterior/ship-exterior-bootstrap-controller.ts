import { type CelestialBodyListItem, type CelestialBodyListRequest, type CelestialBodyListResponse } from '../../model/celestial-body-list';
import { DEFAULT_SOLAR_SYSTEM_ID } from '../../model/celestial-body-upsert';
import { DEFAULT_CLUSTER_SPREAD_KM } from '../../model/math/celestial-body-location';
import type { Triple } from '../../model/shared/triple';
import type { ShipListByOwnerRequest, ShipListByOwnerResponse } from '../../model/ship-list-by-owner';
import { appLogger } from '../../services/logger';
import { SessionService } from '../../services/session.service';
import { ShipExteriorSocketService } from '../../services/ship-exterior-socket.service';
import { type ShipExteriorColdBootAsteroidSeedIntent } from './ship-exterior-cold-boot-asteroid-seed';

interface ShipExteriorBootstrapControllerDeps {
  missionId: string;
  sessionService: SessionService;
  socketService: ShipExteriorSocketService;
  getPlayerName: () => string;
  getCharacterId: () => string | null;
  getPreferredShipId: () => string | null;
  getLaunchSeedHint: () => number | null;
  updateTargetingCapabilityFromShipList: (ships: ShipListByOwnerResponse['ships']) => void;
  emitColdBootAsteroidSeedIntent: (intent: ShipExteriorColdBootAsteroidSeedIntent) => void;
  /** Sensor-array detection range, in km, for the currently active ship. */
  getDetectionRangeKm: () => number;
  /** Receives mission-agnostic local bodies resolved around the active ship. */
  emitLocalCelestialBodies: (result: ShipExteriorLocalBodiesResult) => void;
}

/**
 * Outcome of a mission-agnostic proximity sweep for celestial bodies near the
 * active ship. `bodies` is exactly what the backend returned - the scene never
 * fabricates contacts to pad an empty result.
 */
export interface ShipExteriorLocalBodiesResult {
  status: 'loaded' | 'empty' | 'unavailable';
  bodies: CelestialBodyListItem[];
  center: Triple | null;
  detectionRangeKm: number;
}

/**
 * Owns the ship-exterior asteroid bootstrap flow for both the new and resume
 * paths. The controller manages the socket subscriptions and emits explicit
 * seed intents when a cold-boot asteroid refresh is needed.
 */
export class ShipExteriorBootstrapController {
  private unsubscribeShipListResponse?: () => void;
  private unsubscribeCelestialBodyListResponse?: () => void;
  private unsubscribeLocalCelestialBodyListResponse?: () => void;
  /**
   * Signature of the local-bodies sweep currently awaiting a response.
   *
   * The scene triggers a sweep from both bootstrap and the active-ship effect, which can
   * fire in the same tick. Two concurrent requests would each attach their own correlated
   * listener, and every listener drops the other's response as unmatched - surfacing a
   * contract variance warning. Identical in-flight sweeps are therefore coalesced.
   */
  private pendingLocalSweepSignature: string | null = null;

  constructor(private readonly deps: ShipExteriorBootstrapControllerDeps) {}

  /**
   * Hydrates the scene with whatever celestial bodies the backend reports near the
   * active ship.
   *
   * Unlike {@link seedAsteroidsForInProgressMission}, this sweep is deliberately
   * mission-agnostic and owner-agnostic: it omits `missionId` and
   * `createdByCharacterId` so the pilot sees the real neighborhood rather than the
   * leftovers of one mission. The search radius is driven by the active ship's
   * sensor array tier.
   */
  loadLocalCelestialBodies(centerOverrideKm?: Triple | null): void {
    const playerName = this.deps.getPlayerName().trim();
    const sessionKey = this.deps.sessionService.getSessionKey()?.trim() ?? '';
    const detectionRangeKm = this.deps.getDetectionRangeKm();

    const resolveCenter = (): Triple | null => {
      if (centerOverrideKm) {
        return centerOverrideKm;
      }
      return this.deps.sessionService.activeShip()?.spatial?.positionKm ?? null;
    };

    const center = resolveCenter();
    if (!playerName || !sessionKey || !center) {
      this.deps.emitLocalCelestialBodies({
        status: 'unavailable',
        bodies: [],
        center: center ?? null,
        detectionRangeKm,
      });
      appLogger.warn('ShipExterior local bodies sweep skipped: missing identity or ship position.', {
        hasPlayerName: !!playerName,
        hasSessionKey: !!sessionKey,
        hasCenter: !!center,
      });
      return;
    }

    const solarSystemId =
      this.deps.sessionService.activeShip()?.spatial?.solarSystemId?.trim() || DEFAULT_SOLAR_SYSTEM_ID;

    const sweepSignature = `${solarSystemId}|${center.x},${center.y},${center.z}|${detectionRangeKm}`;
    if (this.pendingLocalSweepSignature === sweepSignature) {
      appLogger.info('ShipExterior local bodies sweep already in flight; coalescing duplicate request.', {
        sweepSignature,
      });
      return;
    }

    this.unsubscribeLocalCelestialBodyListResponse?.();
    this.pendingLocalSweepSignature = sweepSignature;

    const request: CelestialBodyListRequest = {
      playerName,
      sessionKey,
      solarSystemId,
      positionKm: center,
      distanceKm: detectionRangeKm,
      states: ['unscanned', 'active'],
    };

    this.unsubscribeLocalCelestialBodyListResponse = this.deps.socketService.listCelestialBodies(
      request,
      (response: CelestialBodyListResponse) => {
        this.pendingLocalSweepSignature = null;

        if (!response.success) {
          this.deps.emitLocalCelestialBodies({
            status: 'unavailable',
            bodies: [],
            center,
            detectionRangeKm,
          });
          appLogger.warn('ShipExterior local bodies sweep failed.', response.message);
          return;
        }

        const bodies = (response.celestialBodies ?? []).filter((body) => body.state !== 'destroyed');
        this.deps.emitLocalCelestialBodies({
          status: bodies.length > 0 ? 'loaded' : 'empty',
          bodies,
          center,
          detectionRangeKm,
        });
        appLogger.info('ShipExterior local bodies sweep complete.', {
          contacts: bodies.length,
          detectionRangeKm,
          centerKm: center,
        });
      },
    );
  }

  private normalizeShipId(value: string | undefined | null): string {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  private resolvePreferredShip(
    ships: ShipListByOwnerResponse['ships'],
  ): NonNullable<ShipListByOwnerResponse['ships']>[number] | undefined {
    const candidates = ships ?? [];
    if (candidates.length === 0) {
      return undefined;
    }

    const preferredShipId = this.normalizeShipId(this.deps.getPreferredShipId());
    if (!preferredShipId) {
      return candidates[0];
    }

    return candidates.find((ship) => this.normalizeShipId(ship.id) === preferredShipId) ?? candidates[0];
  }

  seedAsteroidsForInProgressMission(): void {
    const playerName = this.deps.getPlayerName().trim();
    const characterId = this.deps.getCharacterId()?.trim() ?? '';
    const sessionKey = this.deps.sessionService.getSessionKey()?.trim() ?? '';

    if (!playerName || !characterId || !sessionKey) {
      this.deps.emitColdBootAsteroidSeedIntent({ kind: 'fallback' });
      appLogger.info('ColdBootScan (in-progress) requested fallback asteroid seeding.');
      return;
    }

    this.unsubscribeShipListResponse?.();
    const shipRequest: ShipListByOwnerRequest = {
      playerName,
      sessionKey,
      owner: {
        ownerType: 'player-character',
        characterId,
      },
    };
    this.unsubscribeShipListResponse = this.deps.socketService.listShipsByOwner(
      shipRequest,
      (shipResponse: ShipListByOwnerResponse) => {
        if (shipResponse.success) {
          this.deps.updateTargetingCapabilityFromShipList(shipResponse.ships);
        }

        const preferredShip = shipResponse.success ? this.resolvePreferredShip(shipResponse.ships) : undefined;
        const center = preferredShip?.spatial?.positionKm;

        if (!center) {
          this.deps.emitColdBootAsteroidSeedIntent({ kind: 'fallback' });
          appLogger.warn('ColdBootScan (in-progress) ship missing location; requested fallback asteroid seeding.');
          return;
        }

        this.unsubscribeCelestialBodyListResponse?.();
        const cbRequest: CelestialBodyListRequest = {
          playerName,
          sessionKey,
          solarSystemId: DEFAULT_SOLAR_SYSTEM_ID,
          positionKm: center,
          distanceKm: DEFAULT_CLUSTER_SPREAD_KM * 2,
          states: ['unscanned', 'active'],
          createdByCharacterId: characterId,
          missionId: this.deps.missionId,
        };
        this.unsubscribeCelestialBodyListResponse = this.deps.socketService.listCelestialBodies(
          cbRequest,
          (cbResponse: CelestialBodyListResponse) => {
            this.deps.emitColdBootAsteroidSeedIntent({
              kind: 'resume',
              actor: {
                playerName,
                characterId,
                sessionKey,
              },
              context: {
                playerName,
                characterId,
                center,
                launchSeedHint: this.deps.getLaunchSeedHint(),
                existingBodies: cbResponse.success ? (cbResponse.celestialBodies ?? []) : [],
              },
            });
            appLogger.info('ColdBootScan (in-progress) requested resumed asteroid seeding.', {
              existing: cbResponse.success
                ? (cbResponse.celestialBodies ?? []).filter((body) => body.state !== 'destroyed').length
                : 0,
              centerKm: center,
            });
          },
        );
      },
    );
  }

  seedAsteroidsAroundStarterShip(): void {
    const playerName = this.deps.getPlayerName().trim();
    const characterId = this.deps.getCharacterId()?.trim() ?? '';
    const sessionKey = this.deps.sessionService.getSessionKey()?.trim() ?? '';

    if (!playerName || !characterId || !sessionKey) {
      this.deps.emitColdBootAsteroidSeedIntent({ kind: 'fallback' });
      appLogger.info('ColdBootScan requested fallback asteroid seeding.');
      return;
    }

    this.unsubscribeShipListResponse?.();
    const request: ShipListByOwnerRequest = {
      playerName,
      sessionKey,
      owner: {
        ownerType: 'player-character',
        characterId,
      },
    };
    this.unsubscribeShipListResponse = this.deps.socketService.listShipsByOwner(
      request,
      (response: ShipListByOwnerResponse) => {
        if (!response.success) {
          this.deps.emitColdBootAsteroidSeedIntent({ kind: 'fallback' });
          appLogger.warn(
            'ColdBootScan starter ship lookup failed; requested fallback asteroid seeding.',
            response.message,
          );
          return;
        }

        this.deps.updateTargetingCapabilityFromShipList(response.ships);

        const preferredShip = this.resolvePreferredShip(response.ships);
        const center = preferredShip?.spatial?.positionKm;
        if (!center) {
          this.deps.emitColdBootAsteroidSeedIntent({ kind: 'fallback' });
          appLogger.warn(
            'ColdBootScan ship list missing required spatial.positionKm; requested fallback asteroid seeding.',
          );
          return;
        }

        this.deps.emitColdBootAsteroidSeedIntent({
          kind: 'starter-ship',
          actor: {
            playerName,
            characterId,
            sessionKey,
          },
          context: {
            playerName,
            characterId,
            center,
            launchSeedHint: this.deps.getLaunchSeedHint(),
          },
        });
        appLogger.info('ColdBootScan requested starter-ship asteroid seeding.', {
          centerKm: center,
        });
      },
    );
  }

  dispose(): void {
    this.unsubscribeShipListResponse?.();
    this.unsubscribeCelestialBodyListResponse?.();
    this.unsubscribeLocalCelestialBodyListResponse?.();
    this.unsubscribeShipListResponse = undefined;
    this.unsubscribeCelestialBodyListResponse = undefined;
    this.unsubscribeLocalCelestialBodyListResponse = undefined;
    this.pendingLocalSweepSignature = null;
  }
}
