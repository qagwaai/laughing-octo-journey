import type { ShipSummary } from './ship-list';
import type { ShipOwnerDescriptor, ShipOwnership, ShipOwnerType } from './ship-owner';

export const SHIP_LIST_BY_NPC_OWNER_REQUEST_EVENT = 'ship-list-by-npc-owner-request';
export const SHIP_LIST_BY_NPC_OWNER_RESPONSE_EVENT = 'ship-list-by-npc-owner-response';
export const ITEM_LIST_BY_OWNER_REQUEST_EVENT = 'item-list-by-owner-request';
export const ITEM_LIST_BY_OWNER_RESPONSE_EVENT = 'item-list-by-owner-response';
export const SHIP_SALVAGE_CLAIM_REQUEST_EVENT = 'ship-salvage-claim-request';
export const SHIP_SALVAGE_CLAIM_RESPONSE_EVENT = 'ship-salvage-claim-response';
export const SHIP_PIRACY_SEIZE_REQUEST_EVENT = 'ship-piracy-seize-request';
export const SHIP_PIRACY_SEIZE_RESPONSE_EVENT = 'ship-piracy-seize-response';
export const MARKET_LISTING_CREATE_REQUEST_EVENT = 'market-listing-create-request';
export const MARKET_LISTING_CREATE_RESPONSE_EVENT = 'market-listing-create-response';
export const MARKET_OFFER_CREATE_REQUEST_EVENT = 'market-offer-create-request';
export const MARKET_OFFER_CREATE_RESPONSE_EVENT = 'market-offer-create-response';
export const MARKET_OFFER_ACCEPT_REQUEST_EVENT = 'market-offer-accept-request';
export const MARKET_OFFER_ACCEPT_RESPONSE_EVENT = 'market-offer-accept-response';

export interface OwnershipRequestIdentity {
  operation: string;
  entityType: string;
  containerId: string;
}

export interface OwnershipEnvelope {
  ownerType: ShipOwnerDescriptor['ownerType'];
  playerId?: string | null;
  characterId?: string | null;
  npcId?: string | null;
  factionId?: string | null;
}

export interface OwnershipItemRecord {
  id?: string;
  itemId?: string;
  itemType?: string;
  displayName?: string;
  ownership?: ShipOwnership | null;
  [key: string]: unknown;
}

export interface ShipListByNpcOwnerRequest {
  playerName: string;
  sessionKey: string;
  correlationId?: string;
  correlationSource?: string;
  requestIdentity?: OwnershipRequestIdentity;
  npcOwner: {
    ownerType: 'npc-pirate';
    npcId: string;
  };
}

export interface ShipListByNpcOwnerResponse {
  success: boolean;
  message: string;
  reason?: string;
  correlationId: string;
  requestIdentity: OwnershipRequestIdentity;
  owner?: ShipOwnership | null;
  ships: ShipSummary[];
}

export interface ItemListByOwnerRequest {
  playerName: string;
  sessionKey: string;
  correlationId?: string;
  correlationSource?: string;
  requestIdentity?: OwnershipRequestIdentity;
  owner: OwnershipEnvelope;
}

export interface ItemListByOwnerResponse {
  success: boolean;
  message: string;
  reason?: string;
  correlationId: string;
  requestIdentity: OwnershipRequestIdentity;
  owner?: ShipOwnership | null;
  items: OwnershipItemRecord[];
}

export interface ShipSalvageClaimRequest {
  playerName: string;
  sessionKey: string;
  correlationId?: string;
  correlationSource?: string;
  requestIdentity?: OwnershipRequestIdentity;
  shipId: string;
  claimantOwner: OwnershipEnvelope;
}

export interface ShipSalvageClaimResponse {
  success: boolean;
  message: string;
  reason?: string;
  correlationId: string;
  requestIdentity: OwnershipRequestIdentity;
  shipId?: string;
  previousOwnerType?: ShipOwnerType | null;
  claimedAt?: string;
  owner?: ShipOwnership | null;
}

export interface ShipPiracySeizeRequest {
  playerName: string;
  sessionKey: string;
  correlationId?: string;
  correlationSource?: string;
  requestIdentity?: OwnershipRequestIdentity;
  shipId: string;
  seizingOwner: OwnershipEnvelope;
}

export interface ShipPiracySeizeResponse {
  success: boolean;
  message: string;
  reason?: string;
  correlationId: string;
  requestIdentity: OwnershipRequestIdentity;
  shipId?: string;
  seizingOwner?: ShipOwnership | null;
  previousOwner?: ShipOwnership | null;
  seizedAt?: string;
}

export interface MarketListingCreateRequest {
  playerName: string;
  sessionKey: string;
  correlationId?: string;
  correlationSource?: string;
  requestIdentity?: OwnershipRequestIdentity;
  marketId: string;
  solarSystemId: string;
  itemId: string;
  quantity: number;
  listingPrice: number;
  owner: OwnershipEnvelope;
}

export interface MarketListingCreateResponse {
  success: boolean;
  message: string;
  reason?: string;
  correlationId: string;
  requestIdentity: OwnershipRequestIdentity;
  listingId?: string;
}

export interface MarketOfferCreateRequest {
  playerName: string;
  sessionKey: string;
  correlationId?: string;
  correlationSource?: string;
  requestIdentity?: OwnershipRequestIdentity;
  listingId: string;
  offerorOwner: OwnershipEnvelope;
  offerPrice: number;
  quantity: number;
}

export interface MarketOfferCreateResponse {
  success: boolean;
  message: string;
  reason?: string;
  correlationId: string;
  requestIdentity: OwnershipRequestIdentity;
  offerId?: string;
}

export interface MarketOfferAcceptRequest {
  playerName: string;
  sessionKey: string;
  correlationId?: string;
  correlationSource?: string;
  requestIdentity?: OwnershipRequestIdentity;
  offerId: string;
  listingId: string;
  listingOwner: OwnershipEnvelope;
  offerorOwner?: OwnershipEnvelope;
}

export interface MarketOfferAcceptResponse {
  success: boolean;
  message: string;
  reason?: string;
  correlationId: string;
  requestIdentity: OwnershipRequestIdentity;
  tradeId?: string;
  tradeHistory?: Record<string, unknown>;
}
