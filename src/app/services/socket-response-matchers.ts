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

function matchesLaunchResponseCoreFields(
  response: LaunchItemResponse,
  expectedRequestIdentity: LaunchItemRequestIdentity,
): boolean {
  if (!response.requestIdentity) {
    return false;
  }

  return (
    normalizeIdentityValue(response.requestIdentity.operation) === normalizeIdentityValue(expectedRequestIdentity.operation) &&
    normalizeIdentityValue(response.itemType) === normalizeIdentityValue(expectedRequestIdentity.entityType) &&
    normalizeIdentityValue(response.shipId) === normalizeIdentityValue(expectedRequestIdentity.containerId) &&
    normalizeIdentityValue(response.itemId) === normalizeIdentityValue(expectedRequestIdentity.itemId)
  );
}

function matchesRequiredLaunchResponseFields(
  response: LaunchItemResponse,
  expectedRequestIdentity: LaunchItemRequestIdentity,
): boolean {
  const responseHotkey = normalizeLaunchHotkey(response.hotkey);
  const expectedHotkey = normalizeLaunchHotkey(expectedRequestIdentity.hotkey);

  return (
    responseHotkey === expectedHotkey &&
    normalizeIdentityValue(response.targetCelestialBodyId) ===
      normalizeIdentityValue(expectedRequestIdentity.targetCelestialBodyId) &&
    normalizeIdentityValue(response.characterId) === normalizeIdentityValue(expectedRequestIdentity.characterId)
  );
}

function normalizeLaunchHotkey(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : null;
  }

  return null;
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

  return (
    matchesLaunchResponseCoreFields(response, expectedRequestIdentity) &&
    matchesRequiredLaunchResponseFields(response, expectedRequestIdentity)
  );
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
