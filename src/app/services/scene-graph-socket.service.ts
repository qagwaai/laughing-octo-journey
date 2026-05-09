import { Injectable, inject } from '@angular/core';
import { SocketService } from './socket.service';

@Injectable({ providedIn: 'root' })
export class SceneGraphSocketService {
	private socketService = inject(SocketService);

	connectAndSubscribeMessages(onMessage: (data: unknown) => void): () => void {
		this.socketService.connect('http://localhost:3000');
		return this.socketService.on('message', onMessage);
	}

	sendMessage(text: string): void {
		this.socketService.emit('message', { text });
	}

	disconnect(): void {
		this.socketService.disconnect();
	}
}
