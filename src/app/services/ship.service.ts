import { Injectable, inject } from '@angular/core';
import {
  SHIP_LIST_BY_OWNER_REQUEST_EVENT,
  SHIP_LIST_BY_OWNER_RESPONSE_EVENT,
  type ShipListByOwnerRequest,
  type ShipListByOwnerResponse,
} from '../model/ship-list-by-owner';
import {
  SHIP_TRANSFER_REQUEST_EVENT,
  SHIP_TRANSFER_RESPONSE_EVENT,
  type ShipTransferRequest,
  type ShipTransferResponse,
} from '../model/ship-transfer';
import { SocketService } from './socket.service';

@Injectable({ providedIn: 'root' })
/**
 * Handles ship-list socket request/response flow for pages that need active ship data.
 * Response handlers are guarded so callback logic executes at most once per request.
 */
export class ShipService {
  private socketService = inject(SocketService);

  /**
   * Requests ships by normalized ownership descriptor and resolves the first matching response once.
   */
  listShipsByOwner(request: ShipListByOwnerRequest, onResponse: (response: ShipListByOwnerResponse) => void): void {
    let handled = false;
    let unsubscribe = () => {};
    const handleResponse = (response: ShipListByOwnerResponse) => {
      if (handled) {
        return;
      }
      handled = true;
      unsubscribe();
      onResponse(response);
    };

    unsubscribe = this.socketService.on(SHIP_LIST_BY_OWNER_RESPONSE_EVENT, (response: ShipListByOwnerResponse) => {
      handleResponse(response);
    });
    this.socketService.once(SHIP_LIST_BY_OWNER_RESPONSE_EVENT, (response: ShipListByOwnerResponse) => {
      handleResponse(response);
    });

    this.socketService.emit(SHIP_LIST_BY_OWNER_REQUEST_EVENT, request);
  }

  /**
   * Requests a ship ownership transfer and resolves the first matching response once.
   */
  transferShip(request: ShipTransferRequest, onResponse: (response: ShipTransferResponse) => void): void {
    let handled = false;
    let unsubscribe = () => {};
    const handleResponse = (response: ShipTransferResponse) => {
      if (handled) {
        return;
      }
      handled = true;
      unsubscribe();
      onResponse(response);
    };

    unsubscribe = this.socketService.on(SHIP_TRANSFER_RESPONSE_EVENT, (response: ShipTransferResponse) => {
      handleResponse(response);
    });
    this.socketService.once(SHIP_TRANSFER_RESPONSE_EVENT, (response: ShipTransferResponse) => {
      handleResponse(response);
    });

    this.socketService.emit(SHIP_TRANSFER_REQUEST_EVENT, request);
  }
}
