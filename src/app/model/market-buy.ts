export const MARKET_BUY_REQUEST_EVENT = 'market-buy-request';
export const MARKET_BUY_RESPONSE_EVENT = 'market-buy-response';

export interface MarketBuyRequestIdentity {
  operation: string;
  entityType: string;
  containerId: string;
}

export interface MarketBuyRequest {
  playerName: string;
  sessionKey: string;
  marketId: string;
  solarSystemId: string;
  characterId: string;
  itemId: string;
  quantity: number;
  requestId?: string;
  transactionId?: string;
  correlationId?: string;
  correlationSource?: string;
  requestIdentity?: MarketBuyRequestIdentity;
}

export interface MarketBuyPurchasedShipOwnership {
  ownerType: 'player-character';
  playerId: string | null;
  characterId: string | null;
  npcId: string | null;
  factionId: string | null;
}

export interface MarketBuyPurchasedShip {
  id: string;
  shipName: string;
  model: string;
  tier: number;
  inventory: Array<{ itemId: string; itemType: string }>;
  ownership: MarketBuyPurchasedShipOwnership;
}

export interface MarketBuyTransaction {
  transactionId: string;
  requestId: string | null;
  marketId: string;
  solarSystemId: string;
  characterId: string;
  itemId: string;
  direction: 'buy';
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  timestamp: string;
  characterCredits: number | null;
  marketStock: number | null;
  purchasedShip?: MarketBuyPurchasedShip;
}

export interface MarketBuyResponse {
  success: boolean;
  message: string;
  correlationId: string;
  requestIdentity: MarketBuyRequestIdentity;
  requestId?: string | null;
  reason?: string;
  transaction?: MarketBuyTransaction;
}