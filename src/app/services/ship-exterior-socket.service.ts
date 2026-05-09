import { Injectable, inject } from '@angular/core';
import {
  CELESTIAL_BODY_LIST_REQUEST_EVENT,
  CELESTIAL_BODY_LIST_RESPONSE_EVENT,
  type CelestialBodyListRequest,
  type CelestialBodyListResponse,
} from '../model/celestial-body-list';
import { LAUNCH_ITEM_RESPONSE_EVENT, type LaunchItemRequest, type LaunchItemResponse } from '../model/launch-item';
import {
  SHIP_LIST_REQUEST_EVENT,
  SHIP_LIST_RESPONSE_EVENT,
  type ShipListRequest,
  type ShipListResponse,
} from '../model/ship-list';
import { SocketService } from './socket.service';

@Injectable({ providedIn: 'root' })
export class ShipExteriorSocketService {
  private socketService = inject(SocketService);

  subscribeLaunchResponses(onResponse: (response: LaunchItemResponse) => void): () => void {
    return this.socketService.on(LAUNCH_ITEM_RESPONSE_EVENT, (response: LaunchItemResponse) => {
      onResponse(response);
    });
  }

  listShips(request: ShipListRequest, onResponse: (response: ShipListResponse) => void): () => void {
    const unsubscribe = this.socketService.on(SHIP_LIST_RESPONSE_EVENT, (response: ShipListResponse) => {
      unsubscribe();
      onResponse(response);
    });

    this.socketService.emit(SHIP_LIST_REQUEST_EVENT, request);
    return unsubscribe;
  }

  listCelestialBodies(
    request: CelestialBodyListRequest,
    onResponse: (response: CelestialBodyListResponse) => void,
  ): () => void {
    const unsubscribe = this.socketService.on(
      CELESTIAL_BODY_LIST_RESPONSE_EVENT,
      (response: CelestialBodyListResponse) => {
        unsubscribe();
        onResponse(response);
      },
    );

    this.socketService.emit(CELESTIAL_BODY_LIST_REQUEST_EVENT, request);
    return unsubscribe;
  }

  launchItem(request: LaunchItemRequest): void {
    this.socketService.launchItem(request);
  }
}
