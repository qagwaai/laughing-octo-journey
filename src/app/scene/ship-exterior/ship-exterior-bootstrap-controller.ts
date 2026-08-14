import { DEFAULT_CLUSTER_SPREAD_KM } from '../../model/math/celestial-body-location';
import { type CelestialBodyListRequest, type CelestialBodyListResponse } from '../../model/celestial-body-list';
import type { ShipListByOwnerRequest, ShipListByOwnerResponse } from '../../model/ship-list-by-owner';
import { appLogger } from '../../services/logger';
import { SessionService } from '../../services/session.service';
import { ShipExteriorSocketService } from '../../services/ship-exterior-socket.service';
import { DEFAULT_SOLAR_SYSTEM_ID } from '../../model/celestial-body-upsert';
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
}

/**
 * Owns the ship-exterior asteroid bootstrap flow for both the new and resume
 * paths. The controller manages the socket subscriptions and emits explicit
 * seed intents when a cold-boot asteroid refresh is needed.
 */
export class ShipExteriorBootstrapController {
  private unsubscribeShipListResponse?: () => void;
  private unsubscribeCelestialBodyListResponse?: () => void;

  constructor(private readonly deps: ShipExteriorBootstrapControllerDeps) {}

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
          appLogger.warn('ColdBootScan starter ship lookup failed; requested fallback asteroid seeding.', response.message);
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
    this.unsubscribeShipListResponse = undefined;
    this.unsubscribeCelestialBodyListResponse = undefined;
  }
}