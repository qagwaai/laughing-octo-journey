import type {
  MarketRouteFeedEncounterShip,
  MarketRouteFeedGate,
  MarketRouteFeedStation,
  MarketSummary,
} from '../../model/market-list';

export interface ShipExteriorRouteFeeds {
  gates: MarketRouteFeedGate[];
  stations: MarketRouteFeedStation[];
  encounterShips: MarketRouteFeedEncounterShip[];
}

function normalize(value: string | undefined): string {
  return value?.trim().toLowerCase() ?? '';
}

function mergeUniqueById<T, K extends keyof T>(
  target: Map<string, T>,
  rows: readonly T[] | undefined,
  idKey: K,
): void {
  if (!Array.isArray(rows)) {
    return;
  }

  for (const row of rows) {
    const id = row[idKey];
    if (typeof id !== 'string') {
      continue;
    }

    const token = normalize(id);
    if (!token || target.has(token)) {
      continue;
    }

    target.set(token, row);
  }
}

export function collectShipExteriorRouteFeeds(markets: readonly MarketSummary[] | undefined): ShipExteriorRouteFeeds {
  const gatesById = new Map<string, MarketRouteFeedGate>();
  const stationsById = new Map<string, MarketRouteFeedStation>();
  const encounterShipsById = new Map<string, MarketRouteFeedEncounterShip>();

  if (Array.isArray(markets)) {
    for (const market of markets) {
      const route = market.route;
      if (!route) {
        continue;
      }

      mergeUniqueById(gatesById, route.gates, 'gateId');
      mergeUniqueById(stationsById, route.stations, 'marketId');
      mergeUniqueById(encounterShipsById, route.encounterShips, 'shipId');
    }
  }

  return {
    gates: Array.from(gatesById.values()),
    stations: Array.from(stationsById.values()),
    encounterShips: Array.from(encounterShipsById.values()),
  };
}
