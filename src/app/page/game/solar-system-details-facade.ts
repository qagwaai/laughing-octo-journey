import type { MarketListByLocationRequest, MarketListByLocationResponse, MarketSummary } from '../../model/market-list';
import { isCompatibleBodyClassification } from '../../model/celestial-classification';
import { resolveCatalogDiameterM } from '../../model/physical-catalog';
import type { ShipSummary } from '../../model/ship-list';
import type { ShipListByOwnerRequest, ShipListByOwnerResponse } from '../../model/ship-list-by-owner';
import { mergeUniqueViewerBodies, type SolarSystemGetResponse, type ViewerBody } from '../../model/solar-system-get';
import type { SolarSystemSummary } from '../../model/solar-system-list';
import { viewerBodyGroup } from '../../scene/viewer/viewer-item-groups';
import { MarketService } from '../../services/market.service';
import { ShipService } from '../../services/ship.service';
import { SolarSystemService } from '../../services/solar-system.service';
import { isLikelyBodyType } from './viewer-body-metadata';

export interface DetailsRow {
  id: string;
  displayName: string;
  bodyType: string;
  /** Planet archetype (e.g. hot-jupiter) for planets whose type is known; null/absent otherwise. */
  planetType?: string | null;
  /** True when Forge inferred the planet type rather than reading it from the catalog. */
  planetTypeLikely?: boolean;
  viewerGroup: string;
  diameterM: number | null;
  semiMajorAxisKm: number | null;
  isShip: boolean;
  isActiveShip: boolean;
  shipModel: string | null;
  shipTier: number | null;
  shipStatus: string | null;
  ship?: ShipSummary;
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

/** Planet archetypes in the order their details sections appear (small/rocky to giant). */
export const DETAILS_PLANET_TYPE_ORDER = [
  'rocky',
  'super-earth',
  'ocean',
  'lava',
  'sub-neptune',
  'hot-neptune',
  'ice-giant',
  'gas-giant',
  'hot-jupiter',
  'super-jupiter',
] as const;

/** Server `planetType` when it is a valid planet archetype, else a compatible `surfaceArchetype`, else null. */
export function resolveDetailsPlanetType(
  body: Pick<ViewerBody, 'bodyType' | 'planetType' | 'surfaceArchetype'>,
): string | null {
  if (body.bodyType !== 'planet') return null;
  for (const candidate of [body.planetType, body.surfaceArchetype]) {
    if (isCompatibleBodyClassification('planet', candidate)) return candidate as string;
  }
  return null;
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

        const allBodies = mergeUniqueViewerBodies([...(response.stars ?? []), ...(response.bodies ?? [])]);
        const bodyRows = this.bodiesToRows(allBodies);
        bodyRows.sort((a, b) => sortOrder(a.bodyType) - sortOrder(b.bodyType));
        this.deps.setBodyRows(bodyRows);

        this.hydrateMarkets(bodyRows, allBodies, playerName, sessionKey, solarSystemId);
        this.loadShipsForSystem(playerName, sessionKey, solarSystemId);
      },
    );
  }

  private bodiesToRows(bodies: ViewerBody[]): DetailsRow[] {
    return bodies.map((b) => {
      const planetType = resolveDetailsPlanetType(b);
      return {
        id: b.id,
        displayName: b.displayName,
        bodyType: typeof b.bodyType === 'string' && b.bodyType.trim() ? b.bodyType : 'unknown',
        planetType,
        planetTypeLikely: planetType !== null && isLikelyBodyType(b),
        viewerGroup: viewerBodyGroup(b),
        diameterM: resolveCatalogDiameterM(b.physicalCatalog, b.physical),
        semiMajorAxisKm: b.orbitalElements?.semiMajorAxisKm ?? null,
        isShip: false,
        isActiveShip: false,
        shipModel: null,
        shipTier: null,
        shipStatus: null,
      };
    });
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
        viewerGroup: 'stations',
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
      this.deps.setShipRows(
        systemShips.map((ship: ShipSummary) => ({
          id: ship.id,
          displayName: ship.name,
          bodyType: 'ship',
          viewerGroup: 'ships',
          diameterM: null,
          semiMajorAxisKm: null,
          isShip: true,
          isActiveShip: ship.id === activeShipId,
          shipModel: ship.model ?? null,
          shipTier: ship.tier ?? null,
          shipStatus: ship.status ?? null,
          ship,
        })),
      );
    });
  }
}
