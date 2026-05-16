import { TestBed } from '@angular/core/testing';
import { SocketLifecycleService } from './socket-lifecycle.service';
import { SocketService } from './socket.service';

class SocketServiceStub {
  serverUrl = 'http://example.test';
  connect = jasmine.createSpy('connect');
  getIsConnected = jasmine.createSpy('getIsConnected').and.returnValue(false);
  once = jasmine.createSpy('once');
}

describe('SocketLifecycleService', () => {
  let service: SocketLifecycleService;
  let socketService: SocketServiceStub;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SocketLifecycleService, { provide: SocketService, useClass: SocketServiceStub }],
    });

    service = TestBed.inject(SocketLifecycleService);
    socketService = TestBed.inject(SocketService) as unknown as SocketServiceStub;
  });

  it('ensureConnected should connect using the socket server url', () => {
    service.ensureConnected();

    expect(socketService.connect).toHaveBeenCalledWith(socketService.serverUrl);
  });

  it('runWhenConnected should execute action immediately when already connected', () => {
    socketService.getIsConnected.and.returnValue(true);
    const action = jasmine.createSpy('action');

    service.runWhenConnected(action);

    expect(socketService.connect).toHaveBeenCalledWith(socketService.serverUrl);
    expect(action).toHaveBeenCalledTimes(1);
    expect(socketService.once).not.toHaveBeenCalled();
  });

  it('runWhenConnected should wait for connect event when not connected', () => {
    socketService.getIsConnected.and.returnValue(false);
    const action = jasmine.createSpy('action');

    service.runWhenConnected(action);

    expect(socketService.connect).toHaveBeenCalledWith(socketService.serverUrl);
    expect(action).not.toHaveBeenCalled();
    expect(socketService.once).toHaveBeenCalledWith('connect', action);
  });
});