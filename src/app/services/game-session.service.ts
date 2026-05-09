import { Injectable, inject } from '@angular/core';
import { GAME_JOIN_REQUEST_EVENT, type GameJoinRequest } from '../model/game-join';
import { INVALID_SESSION_EVENT } from '../model/session';
import { SocketService } from './socket.service';

@Injectable({ providedIn: 'root' })
export class GameSessionService {
	private socketService = inject(SocketService);

	subscribeInvalidSession(onInvalidSession: () => void): () => void {
		return this.socketService.on(INVALID_SESSION_EVENT, () => {
			onInvalidSession();
		});
	}

	requestGameJoin(request: GameJoinRequest): void {
		this.socketService.emit(GAME_JOIN_REQUEST_EVENT, request);
	}
}
