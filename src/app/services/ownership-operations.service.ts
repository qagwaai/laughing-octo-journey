import { Injectable, inject } from '@angular/core';
import { appLogger } from './logger';
import {
  ITEM_LIST_BY_OWNER_REQUEST_EVENT,
  ITEM_LIST_BY_OWNER_RESPONSE_EVENT,
  MARKET_LISTING_CREATE_REQUEST_EVENT,
  MARKET_LISTING_CREATE_RESPONSE_EVENT,
  MARKET_OFFER_ACCEPT_REQUEST_EVENT,
  MARKET_OFFER_ACCEPT_RESPONSE_EVENT,
  MARKET_OFFER_CREATE_REQUEST_EVENT,
  MARKET_OFFER_CREATE_RESPONSE_EVENT,
  SHIP_LIST_BY_NPC_OWNER_REQUEST_EVENT,
  SHIP_LIST_BY_NPC_OWNER_RESPONSE_EVENT,
  SHIP_PIRACY_SEIZE_REQUEST_EVENT,
  SHIP_PIRACY_SEIZE_RESPONSE_EVENT,
  SHIP_SALVAGE_CLAIM_REQUEST_EVENT,
  SHIP_SALVAGE_CLAIM_RESPONSE_EVENT,
  type ItemListByOwnerRequest,
  type ItemListByOwnerResponse,
  type MarketListingCreateRequest,
  type MarketListingCreateResponse,
  type MarketOfferAcceptRequest,
  type MarketOfferAcceptResponse,
  type MarketOfferCreateRequest,
  type MarketOfferCreateResponse,
  type OwnershipRequestIdentity,
  type ShipListByNpcOwnerRequest,
  type ShipListByNpcOwnerResponse,
  type ShipPiracySeizeRequest,
  type ShipPiracySeizeResponse,
  type ShipSalvageClaimRequest,
  type ShipSalvageClaimResponse,
} from '../model/ownership-operations';
import { createCorrelationId, matchesBasicRequestIdentity, normalizeIdentityValue } from './socket-correlation';
import { SocketService } from './socket.service';

type CorrelatedRequest = {
  correlationId?: string;
  correlationSource?: string;
  requestIdentity?: OwnershipRequestIdentity;
};

type CorrelatedResponse = {
  correlationId?: string;
  requestIdentity?: OwnershipRequestIdentity;
};

function isCorrelatedMatch(
  response: CorrelatedResponse,
  expectedCorrelationId: string,
  expectedRequestIdentity: OwnershipRequestIdentity,
): boolean {
  const responseCorrelationId = response.correlationId?.trim() ?? '';
  if (responseCorrelationId) {
    if (responseCorrelationId !== expectedCorrelationId) {
      return false;
    }

    if (response.requestIdentity) {
      return matchesBasicRequestIdentity(response.requestIdentity, expectedRequestIdentity);
    }
  }

  return true;
}

@Injectable({ providedIn: 'root' })
/**
 * Correlated wrappers for ownership/NPC contract operations introduced by the ownership API rollout.
 */
export class OwnershipOperationsService {
  private socketService = inject(SocketService);

  listShipsByNpcOwner(request: ShipListByNpcOwnerRequest, onResponse: (response: ShipListByNpcOwnerResponse) => void): void {
    this.emitWithCorrelation(
      request,
      SHIP_LIST_BY_NPC_OWNER_REQUEST_EVENT,
      SHIP_LIST_BY_NPC_OWNER_RESPONSE_EVENT,
      this.buildDefaultIdentity('ship-list-by-npc-owner', 'ship', `npc-pirate:${request.npcOwner.npcId?.trim() || 'unknown-npc'}`),
      'ownership-operations.listShipsByNpcOwner',
      onResponse,
    );
  }

  listItemsByOwner(request: ItemListByOwnerRequest, onResponse: (response: ItemListByOwnerResponse) => void): void {
    this.emitWithCorrelation(
      request,
      ITEM_LIST_BY_OWNER_REQUEST_EVENT,
      ITEM_LIST_BY_OWNER_RESPONSE_EVENT,
      this.buildDefaultIdentity(
        'item-list-by-owner',
        'item',
        this.buildOwnerContainerId(request.owner.ownerType, request.owner.characterId, request.owner.npcId),
      ),
      'ownership-operations.listItemsByOwner',
      onResponse,
    );
  }

  claimSalvage(request: ShipSalvageClaimRequest, onResponse: (response: ShipSalvageClaimResponse) => void): void {
    this.emitWithCorrelation(
      request,
      SHIP_SALVAGE_CLAIM_REQUEST_EVENT,
      SHIP_SALVAGE_CLAIM_RESPONSE_EVENT,
      this.buildDefaultIdentity('ship-salvage-claim', 'ship', request.shipId?.trim() || 'unknown-ship'),
      'ownership-operations.claimSalvage',
      onResponse,
    );
  }

  seizeShipByPiracy(request: ShipPiracySeizeRequest, onResponse: (response: ShipPiracySeizeResponse) => void): void {
    this.emitWithCorrelation(
      request,
      SHIP_PIRACY_SEIZE_REQUEST_EVENT,
      SHIP_PIRACY_SEIZE_RESPONSE_EVENT,
      this.buildDefaultIdentity('ship-piracy-seize', 'ship', request.shipId?.trim() || 'unknown-ship'),
      'ownership-operations.seizeShipByPiracy',
      onResponse,
    );
  }

  createMarketListing(
    request: MarketListingCreateRequest,
    onResponse: (response: MarketListingCreateResponse) => void,
  ): void {
    this.emitWithCorrelation(
      request,
      MARKET_LISTING_CREATE_REQUEST_EVENT,
      MARKET_LISTING_CREATE_RESPONSE_EVENT,
      this.buildDefaultIdentity('market-listing-create', 'market-listing', request.marketId?.trim() || 'unknown-market'),
      'ownership-operations.createMarketListing',
      onResponse,
    );
  }

  createMarketOffer(request: MarketOfferCreateRequest, onResponse: (response: MarketOfferCreateResponse) => void): void {
    this.emitWithCorrelation(
      request,
      MARKET_OFFER_CREATE_REQUEST_EVENT,
      MARKET_OFFER_CREATE_RESPONSE_EVENT,
      this.buildDefaultIdentity('market-offer-create', 'market-offer', request.listingId?.trim() || 'unknown-listing'),
      'ownership-operations.createMarketOffer',
      onResponse,
    );
  }

  acceptMarketOffer(request: MarketOfferAcceptRequest, onResponse: (response: MarketOfferAcceptResponse) => void): void {
    this.emitWithCorrelation(
      request,
      MARKET_OFFER_ACCEPT_REQUEST_EVENT,
      MARKET_OFFER_ACCEPT_RESPONSE_EVENT,
      this.buildDefaultIdentity('market-offer-accept', 'market-offer', request.listingId?.trim() || 'unknown-listing'),
      'ownership-operations.acceptMarketOffer',
      onResponse,
    );
  }

  private emitWithCorrelation<TRequest extends CorrelatedRequest, TResponse extends CorrelatedResponse>(
    request: TRequest,
    requestEvent: string,
    responseEvent: string,
    defaultIdentity: OwnershipRequestIdentity,
    correlationSource: string,
    onResponse: (response: TResponse) => void,
  ): void {
    const expectedCorrelationId = request.correlationId?.trim() || createCorrelationId(defaultIdentity.operation);
    const expectedRequestIdentity = request.requestIdentity ?? defaultIdentity;
    const requestWithCorrelation: TRequest = {
      ...request,
      correlationId: expectedCorrelationId,
      correlationSource: request.correlationSource ?? correlationSource,
      requestIdentity: expectedRequestIdentity,
    };

    const unsubscribe = this.socketService.on(responseEvent, (response: TResponse) => {
      if (!isCorrelatedMatch(response, expectedCorrelationId, expectedRequestIdentity)) {
        const responseCorrelationId = response.correlationId?.trim() ?? '';
        if (responseCorrelationId && responseCorrelationId !== expectedCorrelationId) {
          return;
        }

        appLogger.warn(
          `[socket-correlation] Dropping unmatched ${defaultIdentity.operation} response. responseCorrelationId=${response.correlationId ?? 'missing'} expectedCorrelationId=${expectedCorrelationId} responseOperation=${response.requestIdentity?.operation ?? 'missing'} expectedOperation=${expectedRequestIdentity.operation}`,
        );
        return;
      }

      unsubscribe();
      onResponse(response);
    });

    this.socketService.emit(requestEvent, requestWithCorrelation);
  }

  private buildDefaultIdentity(operation: string, entityType: string, containerId: string): OwnershipRequestIdentity {
    return {
      operation,
      entityType,
      containerId,
    };
  }

  private buildOwnerContainerId(ownerType: string, characterId?: string | null, npcId?: string | null): string {
    const normalizedOwnerType = normalizeIdentityValue(ownerType) || 'unknown';
    switch (normalizedOwnerType) {
      case 'player-character':
        return `player-character:${normalizeIdentityValue(characterId) || 'unknown-character'}`;
      case 'npc-pirate':
        return `npc-pirate:${normalizeIdentityValue(npcId) || 'unknown-npc'}`;
      case 'unowned':
        return 'unowned';
      case 'unknown':
        return 'unknown';
      default:
        return normalizedOwnerType;
    }
  }
}
