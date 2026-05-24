import { DEFAULT_CLUSTER_SPREAD_KM } from '../../model/math/celestial-body-location';
import { type CelestialBodyListRequest, type CelestialBodyListResponse } from '../../model/celestial-body-list';
import type { AsteroidScanSample } from '../../model/ship-exterior-asteroid-sample';
import type { ShipListByOwnerRequest, ShipListByOwnerResponse } from '../../model/ship-list-by-owner';
import { appLogger } from '../../services/logger';
import { SessionService } from '../../services/session.service';
import { ShipExteriorSocketService } from '../../services/ship-exterior-socket.service';
import type { MissionScenePlugin } from '../../mission/mission-scene-plugin';
import { DEFAULT_SOLAR_SYSTEM_ID } from '../../model/celestial-body-upsert';

interface ShipExteriorBootstrapControllerDeps {
  missionId: string;
  sessionService: SessionService;
  socketService: ShipExteriorSocketService;
  getPlayerName: () => string;
  getCharacterId: () => string | null;
  getLaunchSeedHint: () => number | null;
  missionScenePlugin: MissionScenePlugin;
  setAsteroidSamples: (samples: AsteroidScanSample[]) => void;
  persistSeededAsteroidsAsUnscanned: (samples: readonly AsteroidScanSample[]) => void;
  updateTargetingCapabilityFromShipList: (ships: ShipListByOwnerResponse['ships']) => void;
}

/**
 * Owns the ship-exterior asteroid bootstrap flow for both the new and resume
 * paths. The controller manages the socket subscriptions and decides when to
 * fall back to seeded samples.
 */
export class ShipExteriorBootstrapController {
  private unsubscribeShipListResponse?: () => void;
  private unsubscribeCelestialBodyListResponse?: () => void;

  constructor(private readonly deps: ShipExteriorBootstrapControllerDeps) {}

  seedAsteroidsForInProgressMission(): void {
    const playerName = this.deps.getPlayerName().trim();
    const characterId = this.deps.getCharacterId()?.trim() ?? '';
    const sessionKey = this.deps.sessionService.getSessionKey()?.trim() ?? '';

    if (!playerName || !characterId || !sessionKey) {
      const samples = this.deps.missionScenePlugin.seedPolicy.createFallbackSamples();
      this.deps.setAsteroidSamples(samples);
      appLogger.info('ColdBootScan (in-progress) seeded asteroids with fallback random center.', {
        count: samples.length,
      });
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

        const firstShip = shipResponse.success ? shipResponse.ships?.[0] : undefined;
        const center = firstShip?.spatial?.positionKm;

        if (!center) {
          const fallbackSamples = this.deps.missionScenePlugin.seedPolicy.createFallbackSamples();
          this.deps.setAsteroidSamples(fallbackSamples);
          appLogger.warn('ColdBootScan (in-progress) ship missing location; using fallback random center.');
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
            const seededSamples = this.deps.missionScenePlugin.seedPolicy.createResumedSamples({
              playerName,
              characterId,
              center,
              launchSeedHint: this.deps.getLaunchSeedHint(),
              existingBodies: cbResponse.success ? (cbResponse.celestialBodies ?? []) : [],
            });

            this.deps.setAsteroidSamples(seededSamples);
            this.deps.persistSeededAsteroidsAsUnscanned(seededSamples);
            appLogger.info('ColdBootScan (in-progress) seeded with existing and top-up asteroids.', {
              existing: cbResponse.success
                ? (cbResponse.celestialBodies ?? []).filter((body) => body.state !== 'destroyed').length
                : 0,
              total: seededSamples.length,
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
      const samples = this.deps.missionScenePlugin.seedPolicy.createFallbackSamples();
      this.deps.setAsteroidSamples(samples);
      appLogger.info('ColdBootScan seeded asteroids with fallback random center.', { count: samples.length });
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
          const fallbackSamples = this.deps.missionScenePlugin.seedPolicy.createFallbackSamples();
          this.deps.setAsteroidSamples(fallbackSamples);
          appLogger.warn('ColdBootScan starter ship lookup failed; using fallback random center.', response.message);
          return;
        }

        this.deps.updateTargetingCapabilityFromShipList(response.ships);

        const firstShip = response.ships?.[0];
        const center = firstShip?.spatial?.positionKm;
        if (!center) {
          const fallbackSamples = this.deps.missionScenePlugin.seedPolicy.createFallbackSamples();
          this.deps.setAsteroidSamples(fallbackSamples);
          appLogger.warn('ColdBootScan ship list missing required spatial.positionKm; using fallback random center.');
          return;
        }

        const samples = this.deps.missionScenePlugin.seedPolicy.createNewSamples({
          playerName,
          characterId,
          center,
          launchSeedHint: this.deps.getLaunchSeedHint(),
        });
        this.deps.setAsteroidSamples(samples);
        this.deps.persistSeededAsteroidsAsUnscanned(samples);
        appLogger.info('ColdBootScan seeded asteroids around starter ship center.', {
          count: samples.length,
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