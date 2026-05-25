import {
  CELESTIAL_BODY_LIST_REQUEST_EVENT,
  CELESTIAL_BODY_LIST_RESPONSE_EVENT,
  type CelestialBodyListRequest,
} from '../model/celestial-body-list';
import {
  CELESTIAL_BODY_UPSERT_REQUEST_EVENT,
  CELESTIAL_BODY_UPSERT_RESPONSE_EVENT,
  type CelestialBodyUpsertRequest,
} from '../model/celestial-body-upsert';
import { ITEM_UPSERT_REQUEST_EVENT, ITEM_UPSERT_RESPONSE_EVENT, type ItemUpsertRequest } from '../model/item-upsert';
import { LAUNCH_ITEM_REQUEST_EVENT, LAUNCH_ITEM_RESPONSE_EVENT, type LaunchItemRequest } from '../model/launch-item';
import { SHIP_UPSERT_REQUEST_EVENT, SHIP_UPSERT_RESPONSE_EVENT, type ShipUpsertRequest } from '../model/ship-upsert';
import { SocketService } from './socket.service';

describe('SocketService', () => {
  let service: SocketService;

  beforeEach(() => {
    service = new SocketService();
  });

  afterEach(() => {
    if (service && service.getSocket()) {
      service.disconnect();
    }
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with disconnected state', () => {
    expect(service.getIsConnected()).toBe(false);
    expect(service.getConnectionError()).toBeNull();
  });

  it('should initialize with a socket instance due to auto-connect in constructor', () => {
    expect(service.getSocket()).not.toBeNull();
  });

  describe('connect', () => {
    it('should warn if already connected', () => {
      // Mock socket connection
      service['socket'] = { connected: true, disconnect: () => {} } as any;
      service.connect('http://localhost:3000');

      // Verify socket is still the same (not reconnected)
      expect(service.getSocket()).toBeTruthy();
    });

    it('should accept custom options', () => {
      const options = {
        reconnection: false,
        reconnectionDelay: 500,
      };

      // This will fail without a server, but we're testing option passing
      service.connect('http://localhost:3000', options);

      // Verify no unhandled errors
      expect(service).toBeTruthy();
    });
  });

  describe('emit', () => {
    it('should warn if socket is not initialized', () => {
      const warnSpy = spyOn(console, 'warn');
      service['socket'] = null;
      service.emit('test', { data: 'test' });

      expect(warnSpy).toHaveBeenCalledWith('Socket not initialized. Use connect() first');
    });

    it('should emit event with callback', () => {
      let emitCalled = false;
      let callbackCalled = false;

      const mockSocket = {
        connected: true,
        emit: (event: string, data: any, cb?: Function) => {
          emitCalled = true;
          if (cb) cb(data);
        },
        on: (event: string, callback: Function) => {},
        off: (event: string, callback?: Function) => {},
        disconnect: () => {},
      };
      service['socket'] = mockSocket as any;

      const callback = () => {
        callbackCalled = true;
      };
      service.emit('test', { data: 'test' }, callback);

      expect(emitCalled).toBe(true);
      expect(callbackCalled).toBe(true);
    });

    it('should emit event without callback', () => {
      let emitCalled = false;

      const mockSocket = {
        connected: true,
        emit: (event: string, data?: any) => {
          emitCalled = true;
        },
        on: (event: string, callback: Function) => {},
        off: (event: string, callback?: Function) => {},
        disconnect: () => {},
      };
      service['socket'] = mockSocket as any;

      service.emit('test', { data: 'test' });

      expect(emitCalled).toBe(true);
    });
  });

  describe('upsertCelestialBody', () => {
    it('should emit celestial-body upsert request and resolve only matching responses', () => {
      const emittedEvents: Array<{ event: string; payload: unknown }> = [];
      const onEvents = new Map<string, Array<(data: unknown) => void>>();

      const mockSocket = {
        connected: true,
        emit: (event: string, data?: unknown) => {
          emittedEvents.push({ event, payload: data });
        },
        once: (event: string, callback: (data: unknown) => void) => {},
        on: (event: string, callback: (data: unknown) => void) => {
          const callbacks = onEvents.get(event) ?? [];
          callbacks.push(callback);
          onEvents.set(event, callbacks);
        },
        off: (event: string, callback?: Function) => {
          if (!callback) {
            onEvents.delete(event);
            return;
          }

          const callbacks = onEvents.get(event) ?? [];
          onEvents.set(
            event,
            callbacks.filter((candidate) => candidate !== callback),
          );
        },
        disconnect: () => {},
      };
      service['socket'] = mockSocket as any;

      const request: CelestialBodyUpsertRequest = {
        sessionKey: 'session-123',
        playerName: 'Pioneer',
        createdByCharacterId: 'char-1',
        celestialBody: {
          id: 'cb-1',
          catalogId: 'sol-cb-1',
          sourceScanId: 'sample-a1',
          createdByCharacterId: 'char-1',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: { x: 1, y: 2, z: 3 },
            epochMs: Date.now(),
          },
          motion: {
            velocityKmPerSec: { x: 0, y: 0, z: 0 },
            angularVelocityRadPerSec: { x: 0, y: 0, z: 0 },
          },
          physical: {
            estimatedMassKg: 10,
            estimatedDiameterM: 4,
          },
          observability: {
            visibility: 'visible',
            scanState: 'scanned',
          },
          composition: { rarity: 'Common', material: 'Carbon', textureColor: '#6f7785' },
        },
      };

      let callbackResponse: unknown;
      service.upsertCelestialBody(request, (response) => {
        callbackResponse = response;
      });

      expect(onEvents.has(CELESTIAL_BODY_UPSERT_RESPONSE_EVENT)).toBeTrue();
      expect(emittedEvents.map((entry) => entry.event)).toEqual([CELESTIAL_BODY_UPSERT_REQUEST_EVENT]);
      expect(emittedEvents[0]?.payload).toEqual(
        jasmine.objectContaining({
          ...request,
          correlationId: jasmine.any(String),
          correlationSource: 'socket.upsertCelestialBody',
          requestIdentity: {
            operation: 'celestial-body-upsert',
            entityType: 'celestial-body',
            containerId: 'cb-1',
          },
        }),
      );

      const requestPayload = emittedEvents[0]?.payload as CelestialBodyUpsertRequest;
      const correlationId = requestPayload.correlationId!;
      const requestIdentity = requestPayload.requestIdentity!;

      const mismatchResponse = {
        success: true,
        message: 'wrong response',
        correlationId: 'wrong-correlation-id',
        requestIdentity,
        celestialBody: { ...request.celestialBody, sourceScanId: 'sample-other' },
      };
      const callbacks = onEvents.get(CELESTIAL_BODY_UPSERT_RESPONSE_EVENT) ?? [];
      callbacks[0]?.(mismatchResponse);
      expect(callbackResponse).toBeUndefined();

      const fakeResponse = {
        success: true,
        message: 'ok',
        correlationId,
        requestIdentity,
        celestialBody: request.celestialBody,
      };
      callbacks[0]?.(fakeResponse);
      expect(callbackResponse).toEqual(fakeResponse);
    });

  });

  describe('listCelestialBodies', () => {
    it('should emit celestial-body list request and resolve only matching responses', () => {
      const emittedEvents: Array<{ event: string; payload: unknown }> = [];
      const onEvents = new Map<string, Array<(data: unknown) => void>>();

      const mockSocket = {
        connected: true,
        emit: (event: string, data?: unknown) => {
          emittedEvents.push({ event, payload: data });
        },
        once: (event: string, callback: (data: unknown) => void) => {},
        on: (event: string, callback: (data: unknown) => void) => {
          const callbacks = onEvents.get(event) ?? [];
          callbacks.push(callback);
          onEvents.set(event, callbacks);
        },
        off: (event: string, callback?: Function) => {
          if (!callback) {
            onEvents.delete(event);
            return;
          }

          const callbacks = onEvents.get(event) ?? [];
          onEvents.set(
            event,
            callbacks.filter((candidate) => candidate !== callback),
          );
        },
        disconnect: () => {},
      };
      service['socket'] = mockSocket as any;

      const request: CelestialBodyListRequest = {
        sessionKey: 'session-123',
        playerName: 'Pioneer',
        solarSystemId: 'sol',
        positionKm: { x: 0, y: 0, z: 0 },
        distanceKm: 1000,
      };

      let callbackResponse: unknown;
      service.listCelestialBodies(request, (response) => {
        callbackResponse = response;
      });

      expect(onEvents.has(CELESTIAL_BODY_LIST_RESPONSE_EVENT)).toBeTrue();
      expect(emittedEvents.map((entry) => entry.event)).toEqual([CELESTIAL_BODY_LIST_REQUEST_EVENT]);
      expect(emittedEvents[0]?.payload).toEqual(
        jasmine.objectContaining({
          ...request,
          correlationId: jasmine.any(String),
          correlationSource: 'socket.listCelestialBodies',
          requestIdentity: {
            operation: 'celestial-body-list',
            entityType: 'celestial-body',
            containerId: 'sol',
          },
        }),
      );

      const requestPayload = emittedEvents[0]?.payload as CelestialBodyListRequest;
      const correlationId = requestPayload.correlationId!;
      const requestIdentity = requestPayload.requestIdentity!;

      const mismatchResponse = {
        success: true,
        message: 'wrong response',
        correlationId: 'wrong-correlation-id',
        requestIdentity,
        playerName: 'Pioneer',
        solarSystemId: 'alpha-centauri',
        positionKm: { x: 0, y: 0, z: 0 },
        distanceKm: 1000,
        celestialBodies: [],
      };
      const callbacks = onEvents.get(CELESTIAL_BODY_LIST_RESPONSE_EVENT) ?? [];
      callbacks[0]?.(mismatchResponse);
      expect(callbackResponse).toBeUndefined();

      const fakeResponse = {
        success: true,
        message: 'ok',
        correlationId,
        requestIdentity,
        playerName: 'Pioneer',
        solarSystemId: 'sol',
        positionKm: { x: 0, y: 0, z: 0 },
        distanceKm: 1000,
        celestialBodies: [],
      };
      callbacks[0]?.(fakeResponse);
      expect(callbackResponse).toEqual(fakeResponse);
    });
  });

  describe('upsertShip', () => {
    it('should emit ship upsert request and resolve only matching ship-upsert responses', () => {
      const emittedEvents: Array<{ event: string; payload: unknown }> = [];
      const onEvents = new Map<string, Array<(data: unknown) => void>>();

      const mockSocket = {
        connected: true,
        emit: (event: string, data?: unknown) => {
          emittedEvents.push({ event, payload: data });
        },
        once: (event: string, callback: (data: unknown) => void) => {},
        on: (event: string, callback: (data: unknown) => void) => {
          const callbacks = onEvents.get(event) ?? [];
          callbacks.push(callback);
          onEvents.set(event, callbacks);
        },
        off: (event: string, callback?: Function) => {
          if (!callback) {
            onEvents.delete(event);
            return;
          }

          const callbacks = onEvents.get(event) ?? [];
          onEvents.set(
            event,
            callbacks.filter((candidate) => candidate !== callback),
          );
        },
        disconnect: () => {},
      };
      service['socket'] = mockSocket as any;

      const request: ShipUpsertRequest = {
        playerName: 'Pioneer',
        characterId: 'char-1',
        sessionKey: 'session-123',
        ship: {
          id: 'starter-char-1',
          model: 'Scavenger Pod',
          tier: 1,
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: { x: 1, y: 2, z: 3 },
            epochMs: 123,
          },
          motion: {
            velocityKmPerSec: { x: 0.1, y: 0, z: 0.2 },
          },
        },
      };

      let callbackResponse: unknown;
      service.upsertShip(request, (response) => {
        callbackResponse = response;
      });

      expect(onEvents.has(SHIP_UPSERT_RESPONSE_EVENT)).toBeTrue();
      expect(emittedEvents.map((entry) => entry.event)).toEqual([SHIP_UPSERT_REQUEST_EVENT]);
      expect(emittedEvents[0]?.payload).toEqual(
        jasmine.objectContaining({
          ...request,
          correlationId: jasmine.any(String),
          correlationSource: 'socket.upsertShip',
          requestIdentity: {
            operation: 'ship-upsert',
            entityType: 'ship',
            containerId: 'starter-char-1',
          },
        }),
      );

      const requestPayload = emittedEvents[0]?.payload as ShipUpsertRequest;
      const correlationId = requestPayload.correlationId!;
      const requestIdentity = requestPayload.requestIdentity!;

      const mismatchResponse = {
        success: true,
        message: 'wrong response',
        playerName: 'Pioneer',
        characterId: 'char-2',
        correlationId: 'wrong-correlation-id',
        requestIdentity,
        ship: { ...request.ship, id: 'starter-char-2', shipName: 'Wrong Ship' },
      };
      const callbacks = onEvents.get(SHIP_UPSERT_RESPONSE_EVENT) ?? [];
      callbacks[0]?.(mismatchResponse);
      expect(callbackResponse).toBeUndefined();

      const fakeResponse = {
        success: true,
        message: 'ok',
        playerName: 'Pioneer',
        characterId: 'char-1',
        correlationId,
        requestIdentity,
        ship: { ...request.ship, shipName: 'Starter Ship' },
      };
      callbacks[0]?.(fakeResponse);
      expect(callbackResponse).toEqual(fakeResponse);
    });

  });

  describe('upsertItem', () => {
    afterEach(() => {
      jasmine.clock().uninstall();
    });

    it('should register canonical response listener and resolve only matching item-upsert responses', () => {
      jasmine.clock().install();

      const emittedEvents: Array<{ event: string; payload: unknown }> = [];
      const onEvents = new Map<string, Array<(data: unknown) => void>>();

      const mockSocket = {
        connected: true,
        emit: (event: string, data?: unknown) => {
          emittedEvents.push({ event, payload: data });
        },
        once: (event: string, callback: (data: unknown) => void) => {},
        on: (event: string, callback: (data: unknown) => void) => {
          const callbacks = onEvents.get(event) ?? [];
          callbacks.push(callback);
          onEvents.set(event, callbacks);
        },
        off: (event: string, callback?: Function) => {
          if (!callback) {
            onEvents.delete(event);
            return;
          }

          const callbacks = onEvents.get(event) ?? [];
          onEvents.set(
            event,
            callbacks.filter((candidate) => candidate !== callback),
          );
        },
        disconnect: () => {},
      };
      service['socket'] = mockSocket as any;

      const request: ItemUpsertRequest = {
        playerName: 'Pioneer',
        sessionKey: 'session-123',
        item: {
          itemType: 'expendable-dart-drone',
          displayName: 'Expendable Dart Drone',
          state: 'contained',
          damageStatus: 'intact',
          container: { containerType: 'ship', containerId: 'ship-1' },
          owningCharacterId: 'char-1',
        },
      };

      let callbackResponse: unknown;
      service.upsertItem(request, (response) => {
        callbackResponse = response;
      });

      const emittedEventNames = emittedEvents.map((entry) => entry.event);

      expect(onEvents.has(ITEM_UPSERT_RESPONSE_EVENT)).toBeTrue();
      expect(onEvents.has('upsert-item-response')).toBeFalse();
      expect(emittedEventNames).toEqual([ITEM_UPSERT_REQUEST_EVENT]);
      expect(emittedEvents.find((entry) => entry.event === ITEM_UPSERT_REQUEST_EVENT)?.payload).toEqual(
        jasmine.objectContaining({
          ...request,
          correlationId: jasmine.any(String),
          correlationSource: 'socket.upsertItem',
          requestIdentity: {
            operation: 'item-upsert',
            entityType: 'expendable-dart-drone',
            containerId: 'ship-1',
          },
        }),
      );

      const requestPayload = emittedEvents.find((entry) => entry.event === ITEM_UPSERT_REQUEST_EVENT)?.payload as ItemUpsertRequest;
      const correlationId = requestPayload.correlationId!;
      const requestIdentity = requestPayload.requestIdentity!;

      const fakeResponse = {
        success: true,
        message: 'Item created.',
        playerName: 'Pioneer',
        correlationId,
        requestIdentity,
        item: { ...request.item, id: 'item-1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
      };

      const mismatchResponse = {
        success: true,
        message: 'mismatch',
        playerName: 'Pioneer',
        correlationId: 'wrong-correlation-id',
        requestIdentity,
        item: {
          ...request.item,
          itemType: 'sensor-array',
          container: { containerType: 'ship', containerId: 'ship-2' },
          id: 'wrong-item',
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
      };

      const canonicalCallbacks = onEvents.get(ITEM_UPSERT_RESPONSE_EVENT) ?? [];
      canonicalCallbacks[0]?.(mismatchResponse);
      expect(callbackResponse).toBeUndefined();

      canonicalCallbacks[0]?.(fakeResponse);
      jasmine.clock().tick(1000);
      canonicalCallbacks[0]?.({ success: true, message: 'duplicate', playerName: 'Pioneer' });

      expect(callbackResponse).toEqual(fakeResponse);
      expect(emittedEvents.map((entry) => entry.event)).toEqual([ITEM_UPSERT_REQUEST_EVENT]);
    });

    it('should emit only canonical item-upsert request when no response arrives', () => {
      jasmine.clock().install();

      const emittedEvents: Array<{ event: string; payload: unknown }> = [];

      const mockSocket = {
        connected: true,
        emit: (event: string, data?: unknown) => {
          emittedEvents.push({ event, payload: data });
        },
        once: (event: string, callback: (data: unknown) => void) => {},
        on: (event: string, callback: Function) => {},
        off: (event: string, callback?: Function) => {},
        disconnect: () => {},
      };
      service['socket'] = mockSocket as any;

      const request: ItemUpsertRequest = {
        playerName: 'Pioneer',
        sessionKey: 'session-123',
        item: {
          itemType: 'hull-patch-kit',
          displayName: 'Hull Patch Kit',
          state: 'contained',
          damageStatus: 'intact',
          container: { containerType: 'ship', containerId: 'ship-1' },
          owningCharacterId: 'char-1',
        },
      };

      service.upsertItem(request, () => {});
      expect(emittedEvents.map((entry) => entry.event)).toEqual([ITEM_UPSERT_REQUEST_EVENT]);
      expect(emittedEvents[0]?.payload).toEqual(
        jasmine.objectContaining({
          ...request,
          correlationId: jasmine.any(String),
          correlationSource: 'socket.upsertItem',
        }),
      );

      jasmine.clock().tick(1000);
      expect(emittedEvents.map((entry) => entry.event)).toEqual([ITEM_UPSERT_REQUEST_EVENT]);
    });

    it('should use canonical item-upsert for existing item updates when no response arrives', () => {
      jasmine.clock().install();

      const emittedEvents: Array<{ event: string; payload: unknown }> = [];

      const mockSocket = {
        connected: true,
        emit: (event: string, data?: unknown) => {
          emittedEvents.push({ event, payload: data });
        },
        once: (event: string, callback: (data: unknown) => void) => {},
        on: (event: string, callback: Function) => {},
        off: (event: string, callback?: Function) => {},
        disconnect: () => {},
      };
      service['socket'] = mockSocket as any;

      const request: ItemUpsertRequest = {
        playerName: 'Pioneer',
        sessionKey: 'session-123',
        item: {
          id: 'item-1',
          itemType: 'hull-patch-kit',
          displayName: 'Hull Patch Kit',
          launchable: false,
          state: 'destroyed',
          damageStatus: 'destroyed',
          container: null,
          destroyedAt: '2026-05-18T00:00:00.000Z',
          destroyedReason: 'Consumed by repair',
        },
      };

      service.upsertItem(request, () => {});

      expect(emittedEvents.map((entry) => entry.event)).toEqual([ITEM_UPSERT_REQUEST_EVENT]);
      expect(emittedEvents[0]?.payload).toEqual(
        jasmine.objectContaining({
          ...request,
          correlationId: jasmine.any(String),
          correlationSource: 'socket.upsertItem',
        }),
      );

      jasmine.clock().tick(1000);
      expect(emittedEvents.map((entry) => entry.event)).toEqual([ITEM_UPSERT_REQUEST_EVENT]);
    });
  });

  describe('launchItem', () => {
    it('should register a filtered listener for launch-item-response and emit launch-item-request with correlation metadata', () => {
      const emittedEvents: Array<{ event: string; payload: unknown }> = [];
      const onEvents = new Map<string, Array<(data: unknown) => void>>();

      const mockSocket = {
        connected: true,
        emit: (event: string, data?: unknown) => {
          emittedEvents.push({ event, payload: data });
        },
        once: (event: string, callback: (data: unknown) => void) => {},
        on: (event: string, callback: (data: unknown) => void) => {
          const callbacks = onEvents.get(event) ?? [];
          callbacks.push(callback);
          onEvents.set(event, callbacks);
        },
        off: (event: string, callback?: Function) => {
          if (!callback) {
            onEvents.delete(event);
            return;
          }

          const callbacks = onEvents.get(event) ?? [];
          onEvents.set(
            event,
            callbacks.filter((candidate) => candidate !== callback),
          );
        },
        disconnect: () => {},
      };
      service['socket'] = mockSocket as any;

      const request: LaunchItemRequest = {
        playerName: 'Pioneer',
        characterId: 'char-1',
        shipId: 'ship-1',
        sessionKey: 'session-123',
        targetCelestialBodyId: 'sample-a3',
        hotkey: 3,
        itemId: 'item-3',
        itemType: 'expendable-dart-drone',
      };

      let callbackResponse: unknown;
      service.launchItem(request, (response) => {
        callbackResponse = response;
      });

      expect(onEvents.has(LAUNCH_ITEM_RESPONSE_EVENT)).toBeTrue();
      expect(emittedEvents.map((entry) => entry.event)).toEqual([LAUNCH_ITEM_REQUEST_EVENT]);
      expect(emittedEvents[0]?.payload).toEqual(
        jasmine.objectContaining({
          ...request,
          correlationId: jasmine.any(String),
          correlationSource: 'socket.launchItem',
          requestIdentity: {
            operation: 'launch-item',
            entityType: 'expendable-dart-drone',
            containerId: 'ship-1',
            itemId: 'item-3',
            hotkey: 3,
            targetCelestialBodyId: 'sample-a3',
            characterId: 'char-1',
          },
        }),
      );

      const requestPayload = emittedEvents[0]?.payload as LaunchItemRequest;
      const correlationId = requestPayload.correlationId!;
      const requestIdentity = requestPayload.requestIdentity!;

      const mismatchResponse = {
        success: true,
        message: 'wrong launch',
        ...request,
        correlationId: 'wrong-correlation-id',
      };
      const callbacks = onEvents.get(LAUNCH_ITEM_RESPONSE_EVENT) ?? [];
      callbacks[0]?.(mismatchResponse);
      expect(callbackResponse).toBeUndefined();

      const fakeResponse = {
        success: true,
        message: 'Launch queued.',
        ...request,
        correlationId,
        requestIdentity,
      };
      callbacks[0]?.(fakeResponse);
      expect(callbackResponse).toEqual(fakeResponse);
    });
  });

  describe('on', () => {
    it('should warn if socket not initialized', () => {
      const warnSpy = spyOn(console, 'warn');
      service['socket'] = null;
      const unsubscribe = service.on('test', () => {});

      expect(warnSpy).toHaveBeenCalledWith('Socket not initialized. Use connect() first');
      expect(unsubscribe()).toBeUndefined();
    });

    it('should register event listener', () => {
      let onCalled = false;
      let offCalled = false;

      const mockSocket = {
        connected: true,
        on: (event: string, callback: Function) => {
          onCalled = true;
        },
        off: (event: string, callback?: Function) => {
          offCalled = true;
        },
        disconnect: () => {},
      };
      service['socket'] = mockSocket as any;

      const callback = () => {};
      const unsubscribe = service.on('test', callback);

      expect(onCalled).toBe(true);

      // Test unsubscribe
      unsubscribe();
      expect(offCalled).toBe(true);
    });
  });

  describe('once', () => {
    it('should warn if socket not initialized', () => {
      const warnSpy = spyOn(console, 'warn');
      service['socket'] = null;
      service.once('test', () => {});

      expect(warnSpy).toHaveBeenCalledWith('Socket not initialized. Use connect() first');
    });

    it('should register one-time event listener', () => {
      let onceCalled = false;

      const mockSocket = {
        connected: true,
        once: (event: string, callback: Function) => {
          onceCalled = true;
        },
        on: (event: string, callback: Function) => {},
        off: (event: string, callback?: Function) => {},
        disconnect: () => {},
      };
      service['socket'] = mockSocket as any;

      const callback = () => {};
      service.once('test', callback);

      expect(onceCalled).toBe(true);
    });
  });

  describe('off', () => {
    it('should do nothing if socket not initialized', () => {
      expect(() => service.off('test')).not.toThrow();
    });

    it('should remove specific event listener', () => {
      let offCalled = false;

      const mockSocket = {
        connected: true,
        off: (event: string, callback?: Function) => {
          offCalled = true;
        },
        on: (event: string, callback: Function) => {},
        once: (event: string, callback: Function) => {},
        disconnect: () => {},
      };
      service['socket'] = mockSocket as any;

      const callback = () => {};
      service.off('test', callback);

      expect(offCalled).toBe(true);
    });

    it('should remove all listeners for event', () => {
      let offCalled = false;

      const mockSocket = {
        connected: true,
        off: (event: string, callback?: Function) => {
          offCalled = true;
        },
        on: (event: string, callback: Function) => {},
        once: (event: string, callback: Function) => {},
        disconnect: () => {},
      };
      service['socket'] = mockSocket as any;

      service.off('test');

      expect(offCalled).toBe(true);
    });
  });

  describe('disconnect', () => {
    it('should disconnect socket', () => {
      let disconnectCalled = false;

      const mockSocket = {
        connected: true,
        disconnect: () => {
          disconnectCalled = true;
        },
        on: (event: string, callback: Function) => {},
        off: (event: string, callback?: Function) => {},
      };
      service['socket'] = mockSocket as any;
      service['isConnected'].set(true);

      service.disconnect();

      expect(disconnectCalled).toBe(true);
      expect(service.getSocket()).toBeNull();
      expect(service.getIsConnected()).toBe(false);
    });

    it('should handle disconnect when socket is null', () => {
      expect(() => service.disconnect()).not.toThrow();
      expect(service.getIsConnected()).toBe(false);
    });
  });

  describe('setupConnectionListeners', () => {
    it('should set isConnected to true on connect event', () => {
      const mockSocket = {
        connected: true,
        on: (event: string, callback: Function) => {
          if (event === 'connect') {
            callback();
          }
        },
        off: (event: string, callback?: Function) => {},
        disconnect: () => {},
      };
      service['socket'] = mockSocket as any;

      service['setupConnectionListeners']();

      expect(service.getIsConnected()).toBe(true);
    });

    it('should set isConnected to false on disconnect event', () => {
      service['isConnected'].set(true);

      const mockSocket = {
        connected: false,
        on: (event: string, callback: Function) => {
          if (event === 'disconnect') {
            callback('io server disconnect');
          }
        },
        off: (event: string, callback?: Function) => {},
        disconnect: () => {},
      };
      service['socket'] = mockSocket as any;

      service['setupConnectionListeners']();

      expect(service.getIsConnected()).toBe(false);
    });

    it('should set connection error on connect_error event', () => {
      const mockSocket = {
        connected: false,
        on: (event: string, callback: Function) => {
          if (event === 'connect_error') {
            callback(new Error('Connection failed'));
          }
        },
        off: (event: string, callback?: Function) => {},
        disconnect: () => {},
      };
      service['socket'] = mockSocket as any;

      service['setupConnectionListeners']();

      expect(service.getConnectionError()).toBe('Connection failed');
    });
  });

  describe('signals', () => {
    it('should update isConnected signal', () => {
      expect(service['isConnected']()).toBe(false);

      service['isConnected'].set(true);
      expect(service['isConnected']()).toBe(true);

      service['isConnected'].set(false);
      expect(service['isConnected']()).toBe(false);
    });

    it('should update connectionError signal', () => {
      expect(service['connectionError']()).toBeNull();

      service['connectionError'].set('Test error');
      expect(service['connectionError']()).toBe('Test error');

      service['connectionError'].set(null);
      expect(service['connectionError']()).toBeNull();
    });
  });
});
