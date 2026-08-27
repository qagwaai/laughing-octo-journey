import { TestBed } from '@angular/core/testing';
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
  type ShipListByNpcOwnerRequest,
  type ShipListByNpcOwnerResponse,
  type ShipPiracySeizeRequest,
  type ShipPiracySeizeResponse,
  type ShipSalvageClaimRequest,
  type ShipSalvageClaimResponse,
} from '../model/ownership-operations';
import { OwnershipOperationsService } from './ownership-operations.service';
import { SocketService } from './socket.service';

type Listener<T = unknown> = (payload: T) => void;

class MockSocketService {
  public readonly events = new Map<string, Set<Listener>>();
  public readonly emittedEvents: Array<{ eventName: string; payload: unknown }> = [];

  on(eventName: string, callback: Listener): () => void {
    const listeners = this.events.get(eventName) ?? new Set<Listener>();
    listeners.add(callback);
    this.events.set(eventName, listeners);

    return () => {
      const next = this.events.get(eventName);
      if (!next) {
        return;
      }
      next.delete(callback);
      if (next.size === 0) {
        this.events.delete(eventName);
      }
    };
  }

  emit(eventName: string, payload: unknown): void {
    this.emittedEvents.push({ eventName, payload });
  }

  trigger<T>(eventName: string, payload: T): void {
    const listeners = Array.from(this.events.get(eventName) ?? []);
    for (const listener of listeners) {
      listener(payload);
    }
  }

  listenerCount(eventName: string): number {
    return this.events.get(eventName)?.size ?? 0;
  }
}

describe('OwnershipOperationsService', () => {
  let socketService: MockSocketService;
  let service: OwnershipOperationsService;

  beforeEach(() => {
    socketService = new MockSocketService();
    TestBed.configureTestingModule({
      providers: [{ provide: SocketService, useValue: socketService }],
    });
    service = TestBed.inject(OwnershipOperationsService);
  });

  it('emits ship-list-by-npc-owner with correlated identity and resolves only matching responses', () => {
    const request: ShipListByNpcOwnerRequest = {
      playerName: 'Pioneer',
      sessionKey: 'session-1',
      npcOwner: {
        ownerType: 'npc-pirate',
        npcId: 'pirate-9',
      },
    };
    let received: ShipListByNpcOwnerResponse | undefined;

    service.listShipsByNpcOwner(request, (response) => {
      received = response;
    });

    expect(socketService.emittedEvents).toEqual([
      {
        eventName: SHIP_LIST_BY_NPC_OWNER_REQUEST_EVENT,
        payload: expect.objectContaining({
          ...request,
          correlationId: expect.any(String),
          correlationSource: 'ownership-operations.listShipsByNpcOwner',
          requestIdentity: {
            operation: 'ship-list-by-npc-owner',
            entityType: 'ship',
            containerId: 'npc-pirate:pirate-9',
          },
        }),
      },
    ]);

    const payload = socketService.emittedEvents[0].payload as ShipListByNpcOwnerRequest;
    const mismatch: ShipListByNpcOwnerResponse = {
      success: true,
      message: 'wrong',
      correlationId: 'wrong-correlation-id',
      requestIdentity: payload.requestIdentity!,
      ships: [],
    };
    socketService.trigger(SHIP_LIST_BY_NPC_OWNER_RESPONSE_EVENT, mismatch);
    expect(received).toBeUndefined();
    expect(socketService.listenerCount(SHIP_LIST_BY_NPC_OWNER_RESPONSE_EVENT)).toBe(1);

    const response: ShipListByNpcOwnerResponse = {
      success: true,
      message: 'ok',
      correlationId: payload.correlationId!,
      requestIdentity: payload.requestIdentity!,
      ships: [],
    };
    socketService.trigger(SHIP_LIST_BY_NPC_OWNER_RESPONSE_EVENT, response);

    expect(received).toEqual(response);
    expect(socketService.listenerCount(SHIP_LIST_BY_NPC_OWNER_RESPONSE_EVENT)).toBe(0);
  });

  it('emits item-list-by-owner with owner-scoped container id', () => {
    const request: ItemListByOwnerRequest = {
      playerName: 'Pioneer',
      sessionKey: 'session-1',
      owner: {
        ownerType: 'player-character',
        characterId: 'char-22',
      },
    };

    service.listItemsByOwner(request, () => {
      throw new Error('Expected no callback invocation');
    });

    expect(socketService.emittedEvents).toEqual([
      {
        eventName: ITEM_LIST_BY_OWNER_REQUEST_EVENT,
        payload: expect.objectContaining({
          ...request,
          correlationId: expect.any(String),
          correlationSource: 'ownership-operations.listItemsByOwner',
          requestIdentity: {
            operation: 'item-list-by-owner',
            entityType: 'item',
            containerId: 'player-character:char-22',
          },
        }),
      },
    ]);
  });

  it('emits market-offer-accept and ignores responses with mismatched request identity', () => {
    const request: MarketOfferAcceptRequest = {
      playerName: 'Pioneer',
      sessionKey: 'session-1',
      offerId: 'offer-1',
      listingId: 'listing-9',
      listingOwner: {
        ownerType: 'player-character',
        characterId: 'char-1',
      },
    };
    let received: MarketOfferAcceptResponse | undefined;

    service.acceptMarketOffer(request, (response) => {
      received = response;
    });

    expect(socketService.emittedEvents).toEqual([
      {
        eventName: MARKET_OFFER_ACCEPT_REQUEST_EVENT,
        payload: expect.objectContaining({
          ...request,
          correlationId: expect.any(String),
          correlationSource: 'ownership-operations.acceptMarketOffer',
          requestIdentity: {
            operation: 'market-offer-accept',
            entityType: 'market-offer',
            containerId: 'listing-9',
          },
        }),
      },
    ]);

    const payload = socketService.emittedEvents[0].payload as MarketOfferAcceptRequest;
    const mismatchIdentityResponse: MarketOfferAcceptResponse = {
      success: true,
      message: 'wrong identity',
      correlationId: payload.correlationId!,
      requestIdentity: {
        operation: 'market-offer-create',
        entityType: 'market-offer',
        containerId: 'listing-9',
      },
    };

    socketService.trigger(MARKET_OFFER_ACCEPT_RESPONSE_EVENT, mismatchIdentityResponse);
    expect(received).toBeUndefined();
    expect(socketService.listenerCount(MARKET_OFFER_ACCEPT_RESPONSE_EVENT)).toBe(1);

    const response: MarketOfferAcceptResponse = {
      success: true,
      message: 'ok',
      correlationId: payload.correlationId!,
      requestIdentity: payload.requestIdentity!,
      tradeId: 'trade-1',
    };
    socketService.trigger(MARKET_OFFER_ACCEPT_RESPONSE_EVENT, response);

    expect(received).toEqual(response);
    expect(socketService.listenerCount(MARKET_OFFER_ACCEPT_RESPONSE_EVENT)).toBe(0);
  });

  it('accepts response without correlation metadata as fallback for item-list-by-owner', () => {
    const request: ItemListByOwnerRequest = {
      playerName: 'Pioneer',
      sessionKey: 'session-1',
      owner: {
        ownerType: 'unowned',
      },
    };
    let received: ItemListByOwnerResponse | undefined;

    service.listItemsByOwner(request, (response) => {
      received = response;
    });

    const fallbackResponseWithoutCorrelation = {
      success: true,
      message: 'ok',
      items: [],
    };

    socketService.trigger(
      ITEM_LIST_BY_OWNER_RESPONSE_EVENT,
      fallbackResponseWithoutCorrelation as unknown as ItemListByOwnerResponse,
    );

    expect(received).toEqual(
      expect.objectContaining({
        success: true,
        message: 'ok',
      }),
    );
    expect(socketService.listenerCount(ITEM_LIST_BY_OWNER_RESPONSE_EVENT)).toBe(0);
  });

  it('emits ship-salvage-claim with ship-scoped identity', () => {
    const request: ShipSalvageClaimRequest = {
      playerName: 'Pioneer',
      sessionKey: 'session-1',
      shipId: 'ship-1',
      claimantOwner: {
        ownerType: 'player-character',
        characterId: 'char-1',
      },
    };
    let received: ShipSalvageClaimResponse | undefined;

    service.claimSalvage(request, (response) => {
      received = response;
    });

    expect(socketService.emittedEvents).toEqual([
      {
        eventName: SHIP_SALVAGE_CLAIM_REQUEST_EVENT,
        payload: expect.objectContaining({
          ...request,
          correlationId: expect.any(String),
          correlationSource: 'ownership-operations.claimSalvage',
          requestIdentity: {
            operation: 'ship-salvage-claim',
            entityType: 'ship',
            containerId: 'ship-1',
          },
        }),
      },
    ]);

    const payload = socketService.emittedEvents[0].payload as ShipSalvageClaimRequest;
    socketService.trigger(SHIP_SALVAGE_CLAIM_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      correlationId: payload.correlationId!,
      requestIdentity: payload.requestIdentity!,
      shipId: 'ship-1',
    } as ShipSalvageClaimResponse);

    expect(received).toEqual(expect.objectContaining({ success: true, shipId: 'ship-1' }));
  });

  it('emits ship-piracy-seize with ship-scoped identity', () => {
    const request: ShipPiracySeizeRequest = {
      playerName: 'Pioneer',
      sessionKey: 'session-1',
      shipId: 'ship-77',
      seizingOwner: {
        ownerType: 'npc-pirate',
        npcId: 'pirate-77',
      },
    };
    let received: ShipPiracySeizeResponse | undefined;

    service.seizeShipByPiracy(request, (response) => {
      received = response;
    });

    expect(socketService.emittedEvents).toEqual([
      {
        eventName: SHIP_PIRACY_SEIZE_REQUEST_EVENT,
        payload: expect.objectContaining({
          ...request,
          correlationId: expect.any(String),
          correlationSource: 'ownership-operations.seizeShipByPiracy',
          requestIdentity: {
            operation: 'ship-piracy-seize',
            entityType: 'ship',
            containerId: 'ship-77',
          },
        }),
      },
    ]);

    const payload = socketService.emittedEvents[0].payload as ShipPiracySeizeRequest;
    socketService.trigger(SHIP_PIRACY_SEIZE_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      correlationId: payload.correlationId!,
      requestIdentity: payload.requestIdentity!,
      shipId: 'ship-77',
    } as ShipPiracySeizeResponse);

    expect(received).toEqual(expect.objectContaining({ success: true, shipId: 'ship-77' }));
  });

  it('emits market-listing-create and market-offer-create with listing/market scoped identities', () => {
    const listingRequest: MarketListingCreateRequest = {
      playerName: 'Pioneer',
      sessionKey: 'session-1',
      marketId: 'market-sol-1',
      solarSystemId: 'sol',
      itemId: 'item-1',
      quantity: 1,
      listingPrice: 100,
      owner: { ownerType: 'player-character', characterId: 'char-1' },
    };
    const offerRequest: MarketOfferCreateRequest = {
      playerName: 'Pioneer',
      sessionKey: 'session-1',
      listingId: 'listing-1',
      offerorOwner: { ownerType: 'player-character', characterId: 'char-1' },
      offerPrice: 90,
      quantity: 1,
    };

    let listingReceived: MarketListingCreateResponse | undefined;
    let offerReceived: MarketOfferCreateResponse | undefined;

    service.createMarketListing(listingRequest, (response) => {
      listingReceived = response;
    });
    service.createMarketOffer(offerRequest, (response) => {
      offerReceived = response;
    });

    expect(socketService.emittedEvents[0]).toEqual(
      expect.objectContaining({
        eventName: MARKET_LISTING_CREATE_REQUEST_EVENT,
        payload: expect.objectContaining({
          correlationSource: 'ownership-operations.createMarketListing',
          requestIdentity: {
            operation: 'market-listing-create',
            entityType: 'market-listing',
            containerId: 'market-sol-1',
          },
        }),
      }),
    );

    expect(socketService.emittedEvents[1]).toEqual(
      expect.objectContaining({
        eventName: MARKET_OFFER_CREATE_REQUEST_EVENT,
        payload: expect.objectContaining({
          correlationSource: 'ownership-operations.createMarketOffer',
          requestIdentity: {
            operation: 'market-offer-create',
            entityType: 'market-offer',
            containerId: 'listing-1',
          },
        }),
      }),
    );

    const listingPayload = socketService.emittedEvents[0].payload as MarketListingCreateRequest;
    const offerPayload = socketService.emittedEvents[1].payload as MarketOfferCreateRequest;
    socketService.trigger(MARKET_LISTING_CREATE_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      correlationId: listingPayload.correlationId!,
      requestIdentity: listingPayload.requestIdentity!,
      listingId: 'listing-1',
    } as MarketListingCreateResponse);
    socketService.trigger(MARKET_OFFER_CREATE_RESPONSE_EVENT, {
      success: true,
      message: 'ok',
      correlationId: offerPayload.correlationId!,
      requestIdentity: offerPayload.requestIdentity!,
      offerId: 'offer-1',
    } as MarketOfferCreateResponse);

    expect(listingReceived).toEqual(expect.objectContaining({ success: true, listingId: 'listing-1' }));
    expect(offerReceived).toEqual(expect.objectContaining({ success: true, offerId: 'offer-1' }));
  });

  it('routes overlapping item-list-by-owner responses to matching in-flight requests only', () => {
    const requestA: ItemListByOwnerRequest = {
      playerName: 'Pioneer',
      sessionKey: 'session-1',
      owner: {
        ownerType: 'player-character',
        characterId: 'char-a',
      },
    };
    const requestB: ItemListByOwnerRequest = {
      playerName: 'Pioneer',
      sessionKey: 'session-1',
      owner: {
        ownerType: 'player-character',
        characterId: 'char-b',
      },
    };

    let receivedA: ItemListByOwnerResponse | undefined;
    let receivedB: ItemListByOwnerResponse | undefined;

    service.listItemsByOwner(requestA, (response) => {
      receivedA = response;
    });
    service.listItemsByOwner(requestB, (response) => {
      receivedB = response;
    });

    const payloadA = socketService.emittedEvents[0].payload as ItemListByOwnerRequest;
    const payloadB = socketService.emittedEvents[1].payload as ItemListByOwnerRequest;
    expect(payloadA.correlationId).toBeTruthy();
    expect(payloadB.correlationId).toBeTruthy();
    expect(payloadA.correlationId).not.toBe(payloadB.correlationId);

    socketService.trigger(ITEM_LIST_BY_OWNER_RESPONSE_EVENT, {
      success: true,
      message: 'for request B',
      correlationId: payloadB.correlationId!,
      requestIdentity: payloadB.requestIdentity!,
      items: [],
    } as ItemListByOwnerResponse);

    expect(receivedA).toBeUndefined();
    expect(receivedB).toEqual(expect.objectContaining({ success: true, message: 'for request B' }));
    expect(socketService.listenerCount(ITEM_LIST_BY_OWNER_RESPONSE_EVENT)).toBe(1);

    socketService.trigger(ITEM_LIST_BY_OWNER_RESPONSE_EVENT, {
      success: true,
      message: 'for request A',
      correlationId: payloadA.correlationId!,
      requestIdentity: payloadA.requestIdentity!,
      items: [],
    } as ItemListByOwnerResponse);

    expect(receivedA).toEqual(expect.objectContaining({ success: true, message: 'for request A' }));
    expect(socketService.listenerCount(ITEM_LIST_BY_OWNER_RESPONSE_EVENT)).toBe(0);
  });

  it('forwards forbidden market-offer-accept response payload and unsubscribes listener', () => {
    const request: MarketOfferAcceptRequest = {
      playerName: 'Pioneer',
      sessionKey: 'session-1',
      offerId: 'offer-locked',
      listingId: 'listing-locked',
      listingOwner: {
        ownerType: 'player-character',
        characterId: 'char-1',
      },
    };

    let received: MarketOfferAcceptResponse | undefined;
    service.acceptMarketOffer(request, (response) => {
      received = response;
    });

    const payload = socketService.emittedEvents[0].payload as MarketOfferAcceptRequest;
    socketService.trigger(MARKET_OFFER_ACCEPT_RESPONSE_EVENT, {
      success: false,
      message: 'Forbidden: listing ownership mismatch',
      reason: 'OWNERSHIP_MARKET_OFFER_ACCEPT_FORBIDDEN',
      correlationId: payload.correlationId!,
      requestIdentity: payload.requestIdentity!,
    } as MarketOfferAcceptResponse);

    expect(received).toEqual(
      expect.objectContaining({
        success: false,
        reason: 'OWNERSHIP_MARKET_OFFER_ACCEPT_FORBIDDEN',
      }),
    );
    expect(socketService.listenerCount(MARKET_OFFER_ACCEPT_RESPONSE_EVENT)).toBe(0);
  });
});
