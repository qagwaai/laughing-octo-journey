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
    it('should emit celestial body upsert request and register one-time response listener', () => {
      let emittedEvent: string | null = null;
      let emittedPayload: unknown;
      let onceEvent: string | null = null;
      let responseCallback: ((data: unknown) => void) | undefined;

      const mockSocket = {
        connected: true,
        emit: (event: string, data?: unknown) => {
          emittedEvent = event;
          emittedPayload = data;
        },
        once: (event: string, callback: (data: unknown) => void) => {
          onceEvent = event;
          responseCallback = callback;
        },
        on: (event: string, callback: Function) => {},
        off: (event: string, callback?: Function) => {},
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

      expect(onceEvent).not.toBeNull();
      expect(onceEvent!).toBe(CELESTIAL_BODY_UPSERT_RESPONSE_EVENT);
      expect(emittedEvent).not.toBeNull();
      expect(emittedEvent!).toBe(CELESTIAL_BODY_UPSERT_REQUEST_EVENT);
      expect(emittedPayload).toEqual(request);

      const fakeResponse = { success: true, message: 'ok', celestialBody: request.celestialBody };
      responseCallback?.(fakeResponse);
      expect(callbackResponse).toEqual(fakeResponse);
    });
  });

  describe('upsertShip', () => {
    it('should emit ship upsert request and register one-time response listener', () => {
      let emittedEvent: string | null = null;
      let emittedPayload: unknown;
      let onceEvent: string | null = null;
      let responseCallback: ((data: unknown) => void) | undefined;

      const mockSocket = {
        connected: true,
        emit: (event: string, data?: unknown) => {
          emittedEvent = event;
          emittedPayload = data;
        },
        once: (event: string, callback: (data: unknown) => void) => {
          onceEvent = event;
          responseCallback = callback;
        },
        on: (event: string, callback: Function) => {},
        off: (event: string, callback?: Function) => {},
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

      expect(onceEvent).not.toBeNull();
      expect(onceEvent!).toBe(SHIP_UPSERT_RESPONSE_EVENT);
      expect(emittedEvent).not.toBeNull();
      expect(emittedEvent!).toBe(SHIP_UPSERT_REQUEST_EVENT);
      expect(emittedPayload).toEqual(
        jasmine.objectContaining({
          ...request,
          correlationId: jasmine.any(String),
          correlationSource: 'socket.upsertShip',
        }),
      );

      const fakeResponse = {
        success: true,
        message: 'ok',
        playerName: 'Pioneer',
        characterId: 'char-1',
        ship: { ...request.ship, shipName: 'Starter Ship' },
      };
      responseCallback?.(fakeResponse);
      expect(callbackResponse).toEqual(fakeResponse);
    });
  });

  describe('upsertItem', () => {
    afterEach(() => {
      jasmine.clock().uninstall();
    });

    it('should register once listeners for both item-upsert responses and emit canonical request only when response arrives', () => {
      jasmine.clock().install();

      const emittedEvents: Array<{ event: string; payload: unknown }> = [];
      const onceEvents: Array<{ event: string; callback: (data: unknown) => void }> = [];

      const mockSocket = {
        connected: true,
        emit: (event: string, data?: unknown) => {
          emittedEvents.push({ event, payload: data });
        },
        once: (event: string, callback: (data: unknown) => void) => {
          onceEvents.push({ event, callback });
        },
        on: (event: string, callback: Function) => {},
        off: (event: string, callback?: Function) => {},
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

      const onceEventNames = onceEvents.map((entry) => entry.event);
      const emittedEventNames = emittedEvents.map((entry) => entry.event);

      expect(onceEventNames).toContain(ITEM_UPSERT_RESPONSE_EVENT);
      expect(onceEventNames).toContain('upsert-item-response');
      expect(emittedEventNames).toEqual([ITEM_UPSERT_REQUEST_EVENT]);
      expect(emittedEvents.find((entry) => entry.event === ITEM_UPSERT_REQUEST_EVENT)?.payload).toEqual(
        jasmine.objectContaining({
          ...request,
          correlationId: jasmine.any(String),
          correlationSource: 'socket.upsertItem',
        }),
      );

      const fakeResponse = {
        success: true,
        message: 'Item created.',
        playerName: 'Pioneer',
        item: { ...request.item, id: 'item-1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
      };

      const canonicalCallback = onceEvents.find((entry) => entry.event === ITEM_UPSERT_RESPONSE_EVENT)?.callback;
      const aliasCallback = onceEvents.find((entry) => entry.event === 'upsert-item-response')?.callback;
      canonicalCallback?.(fakeResponse);
      jasmine.clock().tick(1000);
      aliasCallback?.({ success: true, message: 'duplicate', playerName: 'Pioneer' });

      expect(callbackResponse).toEqual(fakeResponse);
      expect(emittedEvents.map((entry) => entry.event)).toEqual([ITEM_UPSERT_REQUEST_EVENT]);
    });

    it('should emit alias request as fallback when canonical response does not arrive in time', () => {
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
      expect(emittedEvents.map((entry) => entry.event)).toEqual([
        ITEM_UPSERT_REQUEST_EVENT,
        'upsert-item-request',
      ]);
    });

    it('should use canonical-first then fallback for existing item updates when no response arrives', () => {
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
      expect(emittedEvents.map((entry) => entry.event)).toEqual([
        ITEM_UPSERT_REQUEST_EVENT,
        'upsert-item-request',
      ]);
    });
  });

  describe('launchItem', () => {
    it('should register a once listener for launch-item-response and emit launch-item-request', () => {
      let emittedEvent: string | null = null;
      let emittedPayload: unknown;
      let onceEvent: string | null = null;
      let responseCallback: ((data: unknown) => void) | undefined;

      const mockSocket = {
        connected: true,
        emit: (event: string, data?: unknown) => {
          emittedEvent = event;
          emittedPayload = data;
        },
        once: (event: string, callback: (data: unknown) => void) => {
          onceEvent = event;
          responseCallback = callback;
        },
        on: (event: string, callback: Function) => {},
        off: (event: string, callback?: Function) => {},
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

      expect(onceEvent).not.toBeNull();
      expect(onceEvent!).toBe(LAUNCH_ITEM_RESPONSE_EVENT);
      expect(emittedEvent).not.toBeNull();
      expect(emittedEvent!).toBe(LAUNCH_ITEM_REQUEST_EVENT);
      expect(emittedPayload).toEqual(request);

      const fakeResponse = {
        success: true,
        message: 'Launch queued.',
        ...request,
      };
      responseCallback?.(fakeResponse);
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
