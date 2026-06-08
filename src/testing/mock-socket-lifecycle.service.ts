export interface ConnectCapable {
  connect(): void;
}

export interface MockSocketLifecycleService {
  ensureConnected(): void;
}

export function createMockSocketLifecycleService(socketService: ConnectCapable): MockSocketLifecycleService {
  return {
    ensureConnected(): void {
      socketService.connect();
    },
  };
}
