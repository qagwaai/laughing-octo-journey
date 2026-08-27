import type { ShipExteriorRouteFeeds } from './ship-exterior-route-feed-adapter';

export interface ShipExteriorRouteFeedCounts {
  gates: number;
  stations: number;
  encounterShips: number;
}

export function summarizeShipExteriorRouteFeeds(feeds: ShipExteriorRouteFeeds | null | undefined): ShipExteriorRouteFeedCounts {
  return {
    gates: feeds?.gates.length ?? 0,
    stations: feeds?.stations.length ?? 0,
    encounterShips: feeds?.encounterShips.length ?? 0,
  };
}

export function formatShipExteriorRouteFeedSummary(counts: ShipExteriorRouteFeedCounts | null): string {
  if (!counts) {
    return 'ROUTE // ---';
  }

  return `ROUTE // G ${counts.gates} S ${counts.stations} E ${counts.encounterShips}`;
}
