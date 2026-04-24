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
  SHIP_UPSERT_REQUEST_EVENT,
  SHIP_UPSERT_RESPONSE_EVENT,
  ShipUpsertRequest,
  ShipUpsertResponse,
} from '../model/ship-upsert';

/**
 * Socket.IO Service
 * 
 * Provides a centralized service for managing Socket.IO client connections
 * and communication with a Socket.IO server. Handles connection state management,
 * event emission, and event listening using Angular signals for reactivity.
 */
@Injectable({
  providedIn: 'root'
})
export class SocketService {
  public serverUrl = 'http://localhost:3000'; // Default server URL, can be overridden
  private socket: Socket | null = null;
  
  // Signal to track connection state
  protected isConnected = signal(false);
  protected connectionError = signal<string | null>(null);
  
  /**
   * Connect to a Socket.IO server
   * @param url - The server URL (e.g., 'http://localhost:3000')
   * @param options - Optional Socket.IO connection options
   */
  connect(url: string, options?: any): void {
    if (this.socket?.connected) {
      console.warn('Socket already connected');
      return;
    }

    try {
      this.socket = io(url, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        ...options
      });

      this.setupConnectionListeners();
      this.connectionError.set(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Connection failed';
      this.connectionError.set(errorMessage);
      console.error('Socket connection error:', errorMessage);
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
    if (!this.socket?.connected) {
      console.warn('Socket is not connected. Event not sent:', eventName);
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
  upsertShip(
    request: ShipUpsertRequest,
    onResponse?: (response: ShipUpsertResponse) => void,
  ): void {
    if (onResponse) {
      this.once(SHIP_UPSERT_RESPONSE_EVENT, onResponse);
    }

    this.emit(SHIP_UPSERT_REQUEST_EVENT, request);
  }

  /**
   * Listen to an event from the server
   * @param eventName - The name of the event to listen to
   * @param callback - Function to execute when event is received
   * @returns Function to unsubscribe from the event
   */
  on(eventName: string, callback: (data: any) => void): () => void {
    if (!this.socket) {
      console.warn('Socket not initialized. Use connect() first');
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
      console.warn('Socket not initialized. Use connect() first');
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
      console.log('Socket connected:', this.socket?.id);
    });

    this.socket.on('disconnect', (reason: string) => {
      this.isConnected.set(false);
      console.log('Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error: any) => {
      const errorMessage = error instanceof Error ? error.message : 'Connection error';
      this.connectionError.set(errorMessage);
      console.error('Socket connection error:', errorMessage);
    });

    this.socket.on('error', (error: any) => {
      const errorMessage = error instanceof Error ? error.message : 'Socket error';
      console.error('Socket error:', errorMessage);
    });
  }
}
