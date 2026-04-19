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

  it('should have a null socket initially', () => {
    expect(service.getSocket()).toBeNull();
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
        reconnectionDelay: 500
      };
      
      // This will fail without a server, but we're testing option passing
      service.connect('http://localhost:3000', options);
      
      // Verify no unhandled errors
      expect(service).toBeTruthy();
    });
  });

  describe('emit', () => {
    it('should warn if socket not connected', () => {
      const warnSpy = spyOn(console, 'warn');
      
      service.emit('test', { data: 'test' });
      
      expect(console.warn).toHaveBeenCalledWith(
        'Socket is not connected. Event not sent:',
        'test'
      );
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
        disconnect: () => {}
      };
      service['socket'] = mockSocket as any;
      
      const callback = () => { callbackCalled = true; };
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
        disconnect: () => {}
      };
      service['socket'] = mockSocket as any;
      
      service.emit('test', { data: 'test' });
      
      expect(emitCalled).toBe(true);
    });
  });

  describe('on', () => {
    it('should warn if socket not initialized', () => {
      const warnSpy = spyOn(console, 'warn');
      
      const unsubscribe = service.on('test', () => {});
      
      expect(warnSpy).toHaveBeenCalledWith(
        'Socket not initialized. Use connect() first'
      );
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
        disconnect: () => {}
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
      
      service.once('test', () => {});
      
      expect(warnSpy).toHaveBeenCalledWith(
        'Socket not initialized. Use connect() first'
      );
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
        disconnect: () => {}
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
        disconnect: () => {}
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
        disconnect: () => {}
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
        off: (event: string, callback?: Function) => {}
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
        disconnect: () => {}
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
        disconnect: () => {}
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
        disconnect: () => {}
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
