import {
  type CelestialBodyListRequestIdentity,
  type CelestialBodyListRequest,
} from '../model/celestial-body-list';
import {
  type CelestialBodyUpsertRequestIdentity,
  type CelestialBodyUpsertRequest,
} from '../model/celestial-body-upsert';
import { type ItemUpsertRequestIdentity, type ItemUpsertRequest } from '../model/item-upsert';
import { type LaunchItemRequestIdentity, type LaunchItemRequest } from '../model/launch-item';
import { type ShipUpsertRequestIdentity, type ShipUpsertRequest } from '../model/ship-upsert';
import { normalizeIdentityValue } from './socket-correlation';

export function buildDomainPipelineKey(input: {
  operation?: string;
  entityType?: string;
  containerId?: string;
  characterId?: string;
}): string {
  return [
    normalizeIdentityValue(input.operation),
    normalizeIdentityValue(input.entityType),
    normalizeIdentityValue(input.containerId),
    normalizeIdentityValue(input.characterId),
  ].join('|');
}

export function buildDefaultItemUpsertRequestIdentity(request: ItemUpsertRequest): ItemUpsertRequestIdentity {
  return {
    operation: 'item-upsert',
    entityType: request.item?.itemType?.trim() || 'unknown-item-type',
    containerId: request.item?.container?.containerId?.trim() || 'unknown-container',
  };
}

export function buildDefaultShipUpsertRequestIdentity(request: ShipUpsertRequest): ShipUpsertRequestIdentity {
  return {
    operation: 'ship-upsert',
    entityType: 'ship',
    containerId: request.ship?.id?.trim() || 'unknown-ship-id',
  };
}

export function buildDefaultLaunchItemRequestIdentity(request: LaunchItemRequest): LaunchItemRequestIdentity {
  return {
    operation: 'launch-item',
    entityType: request.itemType?.trim() || 'unknown-item-type',
    containerId: request.shipId?.trim() || 'unknown-container',
    itemId: request.itemId?.trim() || undefined,
    hotkey: request.hotkey,
    targetCelestialBodyId: request.targetCelestialBodyId?.trim() || undefined,
    characterId: request.characterId?.trim() || undefined,
  };
}

export function buildDefaultCelestialBodyUpsertRequestIdentity(
  request: CelestialBodyUpsertRequest,
): CelestialBodyUpsertRequestIdentity {
  return {
    operation: 'celestial-body-upsert',
    entityType: 'celestial-body',
    containerId: request.celestialBody?.id?.trim() || 'unknown-celestial-body',
  };
}

export function buildCelestialBodyListRequestKey(input: {
  playerName?: string;
  solarSystemId?: string;
  distanceKm?: number;
  positionKm?: { x: number; y: number; z: number };
}): string {
  const px = input.positionKm?.x ?? null;
  const py = input.positionKm?.y ?? null;
  const pz = input.positionKm?.z ?? null;
  return [
    normalizeIdentityValue(input.playerName),
    normalizeIdentityValue(input.solarSystemId),
    String(input.distanceKm ?? ''),
    String(px ?? ''),
    String(py ?? ''),
    String(pz ?? ''),
  ].join('|');
}

export function buildDefaultCelestialBodyListRequestIdentity(
  request: CelestialBodyListRequest,
): CelestialBodyListRequestIdentity {
  return {
    operation: 'celestial-body-list',
    entityType: 'celestial-body',
    containerId: request.solarSystemId?.trim() || 'unknown-solar-system',
  };
}
