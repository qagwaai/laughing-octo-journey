import { Injectable, inject } from '@angular/core';
import {
  SOLAR_SYSTEM_GET_REQUEST_EVENT,
  SOLAR_SYSTEM_GET_RESPONSE_EVENT,
  type SolarSystemGetRequest,
  type SolarSystemGetResponse,
} from '../model/solar-system-get';
import {
  SOLAR_SYSTEM_LIST_REQUEST_EVENT,
  SOLAR_SYSTEM_LIST_RESPONSE_EVENT,
  type SolarSystemListRequest,
  type SolarSystemListResponse,
} from '../model/solar-system-list';
import { SocketService } from './socket.service';

@Injectable({ providedIn: 'root' })
/**
 * Handles solar-system list/get socket request/response flow for the Viewer page/scene.
 *
 * Response handlers are guarded so each `listSolarSystems`/`getSolarSystem` call
 * resolves its callback at most once even if multiple matching responses arrive
 * (e.g. background `on` listener races with `once`).
 */
export class SolarSystemService {
  private socketService = inject(SocketService);

  /**
   * Lists curated/procedural solar systems via `solar-system-list-request`.
   */
  listSolarSystems(request: SolarSystemListRequest, onResponse: (response: SolarSystemListResponse) => void): void {
    let handled = false;
    let unsubscribe = () => {};

    const handleResponse = (response: SolarSystemListResponse) => {
      if (handled) {
        return;
      }
      handled = true;
      unsubscribe();
      onResponse(response);
    };

    unsubscribe = this.socketService.on(SOLAR_SYSTEM_LIST_RESPONSE_EVENT, (response: SolarSystemListResponse) => {
      handleResponse(response);
    });
    this.socketService.once(SOLAR_SYSTEM_LIST_RESPONSE_EVENT, (response: SolarSystemListResponse) => {
      handleResponse(response);
    });

    this.socketService.emit(SOLAR_SYSTEM_LIST_REQUEST_EVENT, request);
  }

  /**
   * Retrieves a single solar system (with bodies) via `solar-system-get-request`.
   */
  getSolarSystem(request: SolarSystemGetRequest, onResponse: (response: SolarSystemGetResponse) => void): void {
    let handled = false;
    let unsubscribe = () => {};

    const handleResponse = (response: SolarSystemGetResponse) => {
      if (handled) {
        return;
      }
      handled = true;
      unsubscribe();
      onResponse(response);
    };

    unsubscribe = this.socketService.on(SOLAR_SYSTEM_GET_RESPONSE_EVENT, (response: SolarSystemGetResponse) => {
      handleResponse(response);
    });
    this.socketService.once(SOLAR_SYSTEM_GET_RESPONSE_EVENT, (response: SolarSystemGetResponse) => {
      handleResponse(response);
    });

    this.socketService.emit(SOLAR_SYSTEM_GET_REQUEST_EVENT, request);
  }
}
