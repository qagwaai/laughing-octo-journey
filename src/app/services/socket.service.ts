import { Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import {
  CELESTIAL_BODY_LIST_REQUEST_EVENT,
  CELESTIAL_BODY_LIST_RESPONSE_EVENT,
  type CelestialBodyListRequestIdentity,
  CelestialBodyListRequest,
  CelestialBodyListResponse,
} from '../model/celestial-body-list';
import {
  CELESTIAL_BODY_UPSERT_REQUEST_EVENT,
  CELESTIAL_BODY_UPSERT_RESPONSE_EVENT,
  type CelestialBodyUpsertRequestIdentity,
  CelestialBodyUpsertRequest,
  CelestialBodyUpsertResponse,
} from '../model/celestial-body-upsert';
import {
  ITEM_UPSERT_REQUEST_EVENT,
  ITEM_UPSERT_RESPONSE_EVENT,
  type ItemUpsertRequestIdentity,
  ItemUpsertRequest,
  ItemUpsertResponse,
} from '../model/item-upsert';
import {
  LAUNCH_ITEM_REQUEST_EVENT,
  LAUNCH_ITEM_RESPONSE_EVENT,
  type LaunchItemRequestIdentity,
  LaunchItemRequest,
  LaunchItemResponse,
} from '../model/launch-item';
import {
  SHIP_UPSERT_REQUEST_EVENT,
  SHIP_UPSERT_RESPONSE_EVENT,
  type ShipUpsertRequestIdentity,
  ShipUpsertRequest,
  ShipUpsertResponse,
} from '../model/ship-upsert';
import { appLogger } from './logger';
import { createCorrelationId, matchesBasicRequestIdentity, normalizeIdentityValue } from './socket-correlation';

const ITEM_UPSERT_REQUEST_EVENT_ALIAS = 'upsert-item-request';
const ITEM_UPSERT_RESPONSE_EVENT_ALIAS = 'upsert-item-response';
const ITEM_UPSERT_ALIAS_FALLBACK_DELAY_MS = 750;
const ITEM_UPSERT_NO_RESPONSE_LOG_DELAY_MS = 3000;

function buildDefaultItemUpsertRequestIdentity(request: ItemUpsertRequest): ItemUpsertRequestIdentity {
  return {
    operation: 'item-upsert',
    entityType: request.item?.itemType?.trim() || 'unknown-item-type',
    containerId: request.item?.container?.containerId?.trim() || 'unknown-container',
  };
}

function matchesRequestIdentity(
  left: ItemUpsertRequestIdentity | undefined,
  right: ItemUpsertRequestIdentity | undefined,
): boolean {
  return matchesBasicRequestIdentity(left, right);
}

function isItemUpsertResponseForRequest(
  response: ItemUpsertResponse,
  expectedCorrelationId: string,
  expectedRequestIdentity: ItemUpsertRequestIdentity,
): boolean {
  const responseCorrelationId = response.correlationId?.trim() ?? '';
  if (responseCorrelationId) {
    if (responseCorrelationId !== expectedCorrelationId) {
      return false;
    }

    if (response.requestIdentity) {
      return matchesRequestIdentity(response.requestIdentity, expectedRequestIdentity);
    }
  }

  // Compatibility fallback for producers that do not yet echo correlation metadata.
  const responseItemType = normalizeIdentityValue(response.item?.itemType);
  const expectedItemType = normalizeIdentityValue(expectedRequestIdentity.entityType);
  if (!responseItemType || responseItemType !== expectedItemType) {
    return false;
  }

  const responseContainerId = normalizeIdentityValue(response.item?.container?.containerId);
  const expectedContainerId = normalizeIdentityValue(expectedRequestIdentity.containerId);
  if (!responseContainerId || !expectedContainerId) {
    return false;
  }

  return responseContainerId === expectedContainerId;
}

function buildDefaultShipUpsertRequestIdentity(request: ShipUpsertRequest): ShipUpsertRequestIdentity {
  return {
    operation: 'ship-upsert',
    entityType: request.ship?.model?.trim() || 'unknown-ship-model',
    containerId: request.ship?.id?.trim() || 'unknown-ship-id',
    characterId: request.characterId?.trim() || undefined,
  };
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
    normalizeIdentityValue(left.containerId) === normalizeIdentityValue(right.containerId) &&
    normalizeIdentityValue(left.characterId) === normalizeIdentityValue(right.characterId)
  );
}

function isShipUpsertResponseForRequest(
  response: ShipUpsertResponse,
  expectedCorrelationId: string,
  expectedRequestIdentity: ShipUpsertRequestIdentity,
  expectedRequest: ShipUpsertRequest,
): boolean {
  const responseCorrelationId = response.correlationId?.trim() ?? '';
  if (responseCorrelationId) {
    if (responseCorrelationId !== expectedCorrelationId) {
      return false;
    }

    if (response.requestIdentity) {
      return matchesShipRequestIdentity(response.requestIdentity, expectedRequestIdentity);
    }
  }

  // Compatibility fallback for producers that do not yet echo correlation metadata.
  const expectedPlayerName = normalizeIdentityValue(expectedRequest.playerName);
  const expectedCharacterId = normalizeIdentityValue(expectedRequest.characterId);
  const expectedShipId = normalizeIdentityValue(expectedRequest.ship?.id);

  let comparedFields = 0;

  const responsePlayerName = normalizeIdentityValue(response.playerName);
  if (responsePlayerName) {
    comparedFields += 1;
    if (responsePlayerName !== expectedPlayerName) {
      return false;
    }
  }

  const responseCharacterId = normalizeIdentityValue(response.characterId);
  if (responseCharacterId) {
    comparedFields += 1;
    if (responseCharacterId !== expectedCharacterId) {
      return false;
    }
  }

  const responseShipId = normalizeIdentityValue(response.ship?.id);
  if (responseShipId) {
    comparedFields += 1;
    if (responseShipId !== expectedShipId) {
      return false;
    }
  }

  // If server doesn't echo identifying fields yet, permit for compatibility.
  return true;
}

function buildDefaultLaunchItemRequestIdentity(request: LaunchItemRequest): LaunchItemRequestIdentity {
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

function isLaunchItemResponseForRequest(
  response: LaunchItemResponse,
  expectedCorrelationId: string,
  expectedRequestIdentity: LaunchItemRequestIdentity,
  expectedRequest: LaunchItemRequest,
): boolean {
  const responseCorrelationId = response.correlationId?.trim() ?? '';
  if (responseCorrelationId) {
    if (responseCorrelationId !== expectedCorrelationId) {
      return false;
    }

    if (response.requestIdentity) {
      return matchesLaunchRequestIdentity(response.requestIdentity, expectedRequestIdentity);
    }
  }

  // Compatibility fallback for producers that do not yet echo correlation metadata.
  return (
    normalizeIdentityValue(response.itemType) === normalizeIdentityValue(expectedRequest.itemType) &&
    normalizeIdentityValue(response.itemId) === normalizeIdentityValue(expectedRequest.itemId) &&
    normalizeIdentityValue(response.shipId) === normalizeIdentityValue(expectedRequest.shipId) &&
    normalizeIdentityValue(response.characterId) === normalizeIdentityValue(expectedRequest.characterId) &&
    normalizeIdentityValue(response.targetCelestialBodyId) ===
      normalizeIdentityValue(expectedRequest.targetCelestialBodyId) &&
    response.hotkey === expectedRequest.hotkey
  );
}

function buildDefaultCelestialBodyUpsertRequestIdentity(
  request: CelestialBodyUpsertRequest,
): CelestialBodyUpsertRequestIdentity {
  return {
    operation: 'celestial-body-upsert',
    entityType: request.celestialBody?.catalogId?.trim() || 'unknown-catalog-id',
    containerId: request.celestialBody?.sourceScanId?.trim() || 'unknown-source-scan-id',
    characterId: request.createdByCharacterId?.trim() || undefined,
  };
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
    normalizeIdentityValue(left.containerId) === normalizeIdentityValue(right.containerId) &&
    normalizeIdentityValue(left.characterId) === normalizeIdentityValue(right.characterId)
  );
}

function isCelestialBodyUpsertResponseForRequest(
  response: CelestialBodyUpsertResponse,
  expectedCorrelationId: string,
  expectedRequestIdentity: CelestialBodyUpsertRequestIdentity,
  expectedRequest: CelestialBodyUpsertRequest,
): boolean {
  const responseCorrelationId = response.correlationId?.trim() ?? '';
  if (responseCorrelationId) {
    if (responseCorrelationId !== expectedCorrelationId) {
      return false;
    }

    if (response.requestIdentity) {
      return matchesCelestialBodyUpsertRequestIdentity(response.requestIdentity, expectedRequestIdentity);
    }
  }

  const responseSourceScanId = normalizeIdentityValue(response.celestialBody?.sourceScanId);
  if (responseSourceScanId) {
    const expectedSourceScanId = normalizeIdentityValue(expectedRequest.celestialBody?.sourceScanId);
    return responseSourceScanId === expectedSourceScanId;
  }

  return true;
}

function buildCelestialBodyListRequestKey(input: {
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

function buildDefaultCelestialBodyListRequestIdentity(
  request: CelestialBodyListRequest,
): CelestialBodyListRequestIdentity {
  return {
    operation: 'celestial-body-list',
    entityType: request.solarSystemId?.trim() || 'unknown-solar-system',
    containerId: buildCelestialBodyListRequestKey(request),
  };
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

function isCelestialBodyListResponseForRequest(
  response: CelestialBodyListResponse,
  expectedCorrelationId: string,
  expectedRequestIdentity: CelestialBodyListRequestIdentity,
  expectedRequest: CelestialBodyListRequest,
): boolean {
  const responseCorrelationId = response.correlationId?.trim() ?? '';
  if (responseCorrelationId) {
    if (responseCorrelationId !== expectedCorrelationId) {
      return false;
    }

    if (response.requestIdentity) {
      return matchesCelestialBodyListRequestIdentity(response.requestIdentity, expectedRequestIdentity);
    }
  }

  const expectedKey = buildCelestialBodyListRequestKey(expectedRequest);
  const responseKey = buildCelestialBodyListRequestKey({
    playerName: response.playerName,
    solarSystemId: response.solarSystemId,
    distanceKm: response.distanceKm,
    positionKm: response.positionKm,
  });

  if (responseKey.replace(/\|/g, '').length > 0) {
    return responseKey === expectedKey;
  }

  return true;
}

/**
 * Socket.IO Service
 *
 * Provides a centralized service for managing Socket.IO client connections
 * and communication with a Socket.IO server. Handles connection state management,
 * event emission, and event listening using Angular signals for reactivity.
 */
@Injectable({
  providedIn: 'root',
})
export class SocketService {
  public serverUrl = 'http://localhost:3000'; // Default server URL, can be overridden
  private socket: Socket | null = null;

  // Signal to track connection state
  protected isConnected = signal(false);
  protected connectionError = signal<string | null>(null);

  constructor() {
    this.connect(this.serverUrl);
  }

  /**
   * Connect to a Socket.IO server
   * @param url - The server URL (e.g., 'http://localhost:3000')
   * @param options - Optional Socket.IO connection options
   */
  connect(url: string, options?: any): void {
    if (this.socket?.connected) {
      appLogger.warn('Socket already connected');
      return;
    }

    try {
      this.socket = io(url, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        ...options,
      });

      this.setupConnectionListeners();
      this.connectionError.set(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      this.connectionError.set(errorMessage);
      appLogger.error('Socket connection error:', errorMessage);
    }
  }

  /**
   * Disconnect from the Socket.IO server
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected.set(false);
    }
  }

  /**
   * Emit an event to the server
   * @param eventName - The name of the event
   * @param data - The data to send
   * @param callback - Optional callback function
   */
  emit(eventName: string, data?: any, callback?: (response: any) => void): void {
    if (!this.socket) {
      appLogger.warn('Socket not initialized. Use connect() first');
      return;
    }

    if (callback) {
      this.socket.emit(eventName, data, callback);
    } else {
      this.socket.emit(eventName, data);
    }
  }

  /**
   * Emit a celestial-body upsert request and optionally handle a one-time response.
   */
  upsertCelestialBody(
    request: CelestialBodyUpsertRequest,
    onResponse?: (response: CelestialBodyUpsertResponse) => void,
  ): void {
    const correlationId = request.correlationId?.trim() || createCorrelationId('celestial-body-upsert');
    const requestIdentity = request.requestIdentity ?? buildDefaultCelestialBodyUpsertRequestIdentity(request);
    const requestWithCorrelation: CelestialBodyUpsertRequest = {
      ...request,
      correlationId,
      correlationSource: request.correlationSource?.trim() || 'socket.upsertCelestialBody',
      requestIdentity,
    };

    let handled = false;
    let unsubscribe: (() => void) | null = null;

    if (onResponse) {
      const handleResponse = (response: CelestialBodyUpsertResponse) => {
        if (handled) {
          return;
        }

        if (
          !isCelestialBodyUpsertResponseForRequest(
            response,
            correlationId,
            requestIdentity,
            requestWithCorrelation,
          )
        ) {
          appLogger.warn(
            `[socket-correlation] Dropping mismatched celestial-body-upsert response. expectedCorrelationId=${correlationId} expectedSourceScanId=${requestIdentity.containerId} expectedCatalogId=${requestIdentity.entityType} responseCorrelationId=${response.correlationId ?? 'missing'} responseSourceScanId=${response.celestialBody?.sourceScanId ?? 'missing'} responseCatalogId=${response.celestialBody?.catalogId ?? 'missing'}`,
          );
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(
              new CustomEvent('socket-correlation-warning', {
                detail: {
                  operation: 'celestial-body-upsert',
                  correlationId,
                  expectedRequestIdentity: requestIdentity,
                  responseCorrelationId: response.correlationId ?? null,
                  responseSourceScanId: response.celestialBody?.sourceScanId ?? null,
                  responseCatalogId: response.celestialBody?.catalogId ?? null,
                },
              }),
            );
          }
          return;
        }

        handled = true;
        unsubscribe?.();
        unsubscribe = null;
        onResponse(response);
      };

      unsubscribe = this.on(CELESTIAL_BODY_UPSERT_RESPONSE_EVENT, handleResponse);
    }

    this.emit(CELESTIAL_BODY_UPSERT_REQUEST_EVENT, requestWithCorrelation);
  }

  /**
   * Emit a celestial-body list request and optionally handle a one-time response.
   */
  listCelestialBodies(
    request: CelestialBodyListRequest,
    onResponse?: (response: CelestialBodyListResponse) => void,
  ): void {
    const correlationId = request.correlationId?.trim() || createCorrelationId('celestial-body-list');
    const requestIdentity = request.requestIdentity ?? buildDefaultCelestialBodyListRequestIdentity(request);
    const requestWithCorrelation: CelestialBodyListRequest = {
      ...request,
      correlationId,
      correlationSource: request.correlationSource?.trim() || 'socket.listCelestialBodies',
      requestIdentity,
    };

    let handled = false;
    let unsubscribe: (() => void) | null = null;

    if (onResponse) {
      const handleResponse = (response: CelestialBodyListResponse) => {
        if (handled) {
          return;
        }

        if (!isCelestialBodyListResponseForRequest(response, correlationId, requestIdentity, requestWithCorrelation)) {
          appLogger.warn(
            `[socket-correlation] Dropping mismatched celestial-body-list response. expectedCorrelationId=${correlationId} expectedSolarSystemId=${requestIdentity.entityType} responseCorrelationId=${response.correlationId ?? 'missing'} responseSolarSystemId=${response.solarSystemId ?? 'missing'}`,
          );
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(
              new CustomEvent('socket-correlation-warning', {
                detail: {
                  operation: 'celestial-body-list',
                  correlationId,
                  expectedRequestIdentity: requestIdentity,
                  responseCorrelationId: response.correlationId ?? null,
                  responseSolarSystemId: response.solarSystemId ?? null,
                },
              }),
            );
          }
          return;
        }

        handled = true;
        unsubscribe?.();
        unsubscribe = null;
        onResponse(response);
      };

      unsubscribe = this.on(CELESTIAL_BODY_LIST_RESPONSE_EVENT, handleResponse);
    }

    this.emit(CELESTIAL_BODY_LIST_REQUEST_EVENT, requestWithCorrelation);
  }

  /**
   * Emit a ship upsert request and optionally handle a one-time response.
   */
  upsertShip(request: ShipUpsertRequest, onResponse?: (response: ShipUpsertResponse) => void): void {
    const correlationId = request.correlationId?.trim() || createCorrelationId('ship-upsert');
    const requestIdentity = request.requestIdentity ?? buildDefaultShipUpsertRequestIdentity(request);
    const shipUpsertWithCorrelation: ShipUpsertRequest = {
      ...request,
      correlationId,
      correlationSource: request.correlationSource?.trim() || 'socket.upsertShip',
      requestIdentity,
    };

    let handled = false;
    let unsubscribe: (() => void) | null = null;

    if (onResponse) {
      const handleResponse = (response: ShipUpsertResponse) => {
        if (handled) {
          return;
        }

        if (!isShipUpsertResponseForRequest(response, correlationId, requestIdentity, shipUpsertWithCorrelation)) {
          appLogger.warn(
            `[socket-correlation] Dropping mismatched ship-upsert response. expectedCorrelationId=${correlationId} expectedShipId=${requestIdentity.containerId} expectedCharacterId=${requestIdentity.characterId ?? 'missing'} expectedPlayerName=${shipUpsertWithCorrelation.playerName} responseCorrelationId=${response.correlationId ?? 'missing'} responseShipId=${response.ship?.id ?? 'missing'} responseCharacterId=${response.characterId ?? 'missing'} responsePlayerName=${response.playerName ?? 'missing'}`,
          );
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(
              new CustomEvent('socket-correlation-warning', {
                detail: {
                  operation: 'ship-upsert',
                  correlationId,
                  expectedRequestIdentity: requestIdentity,
                  responseCorrelationId: response.correlationId ?? null,
                  responseShipId: response.ship?.id ?? null,
                  responseCharacterId: response.characterId ?? null,
                  responsePlayerName: response.playerName ?? null,
                },
              }),
            );
          }
          return;
        }

        handled = true;
        unsubscribe?.();
        unsubscribe = null;
        onResponse(response);
      };

      unsubscribe = this.on(SHIP_UPSERT_RESPONSE_EVENT, handleResponse);
    }

    this.emit(SHIP_UPSERT_REQUEST_EVENT, shipUpsertWithCorrelation);
  }

  /**
   * Emit an item upsert request and optionally handle a one-time response.
   */
  upsertItem(request: ItemUpsertRequest, onResponse?: (response: ItemUpsertResponse) => void): void {
    const correlationId = request.correlationId?.trim() || createCorrelationId('item-upsert');
    const requestIdentity = request.requestIdentity ?? buildDefaultItemUpsertRequestIdentity(request);
    const requestWithCorrelation: ItemUpsertRequest = {
      ...request,
      correlationId,
      correlationSource: request.correlationSource?.trim() || 'socket.upsertItem',
      requestIdentity,
    };

    let handled = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let noResponseTimer: ReturnType<typeof setTimeout> | null = null;
    let unsubscribeCanonical: (() => void) | null = null;
    let unsubscribeAlias: (() => void) | null = null;

    const clearTimers = () => {
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }

      if (noResponseTimer) {
        clearTimeout(noResponseTimer);
        noResponseTimer = null;
      }

      if (unsubscribeCanonical) {
        unsubscribeCanonical();
        unsubscribeCanonical = null;
      }

      if (unsubscribeAlias) {
        unsubscribeAlias();
        unsubscribeAlias = null;
      }
    };

    if (onResponse) {
      const handleResponse = (response: ItemUpsertResponse) => {
        if (handled) {
          return;
        }

        if (!isItemUpsertResponseForRequest(response, correlationId, requestIdentity)) {
          appLogger.warn(
            `[socket-correlation] Dropping mismatched item-upsert response. expectedCorrelationId=${correlationId} expectedEntityType=${requestIdentity.entityType} expectedContainerId=${requestIdentity.containerId} responseCorrelationId=${response.correlationId ?? 'missing'} responseEntityType=${response.item?.itemType ?? 'missing'} responseContainerId=${response.item?.container?.containerId ?? 'missing'}`,
          );
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(
              new CustomEvent('socket-correlation-warning', {
                detail: {
                  operation: 'item-upsert',
                  correlationId,
                  expectedRequestIdentity: requestIdentity,
                  responseCorrelationId: response.correlationId ?? null,
                  responseItemType: response.item?.itemType ?? null,
                  responseContainerId: response.item?.container?.containerId ?? null,
                },
              }),
            );
          }
          return;
        }

        handled = true;
        clearTimers();
        onResponse(response);
      };

      unsubscribeCanonical = this.on(ITEM_UPSERT_RESPONSE_EVENT, handleResponse);
      unsubscribeAlias = this.on(ITEM_UPSERT_RESPONSE_EVENT_ALIAS, handleResponse);

      // Emit legacy alias only if canonical request appears unsupported.
      fallbackTimer = setTimeout(() => {
        if (handled) {
          return;
        }

        appLogger.warn(
          `No response for ${ITEM_UPSERT_REQUEST_EVENT}; retrying with ${ITEM_UPSERT_REQUEST_EVENT_ALIAS}. correlationId=${correlationId} itemType=${requestWithCorrelation.item?.itemType ?? 'unknown'} source=${requestWithCorrelation.correlationSource ?? 'unknown'}`,
        );
        this.emit(ITEM_UPSERT_REQUEST_EVENT_ALIAS, requestWithCorrelation);
      }, ITEM_UPSERT_ALIAS_FALLBACK_DELAY_MS);

      noResponseTimer = setTimeout(() => {
        if (handled) {
          return;
        }

        appLogger.error(
          `No item-upsert response received on either alias. correlationId=${correlationId} operation=${requestIdentity.operation} entityType=${requestIdentity.entityType} containerId=${requestIdentity.containerId} requestId=${requestWithCorrelation.item?.id ?? 'new-item'} itemType=${requestWithCorrelation.item?.itemType ?? 'unknown'} state=${requestWithCorrelation.item?.state ?? 'unknown'} source=${requestWithCorrelation.correlationSource ?? 'unknown'}`,
        );
      }, ITEM_UPSERT_NO_RESPONSE_LOG_DELAY_MS);
    }

    this.emit(ITEM_UPSERT_REQUEST_EVENT, requestWithCorrelation);
  }

  /**
   * Emit a launch item request and optionally handle a one-time response.
   */
  launchItem(request: LaunchItemRequest, onResponse?: (response: LaunchItemResponse) => void): LaunchItemRequest {
    const correlationId = request.correlationId?.trim() || createCorrelationId('launch-item');
    const requestIdentity = request.requestIdentity ?? buildDefaultLaunchItemRequestIdentity(request);
    const requestWithCorrelation: LaunchItemRequest = {
      ...request,
      correlationId,
      correlationSource: request.correlationSource?.trim() || 'socket.launchItem',
      requestIdentity,
    };

    let handled = false;
    let unsubscribe: (() => void) | null = null;

    if (onResponse) {
      const handleResponse = (response: LaunchItemResponse) => {
        if (handled) {
          return;
        }

        if (!isLaunchItemResponseForRequest(response, correlationId, requestIdentity, requestWithCorrelation)) {
          appLogger.warn(
            `[socket-correlation] Dropping mismatched launch-item response. expectedCorrelationId=${correlationId} expectedItemId=${requestIdentity.itemId ?? 'missing'} expectedItemType=${requestIdentity.entityType} expectedShipId=${requestIdentity.containerId} responseCorrelationId=${response.correlationId ?? 'missing'} responseItemId=${response.itemId ?? 'missing'} responseItemType=${response.itemType ?? 'missing'} responseShipId=${response.shipId ?? 'missing'}`,
          );
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(
              new CustomEvent('socket-correlation-warning', {
                detail: {
                  operation: 'launch-item',
                  correlationId,
                  expectedRequestIdentity: requestIdentity,
                  responseCorrelationId: response.correlationId ?? null,
                  responseItemId: response.itemId ?? null,
                  responseItemType: response.itemType ?? null,
                  responseShipId: response.shipId ?? null,
                },
              }),
            );
          }
          return;
        }

        handled = true;
        unsubscribe?.();
        unsubscribe = null;
        onResponse(response);
      };

      unsubscribe = this.on(LAUNCH_ITEM_RESPONSE_EVENT, handleResponse);
    }

    this.emit(LAUNCH_ITEM_REQUEST_EVENT, requestWithCorrelation);
    return requestWithCorrelation;
  }

  /**
   * Listen to an event from the server
   * @param eventName - The name of the event to listen to
   * @param callback - Function to execute when event is received
   * @returns Function to unsubscribe from the event
   */
  on(eventName: string, callback: (data: any) => void): () => void {
    if (!this.socket) {
      appLogger.warn('Socket not initialized. Use connect() first');
      return () => {};
    }

    this.socket.on(eventName, callback);

    // Return unsubscribe function
    return () => {
      if (this.socket) {
        this.socket.off(eventName, callback);
      }
    };
  }

  /**
   * Listen to an event only once
   * @param eventName - The name of the event to listen to
   * @param callback - Function to execute when event is received
   */
  once(eventName: string, callback: (data: any) => void): void {
    if (!this.socket) {
      appLogger.warn('Socket not initialized. Use connect() first');
      return;
    }

    this.socket.once(eventName, callback);
  }

  /**
   * Remove a listener from an event
   * @param eventName - The name of the event
   * @param callback - The callback function to remove
   */
  off(eventName: string, callback?: (data: any) => void): void {
    if (!this.socket) {
      return;
    }

    if (callback) {
      this.socket.off(eventName, callback);
    } else {
      this.socket.off(eventName);
    }
  }

  /**
   * Get the current connection state
   */
  getIsConnected(): boolean {
    return this.isConnected();
  }

  /**
   * Get the current connection error
   */
  getConnectionError(): string | null {
    return this.connectionError();
  }

  /**
   * Get the socket instance (use with caution)
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Setup connection event listeners
   */
  private setupConnectionListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      this.isConnected.set(true);
      this.connectionError.set(null);
      appLogger.log('Socket connected:', this.socket?.id);
    });

    this.socket.on('disconnect', (reason: string) => {
      this.isConnected.set(false);
      appLogger.log('Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error: any) => {
      const errorMessage = error instanceof Error ? error.message : 'Connection error';
      this.connectionError.set(errorMessage);
      appLogger.error('Socket connection error:', errorMessage);
    });

    this.socket.on('error', (error: any) => {
      const errorMessage = error instanceof Error ? error.message : 'Socket error';
      appLogger.error('Socket error:', errorMessage);
    });
  }
}
