import type { ShipSummary } from './ship-list';

export type ActiveShipResolutionReason =
  | 'session-active-ship'
  | 'requested-ship'
  | 'first-usable-spatial-ship'
  | 'no-ships-returned'
  | 'no-usable-spatial-ship';

export interface ResolveActiveShipInput {
  ships: readonly ShipSummary[];
  sessionActiveShipId?: string | null;
  requestedShipId?: string | null;
}

export interface ActiveShipResolution {
  ship: ShipSummary | null;
  reason: ActiveShipResolutionReason;
}

export function hasUsableShipSpatial(ship: ShipSummary | null | undefined): boolean {
  const position = ship?.spatial?.positionKm;
  if (!position) {
    return false;
  }

  // Origin is a placeholder position and cannot be used for route/range-aware flows.
  return !(position.x === 0 && position.y === 0 && position.z === 0);
}

export function resolveActiveShipSelection(input: ResolveActiveShipInput): ActiveShipResolution {
  const ships = [...(input.ships ?? [])];
  if (ships.length === 0) {
    return { ship: null, reason: 'no-ships-returned' };
  }

  const sessionActiveShipId = input.sessionActiveShipId?.trim() ?? '';
  if (sessionActiveShipId) {
    const sessionShip = ships.find((ship) => ship.id === sessionActiveShipId);
    if (hasUsableShipSpatial(sessionShip)) {
      return { ship: sessionShip ?? null, reason: 'session-active-ship' };
    }
  }

  const requestedShipId = input.requestedShipId?.trim() ?? '';
  if (requestedShipId) {
    const requestedShip = ships.find((ship) => ship.id === requestedShipId);
    if (hasUsableShipSpatial(requestedShip)) {
      return { ship: requestedShip ?? null, reason: 'requested-ship' };
    }
  }

  const firstUsableSpatialShip = ships.find((ship) => hasUsableShipSpatial(ship));
  if (firstUsableSpatialShip) {
    return { ship: firstUsableSpatialShip, reason: 'first-usable-spatial-ship' };
  }

  return { ship: null, reason: 'no-usable-spatial-ship' };
}
