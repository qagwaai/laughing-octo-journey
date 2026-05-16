import { DEFAULT_CLUSTER_SPREAD_KM } from '../../model/math/celestial-body-location';
import { generateDeterministicStarterShipUpdate } from '../../model/domain/starter-ship';
import { isValidShipSpatial } from '../../model/math/spatial';
import type { MarketListByLocationRequest, MarketListByLocationResponse, MarketSummary } from '../../model/market-list';
import type { SolarSystemGetResponse, ViewerBody } from '../../model/solar-system-get';
import type { ShipSummary, ShipListRequest, ShipListResponse } from '../../model/ship-list';
import type { ShipUpsertRequest, ShipUpsertResponse } from '../../model/ship-upsert';
import { appLogger } from '../../services/logger';
import { MarketService } from '../../services/market.service';
import { ShipService } from '../../services/ship.service';
import { SocketService } from '../../services/socket.service';
import { SolarSystemService } from '../../services/solar-system.service';
import type { SessionService } from '../../services/session.service';
import type { SolarSystemSummary } from '../../model/solar-system-list';

interface ViewerDataFacadeDeps {
  solarSystemService: SolarSystemService;
  marketService: MarketService;
  shipService: ShipService;
  socketService: SocketService;
  getPlayerName: () => string;
  getSessionKey: () => string | null;
  getActiveCharacterId: () => string | null;
  getCurrentSolarSystemId: () => string | null;
  getBodies: () => readonly ViewerBody[];
  setSolarSystem: (solarSystem: SolarSystemSummary | null) => void;
  setBodies: (bodies: ViewerBody[]) => void;
  setShips: (ships: ShipSummary[]) => void;
  setIsLoading: (value: boolean) => void;
  setSceneError: (value: string | null) => void;
  resetSelectionState: () => void;
}

function normalizeToken(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

const VIEWER_MARKET_DISCOVERY_DISTANCE_AU = 200;
const VIEWER_MARKET_DISCOVERY_LIMIT = 250;

export class ViewerDataFacade {
  private lastLoadedSystemId: string | null = null;
  private repairedShipIds = new Set<string>();

  constructor(private readonly deps: ViewerDataFacadeDeps) {}

  loadSystem(solarSystemId: string): void {
    const playerName = this.deps.getPlayerName();
    const sessionKey = this.deps.getSessionKey();
    if (!playerName || !sessionKey || !solarSystemId) {
      this.deps.setSceneError('viewer-scene-error missing-session');
      return;
    }

    if (solarSystemId === this.lastLoadedSystemId) {
      return;
    }

    this.lastLoadedSystemId = solarSystemId;
    this.deps.setIsLoading(true);
    this.deps.setSceneError(null);

    this.deps.solarSystemService.getSolarSystem(
      { playerName, sessionKey, solarSystemId },
      (response: SolarSystemGetResponse) => {
        this.deps.setIsLoading(false);
        if (!response.success) {
          this.deps.setSceneError(`viewer-scene-error ${response.message ?? 'unknown-error'}`);
          return;
        }

        this.deps.setSolarSystem(response.solarSystem ?? null);
        const allBodies = [...(response.stars ?? []), ...(response.bodies ?? [])];
        const dedupedBodies = this.mergeUniqueBodies(allBodies);
        this.deps.setBodies(dedupedBodies);
        this.deps.resetSelectionState();
        this.maybeHydrateMarketStations(dedupedBodies, playerName, sessionKey, solarSystemId);
        this.loadShipsForSystem(playerName, sessionKey, solarSystemId);
      },
    );
  }

  dispose(): void {
  }

  private mergeUniqueBodies(bodies: ViewerBody[]): ViewerBody[] {
    const dedupedBodies: ViewerBody[] = [];
    const seenBodyIds = new Set<string>();
    for (const body of bodies) {
      if (seenBodyIds.has(body.id)) {
        continue;
      }
      seenBodyIds.add(body.id);
      dedupedBodies.push(body);
    }
    return dedupedBodies;
  }

  private toViewerMarketStationBody(market: MarketSummary): ViewerBody {
    const displayName = market.siteName?.trim() || market.marketName?.trim() || market.marketId;
    return {
      id: market.marketId,
      bodyType: 'station',
      stationKind: 'market',
      displayName,
      spatial: market.spatial,
      orbitalElements: market.trajectory?.orbit,
    };
  }

  private maybeHydrateMarketStations(
    baseBodies: ViewerBody[],
    playerName: string,
    sessionKey: string,
    solarSystemId: string,
  ): void {
    const hasStationBodies = baseBodies.some((body) => normalizeToken(body.bodyType) === 'station');
    if (hasStationBodies) {
      return;
    }

    const firstStar = baseBodies.find((body) => normalizeToken(body.bodyType) === 'star');
    const positionKm = firstStar?.spatial.positionKm ?? { x: 0, y: 0, z: 0 };

    const request: MarketListByLocationRequest = {
      playerName,
      sessionKey,
      solarSystemId,
      positionKm,
      distanceAu: VIEWER_MARKET_DISCOVERY_DISTANCE_AU,
      limit: VIEWER_MARKET_DISCOVERY_LIMIT,
      locationTypes: ['station', 'free-floating'],
    };

    this.deps.marketService.listMarketsByLocation(request, (response: MarketListByLocationResponse) => {
      if (!response.success || this.deps.getCurrentSolarSystemId() !== solarSystemId) {
        return;
      }

      const marketStations = (response.markets ?? []).map((market) => this.toViewerMarketStationBody(market));
      if (marketStations.length === 0) {
        return;
      }

      const mergedBodies = this.mergeUniqueBodies([...this.deps.getBodies(), ...marketStations]);
      this.deps.setBodies(mergedBodies);
    });
  }

  private loadShipsForSystem(playerName: string, sessionKey: string, solarSystemId: string): void {
    const characterId = this.deps.getActiveCharacterId();
    if (!characterId) {
      this.deps.setShips([]);
      return;
    }

    const request: ShipListRequest = {
      playerName,
      characterId,
      sessionKey,
    };

    this.deps.shipService.listShips(request, (response: ShipListResponse) => {
      if (!response.success || this.deps.getCurrentSolarSystemId() !== solarSystemId) {
        this.deps.setShips([]);
        return;
      }

      const allShips = response.ships ?? [];
      const systemShips = allShips.filter((ship) => !ship.spatial || ship.spatial.solarSystemId === solarSystemId);
      this.deps.setShips(systemShips);
      this.maybeRepairInvalidShipSpatial(playerName, sessionKey, solarSystemId, allShips);
    });
  }

  private maybeRepairInvalidShipSpatial(
    playerName: string,
    sessionKey: string,
    solarSystemId: string,
    ships: ShipSummary[],
  ): void {
    const characterId = this.deps.getActiveCharacterId();
    if (!characterId) {
      return;
    }

    for (const ship of ships) {
      if (!ship?.id || isValidShipSpatial(ship.spatial)) {
        continue;
      }
      if (this.repairedShipIds.has(ship.id)) {
        continue;
      }
      this.repairedShipIds.add(ship.id);
      const update = generateDeterministicStarterShipUpdate(playerName, characterId, ship.id);
      const upsertRequest: ShipUpsertRequest = {
        playerName,
        characterId,
        sessionKey,
        ship: update,
      };
      appLogger.warn(
        `Repairing ship ${ship.id} with invalid spatial; re-running deterministic asteroid-belt upsert.`,
      );
      this.deps.socketService.upsertShip(upsertRequest, (upsertResponse: ShipUpsertResponse) => {
        if (!upsertResponse.success) {
          appLogger.warn(`Ship spatial repair failed for ${ship.id}:`, upsertResponse.message);
          return;
        }
        if (this.deps.getCurrentSolarSystemId() !== solarSystemId) {
          return;
        }

        this.loadShipsForSystem(playerName, sessionKey, solarSystemId);
      });
    }
  }
}
