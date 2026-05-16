import { Injectable, inject } from '@angular/core';
import { SocketService } from './socket.service';

@Injectable({ providedIn: 'root' })
export class SocketLifecycleService {
  private socketService = inject(SocketService);

  ensureConnected(): void {
    this.socketService.connect(this.socketService.serverUrl);
  }

  runWhenConnected(action: () => void): void {
    this.ensureConnected();

    if (this.socketService.getIsConnected()) {
      action();
      return;
    }

    this.socketService.once('connect', action);
  }
}
