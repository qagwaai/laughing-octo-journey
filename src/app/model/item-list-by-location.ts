import type { ShipItem } from './ship-item';

export const ITEM_LIST_BY_LOCATION_REQUEST_EVENT = 'item-list-by-location';
export const ITEM_LIST_BY_LOCATION_RESPONSE_EVENT = 'item-list-by-location-response';

export interface ItemListByLocationRequest {
  sessionKey: string;
  playerName: string;
  shipId: string;
  location: {
    solarSystemId: string;
    positionKm: {
      x: number;
      y: number;
      z: number;
    };
  };
  maxDistanceKm?: number;
  limit?: number;
}

export interface ItemListByLocationResponse {
  success: boolean;
  message?: string;
  items?: ShipItem[];
}
