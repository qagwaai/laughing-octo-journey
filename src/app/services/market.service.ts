import { Injectable, inject } from '@angular/core';
import {
  MARKET_LIST_BY_LOCATION_REQUEST_EVENT,
  MARKET_LIST_BY_LOCATION_RESPONSE_EVENT,
  type MarketListByLocationRequest,
  type MarketListByLocationResponse,
} from '../model/market-list';
import { SocketService } from './socket.service';

@Injectable({ providedIn: 'root' })
export class MarketService {
  private socketService = inject(SocketService);

  listMarketsByLocation(
    request: MarketListByLocationRequest,
    onResponse: (response: MarketListByLocationResponse) => void,
  ): void {
    const unsubscribe = this.socketService.on(MARKET_LIST_BY_LOCATION_RESPONSE_EVENT, (response: MarketListByLocationResponse) => {
      unsubscribe();
      onResponse(response);
    });
    this.socketService.emit(MARKET_LIST_BY_LOCATION_REQUEST_EVENT, request);
  }
}
