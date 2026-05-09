import { Injectable, inject } from '@angular/core';
import {
  SHIP_LIST_REQUEST_EVENT,
  SHIP_LIST_RESPONSE_EVENT,
  type ShipListRequest,
  type ShipListResponse,
} from '../model/ship-list';
import { SocketService } from './socket.service';

@Injectable({ providedIn: 'root' })
export class ShipService {
  private socketService = inject(SocketService);

  listShips(request: ShipListRequest, onResponse: (response: ShipListResponse) => void): void {
    let handled = false;
    let unsubscribe = () => {};
    const handleResponse = (response: ShipListResponse) => {
      if (handled) {
        return;
      }
      handled = true;
      unsubscribe();
      onResponse(response);
    };

    unsubscribe = this.socketService.on(SHIP_LIST_RESPONSE_EVENT, (response: ShipListResponse) => {
      handleResponse(response);
    });
    this.socketService.once(SHIP_LIST_RESPONSE_EVENT, (response: ShipListResponse) => {
      handleResponse(response);
    });

    this.socketService.emit(SHIP_LIST_REQUEST_EVENT, request);
  }
}
