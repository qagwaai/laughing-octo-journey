import { Injectable, inject } from '@angular/core';
import {
  CELESTIAL_BODY_LIST_REQUEST_EVENT,
  CELESTIAL_BODY_LIST_RESPONSE_EVENT,
  type CelestialBodyListRequest,
  type CelestialBodyListResponse,
} from '../model/celestial-body-list';
import {
  ITEM_LIST_BY_LOCATION_REQUEST_EVENT,
  ITEM_LIST_BY_LOCATION_RESPONSE_EVENT,
  type ItemListByLocationRequest,
  type ItemListByLocationResponse,
} from '../model/item-list-by-location';
import { LAUNCH_ITEM_RESPONSE_EVENT, type LaunchItemRequest, type LaunchItemResponse } from '../model/launch-item';
import {
  SHIP_LIST_REQUEST_EVENT,
  SHIP_LIST_RESPONSE_EVENT,
  type ShipListRequest,
  type ShipListResponse,
} from '../model/ship-list';
import { SocketService } from './socket.service';

@Injectable({ providedIn: 'root' })
/**
 * Socket contract wrapper dedicated to ship-exterior scene request/response flows.
 */
export class ShipExteriorSocketService {
  private socketService = inject(SocketService);

  /**
   * Subscribes to launch-item responses for active launch actions.
   */
  subscribeLaunchResponses(onResponse: (response: LaunchItemResponse) => void): () => void {
    return this.socketService.on(LAUNCH_ITEM_RESPONSE_EVENT, (response: LaunchItemResponse) => {
      onResponse(response);
    });
  }

  /**
   * Requests ship list and resolves once with the first matching response.
   */
  listShips(request: ShipListRequest, onResponse: (response: ShipListResponse) => void): () => void {
    const unsubscribe = this.socketService.on(SHIP_LIST_RESPONSE_EVENT, (response: ShipListResponse) => {
      unsubscribe();
      onResponse(response);
    });

    this.socketService.emit(SHIP_LIST_REQUEST_EVENT, request);
    return unsubscribe;
  }

  /**
   * Requests celestial bodies and resolves once with the first matching response.
   */
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

  /**
   * Requests deployed items around the provided ship position and resolves once.
   */
  listNearbyDeployedItems(
    request: ItemListByLocationRequest,
    onResponse: (response: ItemListByLocationResponse) => void,
  ): () => void {
    const unsubscribe = this.socketService.on(
      ITEM_LIST_BY_LOCATION_RESPONSE_EVENT,
      (response: ItemListByLocationResponse) => {
        unsubscribe();
        onResponse(response);
      },
    );

    this.socketService.emit(ITEM_LIST_BY_LOCATION_REQUEST_EVENT, request);
    return unsubscribe;
  }

  /**
   * Emits launch-item request using the shared socket helper.
   */
  launchItem(request: LaunchItemRequest): void {
    this.socketService.launchItem(request);
  }
}
