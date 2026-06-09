import {
  type CelestialBodyListRequestIdentity,
  type CelestialBodyListRequest,
  type CelestialBodyListResponse,
} from '../model/celestial-body-list';
import {
  type CelestialBodyUpsertRequestIdentity,
  type CelestialBodyUpsertRequest,
  type CelestialBodyUpsertResponse,
} from '../model/celestial-body-upsert';
import {
  type ItemUpsertRequestIdentity,
  type ItemUpsertResponse,
} from '../model/item-upsert';
import {
  type LaunchItemRequestIdentity,
  type LaunchItemRequest,
  type LaunchItemResponse,
} from '../model/launch-item';
import {
  type ShipUpsertRequestIdentity,
  type ShipUpsertRequest,
  type ShipUpsertResponse,
} from '../model/ship-upsert';
import { matchesBasicRequestIdentity, normalizeIdentityValue } from './socket-correlation';

function matchesRequestIdentity(
  left: ItemUpsertRequestIdentity | undefined,
  right: ItemUpsertRequestIdentity | undefined,
): boolean {
  return matchesBasicRequestIdentity(left, right);
}

export function isItemUpsertResponseForRequest(
  response: ItemUpsertResponse,
  expectedCorrelationId: string,
  expectedRequestIdentity: ItemUpsertRequestIdentity,
): boolean {
  const responseCorrelationId = response.correlationId?.trim() ?? '';
  if (!responseCorrelationId || responseCorrelationId !== expectedCorrelationId) {
    return false;
  }

  if (!response.requestIdentity) {
    return false;
  }

  return matchesRequestIdentity(response.requestIdentity, expectedRequestIdentity);
}

function matchesShipRequestIdentity(
  left: ShipUpsertRequestIdentity | undefined,
  right: ShipUpsertRequestIdentity | undefined,
): boolean {
  if (!left || !right) {
    return false;
  }

  return (
    normalizeIdentityValue(left.operation) === normalizeIdentityValue(right.operation) &&
    normalizeIdentityValue(left.entityType) === normalizeIdentityValue(right.entityType) &&
    normalizeIdentityValue(left.containerId) === normalizeIdentityValue(right.containerId)
  );
}

export function isShipUpsertResponseForRequest(
  response: ShipUpsertResponse,
  expectedCorrelationId: string,
  expectedRequestIdentity: ShipUpsertRequestIdentity,
  _expectedRequest: ShipUpsertRequest,
): boolean {
  const responseCorrelationId = response.correlationId?.trim() ?? '';
  if (!responseCorrelationId || responseCorrelationId !== expectedCorrelationId) {
    return false;
  }

  if (!response.requestIdentity) {
    return false;
  }

  return matchesShipRequestIdentity(response.requestIdentity, expectedRequestIdentity);
}

function matchesLaunchRequestIdentity(
  left: LaunchItemRequestIdentity | undefined,
  right: LaunchItemRequestIdentity | undefined,
): boolean {
  if (!left || !right) {
    return false;
  }

  return (
    normalizeIdentityValue(left.operation) === normalizeIdentityValue(right.operation) &&
    normalizeIdentityValue(left.entityType) === normalizeIdentityValue(right.entityType) &&
    normalizeIdentityValue(left.containerId) === normalizeIdentityValue(right.containerId) &&
    normalizeIdentityValue(left.itemId) === normalizeIdentityValue(right.itemId) &&
    (left.hotkey ?? null) === (right.hotkey ?? null) &&
    normalizeIdentityValue(left.targetCelestialBodyId) === normalizeIdentityValue(right.targetCelestialBodyId) &&
    normalizeIdentityValue(left.characterId) === normalizeIdentityValue(right.characterId)
  );
}

export function isLaunchItemResponseForRequest(
  response: LaunchItemResponse,
  expectedCorrelationId: string,
  expectedRequestIdentity: LaunchItemRequestIdentity,
  _expectedRequest: LaunchItemRequest,
): boolean {
  const responseCorrelationId = response.correlationId?.trim() ?? '';
  if (!responseCorrelationId || responseCorrelationId !== expectedCorrelationId) {
    return false;
  }

  if (!response.requestIdentity) {
    return false;
  }

  return matchesLaunchRequestIdentity(response.requestIdentity, expectedRequestIdentity);
}

function matchesCelestialBodyUpsertRequestIdentity(
  left: CelestialBodyUpsertRequestIdentity | undefined,
  right: CelestialBodyUpsertRequestIdentity | undefined,
): boolean {
  if (!left || !right) {
    return false;
  }

  return (
    normalizeIdentityValue(left.operation) === normalizeIdentityValue(right.operation) &&
    normalizeIdentityValue(left.entityType) === normalizeIdentityValue(right.entityType) &&
    normalizeIdentityValue(left.containerId) === normalizeIdentityValue(right.containerId)
  );
}

export function isCelestialBodyUpsertResponseForRequest(
  response: CelestialBodyUpsertResponse,
  expectedCorrelationId: string,
  expectedRequestIdentity: CelestialBodyUpsertRequestIdentity,
  _expectedRequest: CelestialBodyUpsertRequest,
): boolean {
  const responseCorrelationId = response.correlationId?.trim() ?? '';
  if (!responseCorrelationId || responseCorrelationId !== expectedCorrelationId) {
    return false;
  }

  if (!response.requestIdentity) {
    return false;
  }

  return matchesCelestialBodyUpsertRequestIdentity(response.requestIdentity, expectedRequestIdentity);
}

function matchesCelestialBodyListRequestIdentity(
  left: CelestialBodyListRequestIdentity | undefined,
  right: CelestialBodyListRequestIdentity | undefined,
): boolean {
  if (!left || !right) {
    return false;
  }

  return (
    normalizeIdentityValue(left.operation) === normalizeIdentityValue(right.operation) &&
    normalizeIdentityValue(left.entityType) === normalizeIdentityValue(right.entityType) &&
    normalizeIdentityValue(left.containerId) === normalizeIdentityValue(right.containerId)
  );
}

export function isCelestialBodyListResponseForRequest(
  response: CelestialBodyListResponse,
  expectedCorrelationId: string,
  expectedRequestIdentity: CelestialBodyListRequestIdentity,
  _expectedRequest: CelestialBodyListRequest,
): boolean {
  const responseCorrelationId = response.correlationId?.trim() ?? '';
  if (!responseCorrelationId || responseCorrelationId !== expectedCorrelationId) {
    return false;
  }

  if (!response.requestIdentity) {
    return false;
  }

  return matchesCelestialBodyListRequestIdentity(response.requestIdentity, expectedRequestIdentity);
}
