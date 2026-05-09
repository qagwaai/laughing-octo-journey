import { Injectable, inject } from '@angular/core';
import { SocketService } from './socket.service';

@Injectable({ providedIn: 'root' })
/**
 * Thin socket adapter for the scene-graph playground message channel.
 */
export class SceneGraphSocketService {
  private socketService = inject(SocketService);

  /**
   * Connects to the socket server and subscribes to generic scene messages.
   */
  connectAndSubscribeMessages(onMessage: (data: unknown) => void): () => void {
    this.socketService.connect('http://localhost:3000');
    return this.socketService.on('message', onMessage);
  }

  /**
   * Sends a text payload on the shared scene message event.
   */
  sendMessage(text: string): void {
    this.socketService.emit('message', { text });
  }

  /**
   * Disconnects the underlying socket client.
   */
  disconnect(): void {
    this.socketService.disconnect();
  }
}
