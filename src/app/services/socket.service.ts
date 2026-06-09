import { Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import {
  CELESTIAL_BODY_LIST_REQUEST_EVENT,
  CELESTIAL_BODY_LIST_RESPONSE_EVENT,
  CelestialBodyListRequest,
  CelestialBodyListResponse
} from '../model/celestial-body-list';
import {
  CELESTIAL_BODY_UPSERT_REQUEST_EVENT,
  CELESTIAL_BODY_UPSERT_RESPONSE_EVENT,
  CelestialBodyUpsertRequest,
  CelestialBodyUpsertResponse
} from '../model/celestial-body-upsert';
import {
  ITEM_UPSERT_REQUEST_EVENT,
  ITEM_UPSERT_RESPONSE_EVENT,
  ItemUpsertRequest,
  ItemUpsertResponse
} from '../model/item-upsert';
import {
  LAUNCH_ITEM_REQUEST_EVENT,
  LAUNCH_ITEM_RESPONSE_EVENT,
  LaunchItemRequest,
  LaunchItemResponse
} from '../model/launch-item';
import {
  SHIP_UPSERT_REQUEST_EVENT,
  SHIP_UPSERT_RESPONSE_EVENT,
  ShipUpsertRequest,
  ShipUpsertResponse,
} from '../model/ship-upsert';
import { appLogger } from './logger';
import { createCorrelationId } from './socket-correlation';
import { emitSocketCorrelationWarning } from './socket-correlation-warning';
import {
  buildDefaultCelestialBodyListRequestIdentity,
  buildDefaultCelestialBodyUpsertRequestIdentity,
  buildDefaultItemUpsertRequestIdentity,
  buildDefaultLaunchItemRequestIdentity,
  buildDefaultShipUpsertRequestIdentity,
  buildDomainPipelineKey,
} from './socket-domain-identity';
import { SocketRequestLifecycle } from './socket-request-lifecycle';
import {
  isCelestialBodyListResponseForRequest,
  isCelestialBodyUpsertResponseForRequest,
  isItemUpsertResponseForRequest,
  isLaunchItemResponseForRequest,
  isShipUpsertResponseForRequest,
} from './socket-response-matchers';

const ITEM_UPSERT_NO_RESPONSE_LOG_DELAY_MS = 3000;
const SHIP_UPSERT_NO_RESPONSE_LOG_DELAY_MS = 3000;
const DEFAULT_NO_RESPONSE_LOG_DELAY_MS = 3000;

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
  private readonly requestLifecycle = new SocketRequestLifecycle();

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
      appLogger.debug('Socket connect skipped: already connected');
      return;
    }

    if (this.socket?.active) {
      appLogger.debug('Socket connect skipped: connection already in progress');
      return;
    }

    if (this.socket) {
      this.socket.connect();
      this.connectionError.set(null);
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
    this.requestLifecycle.cancelPendingOperations('disconnect');

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected.set(false);
    }

    this.requestLifecycle.clearDomainPipeline();
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
    const socket = this.socket;
    if (!socket) {
      appLogger.warn('Socket not initialized. Use connect() first');
      return;
    }

    const correlationId = request.correlationId?.trim() || createCorrelationId('celestial-body-upsert');
    const requestIdentity = request.requestIdentity ?? buildDefaultCelestialBodyUpsertRequestIdentity(request);
    const domainKey = buildDomainPipelineKey({
      operation: requestIdentity.operation,
      entityType: requestIdentity.entityType,
      containerId: requestIdentity.containerId,
      characterId: request.createdByCharacterId,
    });
    const requestWithCorrelation: CelestialBodyUpsertRequest = {
      ...request,
      correlationId,
      correlationSource: request.correlationSource?.trim() || 'socket.upsertCelestialBody',
      requestIdentity,
    };

    this.requestLifecycle.runQueuedRequestWithResponse<CelestialBodyUpsertRequest, CelestialBodyUpsertResponse>({
      socket,
      domainKey,
      correlationId,
      requestEvent: CELESTIAL_BODY_UPSERT_REQUEST_EVENT,
      responseEvent: CELESTIAL_BODY_UPSERT_RESPONSE_EVENT,
      requestPayload: requestWithCorrelation,
      timeoutMs: DEFAULT_NO_RESPONSE_LOG_DELAY_MS,
      isResponseForRequest: (response) =>
        isCelestialBodyUpsertResponseForRequest(response, correlationId, requestIdentity, requestWithCorrelation),
      onResponseMatched: (response) => onResponse?.(response),
      onResponseMismatched: (response) => {
        appLogger.warn(
          `[socket-correlation] Dropping mismatched celestial-body-upsert response. expectedCorrelationId=${correlationId} expectedSourceScanId=${requestIdentity.containerId} expectedCatalogId=${requestIdentity.entityType} expectedRequestCharacterId=${requestIdentity.characterId ?? 'missing'} expectedRequestOperation=${requestIdentity.operation ?? 'missing'} responseCorrelationId=${response.correlationId ?? 'missing'} responseSourceScanId=${response.celestialBody?.sourceScanId ?? 'missing'} responseCatalogId=${response.celestialBody?.catalogId ?? 'missing'} responseRequestCharacterId=${response.requestIdentity?.characterId ?? 'missing'} responseRequestOperation=${response.requestIdentity?.operation ?? 'missing'}`,
        );
        emitSocketCorrelationWarning({
          operation: 'celestial-body-upsert',
          correlationId,
          expectedRequestIdentity: requestIdentity,
          responseCorrelationId: response.correlationId ?? null,
          responseSourceScanId: response.celestialBody?.sourceScanId ?? null,
          responseCatalogId: response.celestialBody?.catalogId ?? null,
        });
      },
      onTimeout: () => {
        appLogger.error(
          `No celestial-body-upsert response received. correlationId=${correlationId} operation=${requestIdentity.operation} entityType=${requestIdentity.entityType} containerId=${requestIdentity.containerId} requestSourceScanId=${requestWithCorrelation.celestialBody?.sourceScanId ?? 'unknown'} playerName=${requestWithCorrelation.playerName ?? 'unknown'} source=${requestWithCorrelation.correlationSource ?? 'unknown'}`,
        );
      },
    });
  }

  /**
   * Emit a celestial-body list request and optionally handle a one-time response.
   */
  listCelestialBodies(
    request: CelestialBodyListRequest,
    onResponse?: (response: CelestialBodyListResponse) => void,
  ): void {
    const socket = this.socket;
    if (!socket) {
      appLogger.warn('Socket not initialized. Use connect() first');
      return;
    }

    const correlationId = request.correlationId?.trim() || createCorrelationId('celestial-body-list');
    const requestIdentity = request.requestIdentity ?? buildDefaultCelestialBodyListRequestIdentity(request);
    const domainKey = buildDomainPipelineKey({
      operation: requestIdentity.operation,
      entityType: requestIdentity.entityType,
      containerId: requestIdentity.containerId,
      characterId: request.createdByCharacterId,
    });
    const requestWithCorrelation: CelestialBodyListRequest = {
      ...request,
      correlationId,
      correlationSource: request.correlationSource?.trim() || 'socket.listCelestialBodies',
      requestIdentity,
    };

    this.requestLifecycle.runQueuedRequestWithResponse<CelestialBodyListRequest, CelestialBodyListResponse>({
      socket,
      domainKey,
      correlationId,
      requestEvent: CELESTIAL_BODY_LIST_REQUEST_EVENT,
      responseEvent: CELESTIAL_BODY_LIST_RESPONSE_EVENT,
      requestPayload: requestWithCorrelation,
      timeoutMs: DEFAULT_NO_RESPONSE_LOG_DELAY_MS,
      isResponseForRequest: (response) =>
        isCelestialBodyListResponseForRequest(response, correlationId, requestIdentity, requestWithCorrelation),
      onResponseMatched: (response) => onResponse?.(response),
      onResponseMismatched: (response) => {
        appLogger.warn(
          `[socket-correlation] Dropping mismatched celestial-body-list response. expectedCorrelationId=${correlationId} expectedSolarSystemId=${requestIdentity.entityType} responseCorrelationId=${response.correlationId ?? 'missing'} responseSolarSystemId=${response.solarSystemId ?? 'missing'}`,
        );
        emitSocketCorrelationWarning({
          operation: 'celestial-body-list',
          correlationId,
          expectedRequestIdentity: requestIdentity,
          responseCorrelationId: response.correlationId ?? null,
          responseSolarSystemId: response.solarSystemId ?? null,
        });
      },
      onTimeout: () => {
        appLogger.error(
          `No celestial-body-list response received. correlationId=${correlationId} operation=${requestIdentity.operation} entityType=${requestIdentity.entityType} containerId=${requestIdentity.containerId} playerName=${requestWithCorrelation.playerName ?? 'unknown'} source=${requestWithCorrelation.correlationSource ?? 'unknown'}`,
        );
      },
    });
  }

  /**
   * Emit a ship upsert request and optionally handle a one-time response.
   */
  upsertShip(request: ShipUpsertRequest, onResponse?: (response: ShipUpsertResponse) => void): void {
    const socket = this.socket;
    if (!socket) {
      appLogger.warn('Socket not initialized. Use connect() first');
      return;
    }

    const correlationId = request.correlationId?.trim() || createCorrelationId('ship-upsert');
    const requestIdentity = request.requestIdentity ?? buildDefaultShipUpsertRequestIdentity(request);
    const domainKey = buildDomainPipelineKey({
      operation: requestIdentity.operation,
      entityType: requestIdentity.entityType,
      containerId: requestIdentity.containerId,
      characterId: request.characterId,
    });
    const shipUpsertWithCorrelation: ShipUpsertRequest = {
      ...request,
      correlationId,
      correlationSource: request.correlationSource?.trim() || 'socket.upsertShip',
      requestIdentity,
    };

    this.requestLifecycle.runQueuedRequestWithResponse<ShipUpsertRequest, ShipUpsertResponse>({
      socket,
      domainKey,
      correlationId,
      requestEvent: SHIP_UPSERT_REQUEST_EVENT,
      responseEvent: SHIP_UPSERT_RESPONSE_EVENT,
      requestPayload: shipUpsertWithCorrelation,
      timeoutMs: SHIP_UPSERT_NO_RESPONSE_LOG_DELAY_MS,
      isResponseForRequest: (response) =>
        isShipUpsertResponseForRequest(response, correlationId, requestIdentity, shipUpsertWithCorrelation),
      shouldIgnoreMismatch: (response) => {
        const responseCorrelationId = response.correlationId?.trim() ?? '';
        return !!responseCorrelationId && responseCorrelationId !== correlationId;
      },
      onResponseMatched: (response) => onResponse?.(response),
      onResponseMismatched: (response) => {
        appLogger.warn(
          `[socket-correlation] Dropping mismatched ship-upsert response. expectedCorrelationId=${correlationId} expectedShipId=${requestIdentity.containerId} expectedPlayerName=${shipUpsertWithCorrelation.playerName} expectedRequestOperation=${requestIdentity.operation ?? 'missing'} expectedRequestEntityType=${requestIdentity.entityType ?? 'missing'} expectedRequestContainerId=${requestIdentity.containerId ?? 'missing'} responseCorrelationId=${response.correlationId ?? 'missing'} responseShipId=${response.ship?.id ?? 'missing'} responseCharacterId=${response.characterId ?? 'missing'} responsePlayerName=${response.playerName ?? 'missing'} responseRequestOperation=${response.requestIdentity?.operation ?? 'missing'} responseRequestEntityType=${response.requestIdentity?.entityType ?? 'missing'} responseRequestContainerId=${response.requestIdentity?.containerId ?? 'missing'}`,
        );
        emitSocketCorrelationWarning({
          operation: 'ship-upsert',
          correlationId,
          expectedRequestIdentity: requestIdentity,
          responseCorrelationId: response.correlationId ?? null,
          responseShipId: response.ship?.id ?? null,
          responseCharacterId: response.characterId ?? null,
          responsePlayerName: response.playerName ?? null,
        });
      },
      onTimeout: () => {
        appLogger.error(
          `No ship-upsert response received. correlationId=${correlationId} operation=${requestIdentity.operation} entityType=${requestIdentity.entityType} containerId=${requestIdentity.containerId} requestShipId=${shipUpsertWithCorrelation.ship?.id ?? 'unknown'} playerName=${shipUpsertWithCorrelation.playerName ?? 'unknown'} source=${shipUpsertWithCorrelation.correlationSource ?? 'unknown'}`,
        );
      },
    });
  }

  /**
   * Emit an item upsert request and optionally handle a one-time response.
   */
  upsertItem(request: ItemUpsertRequest, onResponse?: (response: ItemUpsertResponse) => void): void {
    const socket = this.socket;
    if (!socket) {
      appLogger.warn('Socket not initialized. Use connect() first');
      return;
    }

    const correlationId = request.correlationId?.trim() || createCorrelationId('item-upsert');
    const requestIdentity = request.requestIdentity ?? buildDefaultItemUpsertRequestIdentity(request);
    const domainKey = buildDomainPipelineKey({
      operation: requestIdentity.operation,
      entityType: requestIdentity.entityType,
      containerId: requestIdentity.containerId,
      characterId: request.item?.owningCharacterId ?? undefined,
    });
    const requestWithCorrelation: ItemUpsertRequest = {
      ...request,
      correlationId,
      correlationSource: request.correlationSource?.trim() || 'socket.upsertItem',
      requestIdentity,
    };

    this.requestLifecycle.runQueuedRequestWithResponse<ItemUpsertRequest, ItemUpsertResponse>({
      socket,
      domainKey,
      correlationId,
      requestEvent: ITEM_UPSERT_REQUEST_EVENT,
      responseEvent: ITEM_UPSERT_RESPONSE_EVENT,
      requestPayload: requestWithCorrelation,
      timeoutMs: ITEM_UPSERT_NO_RESPONSE_LOG_DELAY_MS,
      isResponseForRequest: (response) => isItemUpsertResponseForRequest(response, correlationId, requestIdentity),
      shouldIgnoreMismatch: (response) => {
        const responseCorrelationId = response.correlationId?.trim() ?? '';
        // Multiple item-upsert requests can legitimately be in flight at once.
        // Ignore responses targeted at other correlations without surfacing
        // a contract warning for this listener.
        return !!responseCorrelationId && responseCorrelationId !== correlationId;
      },
      onResponseMatched: (response) => onResponse?.(response),
      onResponseMismatched: (response) => {
        appLogger.warn(
          `[socket-correlation] Dropping mismatched item-upsert response. expectedCorrelationId=${correlationId} expectedEntityType=${requestIdentity.entityType} expectedContainerId=${requestIdentity.containerId} responseCorrelationId=${response.correlationId ?? 'missing'} responseEntityType=${response.item?.itemType ?? 'missing'} responseContainerId=${response.item?.container?.containerId ?? 'missing'}`,
        );
        emitSocketCorrelationWarning({
          operation: 'item-upsert',
          correlationId,
          expectedRequestIdentity: requestIdentity,
          responseCorrelationId: response.correlationId ?? null,
          responseItemType: response.item?.itemType ?? null,
          responseContainerId: response.item?.container?.containerId ?? null,
        });
      },
      onTimeout: () => {
        appLogger.error(
          `No item-upsert response received. correlationId=${correlationId} operation=${requestIdentity.operation} entityType=${requestIdentity.entityType} containerId=${requestIdentity.containerId} requestId=${requestWithCorrelation.item?.id ?? 'new-item'} itemType=${requestWithCorrelation.item?.itemType ?? 'unknown'} state=${requestWithCorrelation.item?.state ?? 'unknown'} source=${requestWithCorrelation.correlationSource ?? 'unknown'}`,
        );
      },
    });
  }

  /**
   * Emit a launch item request and optionally handle a one-time response.
   */
  launchItem(request: LaunchItemRequest, onResponse?: (response: LaunchItemResponse) => void): LaunchItemRequest {
    const socket = this.socket;
    if (!socket) {
      appLogger.warn('Socket not initialized. Use connect() first');
      return request;
    }

    const correlationId = request.correlationId?.trim() || createCorrelationId('launch-item');
    const requestIdentity = request.requestIdentity ?? buildDefaultLaunchItemRequestIdentity(request);
    const requestWithCorrelation: LaunchItemRequest = {
      ...request,
      correlationId,
      correlationSource: request.correlationSource?.trim() || 'socket.launchItem',
      requestIdentity,
    };

    if (!onResponse) {
      socket.emit(LAUNCH_ITEM_REQUEST_EVENT, requestWithCorrelation);
      return requestWithCorrelation;
    }

    const domainKey = buildDomainPipelineKey({
      operation: requestIdentity.operation,
      entityType: requestIdentity.entityType,
      containerId: requestIdentity.containerId,
      characterId: requestIdentity.characterId,
    });

    this.requestLifecycle.runQueuedRequestWithResponse<LaunchItemRequest, LaunchItemResponse>({
      socket,
      domainKey,
      correlationId,
      requestEvent: LAUNCH_ITEM_REQUEST_EVENT,
      responseEvent: LAUNCH_ITEM_RESPONSE_EVENT,
      requestPayload: requestWithCorrelation,
      timeoutMs: DEFAULT_NO_RESPONSE_LOG_DELAY_MS,
      isResponseForRequest: (response) =>
        isLaunchItemResponseForRequest(response, correlationId, requestIdentity, requestWithCorrelation),
      onResponseMatched: (response) => onResponse(response),
      onResponseMismatched: (response) => {
        appLogger.warn(
          `[socket-correlation] Dropping mismatched launch-item response. expectedCorrelationId=${correlationId} expectedItemId=${requestIdentity.itemId ?? 'missing'} expectedItemType=${requestIdentity.entityType} expectedShipId=${requestIdentity.containerId} responseCorrelationId=${response.correlationId ?? 'missing'} responseItemId=${response.itemId ?? 'missing'} responseItemType=${response.itemType ?? 'missing'} responseShipId=${response.shipId ?? 'missing'}`,
        );
        emitSocketCorrelationWarning({
          operation: 'launch-item',
          correlationId,
          expectedRequestIdentity: requestIdentity,
          responseCorrelationId: response.correlationId ?? null,
          responseItemId: response.itemId ?? null,
          responseItemType: response.itemType ?? null,
          responseShipId: response.shipId ?? null,
        });
      },
      onTimeout: () => {
        appLogger.error(
          `No launch-item response received. correlationId=${correlationId} operation=${requestIdentity.operation} entityType=${requestIdentity.entityType} containerId=${requestIdentity.containerId} itemId=${requestIdentity.itemId ?? 'missing'} characterId=${requestIdentity.characterId ?? 'missing'} source=${requestWithCorrelation.correlationSource ?? 'unknown'}`,
        );
      },
    });
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

    const socketAtSubscription = this.socket;
    socketAtSubscription.on(eventName, callback);

    // Return unsubscribe function
    return () => {
      socketAtSubscription.off(eventName, callback);
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
