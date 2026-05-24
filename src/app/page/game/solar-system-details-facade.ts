import type { MarketListByLocationRequest, MarketListByLocationResponse, MarketSummary } from '../../model/market-list';
import type { ViewerBody, SolarSystemGetResponse } from '../../model/solar-system-get';
import type { ShipSummary } from '../../model/ship-list';
import type { ShipListByOwnerRequest, ShipListByOwnerResponse } from '../../model/ship-list-by-owner';
import type { SolarSystemSummary } from '../../model/solar-system-list';
import { MarketService } from '../../services/market.service';
import { ShipService } from '../../services/ship.service';
import { SolarSystemService } from '../../services/solar-system.service';

export interface DetailsRow {
  id: string;
  displayName: string;
  bodyType: string;
  diameterM: number | null;
  semiMajorAxisKm: number | null;
  isShip: boolean;
  isActiveShip: boolean;
  shipModel: string | null;
  shipTier: number | null;
  shipStatus: string | null;
}

interface SolarSystemDetailsFacadeDeps {
  solarSystemService: SolarSystemService;
  marketService: MarketService;
  shipService: ShipService;
  getPlayerName: () => string;
  getSessionKey: () => string | null;
  getActiveCharacterId: () => string | null;
  getActiveShipId: () => string | null;
  setSolarSystem: (solarSystem: SolarSystemSummary | null) => void;
  setBodyRows: (rows: DetailsRow[]) => void;
  setShipRows: (rows: DetailsRow[]) => void;
  setIsLoading: (value: boolean) => void;
  setLoadError: (value: string | null) => void;
}

const DETAILS_MARKET_DISTANCE_AU = 200;
const DETAILS_MARKET_LIMIT = 250;

const BODY_TYPE_SORT_ORDER: Record<string, number> = {
  star: 0,
  planet: 1,
  moon: 2,
  asteroid: 3,
  station: 4,
  ship: 5,
};

function sortOrder(bodyType: string): number {
  const normalized = typeof bodyType === 'string' ? bodyType.trim().toLowerCase() : '';
  return BODY_TYPE_SORT_ORDER[normalized] ?? 99;
}

export class SolarSystemDetailsFacade {
  constructor(private readonly deps: SolarSystemDetailsFacadeDeps) {}

  loadDetails(solarSystemId: string, errorPrefix: string): void {
    const playerName = this.deps.getPlayerName();
    const sessionKey = this.deps.getSessionKey();
    if (!playerName || !sessionKey) {
      this.deps.setLoadError(errorPrefix + ' missing-session');
      return;
    }

    this.deps.setIsLoading(true);
    this.deps.setLoadError(null);
    this.deps.setBodyRows([]);
    this.deps.setShipRows([]);

    this.deps.solarSystemService.getSolarSystem(
      { playerName, sessionKey, solarSystemId },
      (response: SolarSystemGetResponse) => {
        this.deps.setIsLoading(false);
        if (!response.success) {
          this.deps.setLoadError(errorPrefix + ' ' + (response.message ?? 'unknown-error'));
          return;
        }

        this.deps.setSolarSystem(response.solarSystem ?? null);

        const allBodies = [...(response.stars ?? []), ...(response.bodies ?? [])];
        const bodyRows = this.bodiesToRows(allBodies);
        bodyRows.sort((a, b) => sortOrder(a.bodyType) - sortOrder(b.bodyType));
        this.deps.setBodyRows(bodyRows);

        this.hydrateMarkets(bodyRows, allBodies, playerName, sessionKey, solarSystemId);
        this.loadShipsForSystem(playerName, sessionKey, solarSystemId);
      },
    );
  }

  private bodiesToRows(bodies: ViewerBody[]): DetailsRow[] {
    return bodies.map((b) => ({
      id: b.id,
      displayName: b.displayName,
      bodyType: typeof b.bodyType === 'string' && b.bodyType.trim() ? b.bodyType : 'unknown',
      diameterM: b.physicalCatalog?.estimatedDiameterM ?? null,
      semiMajorAxisKm: b.orbitalElements?.semiMajorAxisKm ?? null,
      isShip: false,
      isActiveShip: false,
      shipModel: null,
      shipTier: null,
      shipStatus: null,
    }));
  }

  private hydrateMarkets(
    existingRows: DetailsRow[],
    allBodies: ViewerBody[],
    playerName: string,
    sessionKey: string,
    solarSystemId: string,
  ): void {
    const hasStation = allBodies.some((b) => typeof b.bodyType === 'string' && b.bodyType.toLowerCase() === 'station');
    if (hasStation) {
      return;
    }

    const firstStar = allBodies.find((b) => typeof b.bodyType === 'string' && b.bodyType.toLowerCase() === 'star');
    const positionKm = firstStar?.spatial.positionKm ?? { x: 0, y: 0, z: 0 };

    const request: MarketListByLocationRequest = {
      playerName,
      sessionKey,
      solarSystemId,
      positionKm,
      distanceAu: DETAILS_MARKET_DISTANCE_AU,
      limit: DETAILS_MARKET_LIMIT,
      locationTypes: ['station', 'free-floating'],
    };

    this.deps.marketService.listMarketsByLocation(request, (response: MarketListByLocationResponse) => {
      if (!response.success) {
        return;
      }
      const marketRows = (response.markets ?? []).map((m: MarketSummary): DetailsRow => ({
        id: m.marketId,
        displayName: m.siteName?.trim() || m.marketName?.trim() || m.marketId,
        bodyType: 'station',
        diameterM: null,
        semiMajorAxisKm: m.trajectory?.orbit?.semiMajorAxisKm ?? null,
        isShip: false,
        isActiveShip: false,
        shipModel: null,
        shipTier: null,
        shipStatus: null,
      }));
      const merged = [...existingRows, ...marketRows];
      merged.sort((a, b) => sortOrder(a.bodyType) - sortOrder(b.bodyType));
      this.deps.setBodyRows(merged);
    });
  }

  private loadShipsForSystem(playerName: string, sessionKey: string, solarSystemId: string): void {
    const characterId = this.deps.getActiveCharacterId();
    if (!characterId) {
      this.deps.setShipRows([]);
      return;
    }

    const request: ShipListByOwnerRequest = {
      playerName,
      sessionKey,
      owner: {
        ownerType: 'player-character',
        characterId,
      },
    };

    this.deps.shipService.listShipsByOwner(request, (response: ShipListByOwnerResponse) => {
      if (!response.success) {
        this.deps.setShipRows([]);
        return;
      }

      const activeShipId = this.deps.getActiveShipId();
      const systemShips = (response.ships ?? []).filter((ship) => ship.spatial?.solarSystemId === solarSystemId);
      this.deps.setShipRows(systemShips.map((ship: ShipSummary) => ({
        id: ship.id,
        displayName: ship.name,
        bodyType: 'ship',
        diameterM: null,
        semiMajorAxisKm: null,
        isShip: true,
        isActiveShip: ship.id === activeShipId,
        shipModel: ship.model ?? null,
        shipTier: ship.tier ?? null,
        shipStatus: ship.status ?? null,
      })));
    });
  }
}
