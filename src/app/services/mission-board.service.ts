import { Injectable, inject } from '@angular/core';
import {
  MISSION_LIST_REQUEST_EVENT,
  MISSION_LIST_RESPONSE_EVENT,
  type MissionListRequest,
  type MissionListResponse,
} from '../model/mission-list';
import { SocketService } from './socket.service';

@Injectable({ providedIn: 'root' })
/**
 * Provides mission-board list retrieval through the mission-list socket contract.
 */
export class MissionBoardService {
  private socketService = inject(SocketService);

  /**
   * Requests visible missions for the current player and returns an unsubscribe function.
   */
  listMissions(request: MissionListRequest, onResponse: (response: MissionListResponse) => void): () => void {
    const unsubscribe = this.socketService.on(MISSION_LIST_RESPONSE_EVENT, (response: MissionListResponse) => {
      onResponse(response);
    });

    this.socketService.emit(MISSION_LIST_REQUEST_EVENT, request);
    return unsubscribe;
  }
}
