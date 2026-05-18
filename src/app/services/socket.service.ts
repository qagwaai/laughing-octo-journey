import { Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import {
  CELESTIAL_BODY_LIST_REQUEST_EVENT,
  CELESTIAL_BODY_LIST_RESPONSE_EVENT,
  CelestialBodyListRequest,
  CelestialBodyListResponse,
} from '../model/celestial-body-list';
import {
  CELESTIAL_BODY_UPSERT_REQUEST_EVENT,
  CELESTIAL_BODY_UPSERT_RESPONSE_EVENT,
  CelestialBodyUpsertRequest,
  CelestialBodyUpsertResponse,
} from '../model/celestial-body-upsert';
import {
  ITEM_UPSERT_REQUEST_EVENT,
  ITEM_UPSERT_RESPONSE_EVENT,
  ItemUpsertRequest,
  ItemUpsertResponse,
} from '../model/item-upsert';
import {
  LAUNCH_ITEM_REQUEST_EVENT,
  LAUNCH_ITEM_RESPONSE_EVENT,
  LaunchItemRequest,
  LaunchItemResponse,
} from '../model/launch-item';
import {
  SHIP_UPSERT_REQUEST_EVENT,
  SHIP_UPSERT_RESPONSE_EVENT,
  ShipUpsertRequest,
  ShipUpsertResponse,
} from '../model/ship-upsert';
import { appLogger } from './logger';

const ITEM_UPSERT_REQUEST_EVENT_ALIAS = 'upsert-item-request';
const ITEM_UPSERT_RESPONSE_EVENT_ALIAS = 'upsert-item-response';
const ITEM_UPSERT_ALIAS_FALLBACK_DELAY_MS = 750;
const ITEM_UPSERT_NO_RESPONSE_LOG_DELAY_MS = 3000;

function createCorrelationId(): string {
  const ts = Date.now().toString(36);
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `item-upsert:${ts}:${randomPart}`;
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
    if (onResponse) {
      this.once(CELESTIAL_BODY_UPSERT_RESPONSE_EVENT, onResponse);
    }

    this.emit(CELESTIAL_BODY_UPSERT_REQUEST_EVENT, request);
  }

  /**
   * Emit a celestial-body list request and optionally handle a one-time response.
   */
  listCelestialBodies(
    request: CelestialBodyListRequest,
    onResponse?: (response: CelestialBodyListResponse) => void,
  ): void {
    if (onResponse) {
      this.once(CELESTIAL_BODY_LIST_RESPONSE_EVENT, onResponse);
    }

    this.emit(CELESTIAL_BODY_LIST_REQUEST_EVENT, request);
  }

  /**
   * Emit a ship upsert request and optionally handle a one-time response.
   */
  upsertShip(request: ShipUpsertRequest, onResponse?: (response: ShipUpsertResponse) => void): void {
    const correlationId = request.correlationId?.trim() || `auto-${Date.now()}`;
    const shipUpsertWithCorrelation: ShipUpsertRequest = {
      ...request,
      correlationId,
      correlationSource: request.correlationSource?.trim() || 'socket.upsertShip',
    };

    if (onResponse) {
      this.once(SHIP_UPSERT_RESPONSE_EVENT, onResponse);
    }

    this.emit(SHIP_UPSERT_REQUEST_EVENT, shipUpsertWithCorrelation);
  }

  /**
   * Emit an item upsert request and optionally handle a one-time response.
   */
  upsertItem(request: ItemUpsertRequest, onResponse?: (response: ItemUpsertResponse) => void): void {
    const correlationId = request.correlationId?.trim() || createCorrelationId();
    const requestWithCorrelation: ItemUpsertRequest = {
      ...request,
      correlationId,
      correlationSource: request.correlationSource?.trim() || 'socket.upsertItem',
    };

    let handled = false;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
    let noResponseTimer: ReturnType<typeof setTimeout> | null = null;

    const clearTimers = () => {
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }

      if (noResponseTimer) {
        clearTimeout(noResponseTimer);
        noResponseTimer = null;
      }
    };

    if (onResponse) {
      const handleResponse = (response: ItemUpsertResponse) => {
        if (handled) {
          return;
        }

        handled = true;
        clearTimers();
        onResponse(response);
      };

      // Compatibility: support both legacy and canonical response event names.
      this.once(ITEM_UPSERT_RESPONSE_EVENT, handleResponse);
      this.once(ITEM_UPSERT_RESPONSE_EVENT_ALIAS, handleResponse);

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
          `No item-upsert response received on either alias. correlationId=${correlationId} requestId=${requestWithCorrelation.item?.id ?? 'new-item'} itemType=${requestWithCorrelation.item?.itemType ?? 'unknown'} state=${requestWithCorrelation.item?.state ?? 'unknown'} source=${requestWithCorrelation.correlationSource ?? 'unknown'}`,
        );
      }, ITEM_UPSERT_NO_RESPONSE_LOG_DELAY_MS);
    }

    this.emit(ITEM_UPSERT_REQUEST_EVENT, requestWithCorrelation);
  }

  /**
   * Emit a launch item request and optionally handle a one-time response.
   */
  launchItem(request: LaunchItemRequest, onResponse?: (response: LaunchItemResponse) => void): void {
    if (onResponse) {
      this.once(LAUNCH_ITEM_RESPONSE_EVENT, onResponse);
    }

    this.emit(LAUNCH_ITEM_REQUEST_EVENT, request);
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
