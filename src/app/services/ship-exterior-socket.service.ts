import { Injectable, inject } from '@angular/core';
import { appLogger } from './logger';
import {
  CELESTIAL_BODY_LIST_REQUEST_EVENT,
  CELESTIAL_BODY_LIST_RESPONSE_EVENT,
  type CelestialBodyListRequestIdentity,
  type CelestialBodyListRequest,
  type CelestialBodyListResponse,
} from '../model/celestial-body-list';
import {
  ITEM_LIST_BY_LOCATION_REQUEST_EVENT,
  ITEM_LIST_BY_LOCATION_RESPONSE_EVENT,
  type ItemListByLocationRequestIdentity,
  type ItemListByLocationRequest,
  type ItemListByLocationResponse,
} from '../model/item-list-by-location';
import {
  LAUNCH_ITEM_RESPONSE_EVENT,
  type LaunchItemRequest,
  type LaunchItemRequestIdentity,
  type LaunchItemResponse,
} from '../model/launch-item';
import {
  SHIP_LIST_BY_OWNER_REQUEST_EVENT,
  SHIP_LIST_BY_OWNER_RESPONSE_EVENT,
  type ShipListByOwnerRequestIdentity,
  type ShipListByOwnerRequest,
  type ShipListByOwnerResponse,
} from '../model/ship-list-by-owner';
import { SocketService } from './socket.service';

function createCorrelationId(operation: string): string {
  const ts = Date.now().toString(36);
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `${operation}:${ts}:${randomPart}`;
}

@Injectable({ providedIn: 'root' })
/**
 * Socket contract wrapper dedicated to ship-exterior scene request/response flows.
 */
export class ShipExteriorSocketService {
  private socketService = inject(SocketService);
  private pendingLaunchByCorrelationId = new Map<
    string,
    { requestIdentity: LaunchItemRequestIdentity; legacyKey: string }
  >();
  private pendingLegacyLaunchKeyCount = new Map<string, number>();

  private normalizeIdentityValue(value: unknown): string {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  private buildShipOwnerKey(owner: {
    ownerType?: string | null;
    playerId?: string | null;
    characterId?: string | null;
    npcId?: string | null;
    factionId?: string | null;
  }): string {
    return [
      this.normalizeIdentityValue(owner.ownerType),
      this.normalizeIdentityValue(owner.playerId),
      this.normalizeIdentityValue(owner.characterId),
      this.normalizeIdentityValue(owner.npcId),
      this.normalizeIdentityValue(owner.factionId),
    ].join('|');
  }

  private buildShipOwnerCorrelationContainerId(owner: {
    ownerType?: string | null;
    playerId?: string | null;
    characterId?: string | null;
    npcId?: string | null;
    factionId?: string | null;
  }): string {
    const ownerType = this.normalizeIdentityValue(owner.ownerType) || 'unknown';

    switch (ownerType) {
      case 'player-character':
        return `player-character:${this.normalizeIdentityValue(owner.characterId) || 'unknown-character'}`;
      case 'player':
        return `player:${this.normalizeIdentityValue(owner.playerId) || 'unknown-player'}`;
      case 'npc':
        return `npc:${this.normalizeIdentityValue(owner.npcId) || 'unknown-npc'}`;
      case 'faction':
        return `faction:${this.normalizeIdentityValue(owner.factionId) || 'unknown-faction'}`;
      default:
        return this.buildShipOwnerKey(owner);
    }
  }

  private buildCelestialBodyListLegacyKey(input: {
    playerName?: string;
    solarSystemId?: string;
    distanceKm?: number;
    positionKm?: { x: number; y: number; z: number };
  }): string {
    const px = input.positionKm?.x ?? null;
    const py = input.positionKm?.y ?? null;
    const pz = input.positionKm?.z ?? null;
    return [
      this.normalizeIdentityValue(input.playerName),
      this.normalizeIdentityValue(input.solarSystemId),
      String(input.distanceKm ?? ''),
      String(px ?? ''),
      String(py ?? ''),
      String(pz ?? ''),
    ].join('|');
  }

  private buildDefaultCelestialBodyListRequestIdentity(
    request: CelestialBodyListRequest,
  ): CelestialBodyListRequestIdentity {
    return {
      operation: 'celestial-body-list',
      entityType: request.solarSystemId?.trim() || 'unknown-solar-system',
      containerId: this.buildCelestialBodyListLegacyKey(request),
    };
  }

  private matchesCelestialBodyListRequestIdentity(
    left: CelestialBodyListRequestIdentity | undefined,
    right: CelestialBodyListRequestIdentity | undefined,
  ): boolean {
    if (!left || !right) {
      return false;
    }

    return (
      this.normalizeIdentityValue(left.operation) === this.normalizeIdentityValue(right.operation) &&
      this.normalizeIdentityValue(left.entityType) === this.normalizeIdentityValue(right.entityType) &&
      this.normalizeIdentityValue(left.containerId) === this.normalizeIdentityValue(right.containerId)
    );
  }

  private isCelestialBodyListResponseForRequest(
    response: CelestialBodyListResponse,
    expectedCorrelationId: string,
    expectedRequestIdentity: CelestialBodyListRequestIdentity,
    expectedRequest: CelestialBodyListRequest,
  ): boolean {
    const responseCorrelationId = response.correlationId?.trim() ?? '';
    if (responseCorrelationId) {
      if (responseCorrelationId !== expectedCorrelationId) {
        return false;
      }

      if (response.requestIdentity) {
        return this.matchesCelestialBodyListRequestIdentity(response.requestIdentity, expectedRequestIdentity);
      }
    }

    const expectedKey = this.buildCelestialBodyListLegacyKey(expectedRequest);
    const responseKey = this.buildCelestialBodyListLegacyKey({
      playerName: response.playerName,
      solarSystemId: response.solarSystemId,
      distanceKm: response.distanceKm,
      positionKm: response.positionKm,
    });
    if (responseKey.replace(/\|/g, '').length > 0) {
      return responseKey === expectedKey;
    }

    return true;
  }

  private buildItemListByLocationLegacyKey(input: {
    playerName?: string;
    shipId?: string;
    solarSystemId?: string;
    maxDistanceKm?: number;
  }): string {
    return [
      this.normalizeIdentityValue(input.playerName),
      this.normalizeIdentityValue(input.shipId),
      this.normalizeIdentityValue(input.solarSystemId),
      String(input.maxDistanceKm ?? ''),
    ].join('|');
  }

  private buildDefaultItemListByLocationRequestIdentity(
    request: ItemListByLocationRequest,
  ): ItemListByLocationRequestIdentity {
    return {
      operation: 'item-list-by-location',
      entityType: request.location?.solarSystemId?.trim() || 'unknown-solar-system',
      containerId: this.buildItemListByLocationLegacyKey({
        playerName: request.playerName,
        shipId: request.shipId,
        solarSystemId: request.location?.solarSystemId,
        maxDistanceKm: request.maxDistanceKm,
      }),
    };
  }

  private matchesItemListByLocationRequestIdentity(
    left: ItemListByLocationRequestIdentity | undefined,
    right: ItemListByLocationRequestIdentity | undefined,
  ): boolean {
    if (!left || !right) {
      return false;
    }

    return (
      this.normalizeIdentityValue(left.operation) === this.normalizeIdentityValue(right.operation) &&
      this.normalizeIdentityValue(left.entityType) === this.normalizeIdentityValue(right.entityType) &&
      this.normalizeIdentityValue(left.containerId) === this.normalizeIdentityValue(right.containerId)
    );
  }

  private isItemListByLocationResponseForRequest(
    response: ItemListByLocationResponse,
    expectedCorrelationId: string,
    expectedRequestIdentity: ItemListByLocationRequestIdentity,
    expectedRequest: ItemListByLocationRequest,
  ): boolean {
    const responseCorrelationId = response.correlationId?.trim() ?? '';
    if (responseCorrelationId) {
      if (responseCorrelationId !== expectedCorrelationId) {
        return false;
      }

      if (response.requestIdentity) {
        return this.matchesItemListByLocationRequestIdentity(response.requestIdentity, expectedRequestIdentity);
      }
    }

    const requestShipId = this.normalizeIdentityValue(expectedRequest.shipId);
    const requestSolarSystemId = this.normalizeIdentityValue(expectedRequest.location?.solarSystemId);
    const responseItems = Array.isArray(response.items) ? response.items : [];
    if (responseItems.length > 0) {
      for (const item of responseItems) {
        const containerId = this.normalizeIdentityValue(item.container?.containerId);
        if (containerId && requestShipId && containerId !== requestShipId) {
          return false;
        }

        const itemSolarSystemId = this.normalizeIdentityValue(item.spatial?.solarSystemId);
        if (itemSolarSystemId && requestSolarSystemId && itemSolarSystemId !== requestSolarSystemId) {
          return false;
        }
      }
    }

    return true;
  }

  private buildDefaultShipListByOwnerRequestIdentity(request: ShipListByOwnerRequest): ShipListByOwnerRequestIdentity {
    return {
      operation: 'ship-list-by-owner',
      entityType: 'ship',
      containerId: this.buildShipOwnerCorrelationContainerId(request.owner),
    };
  }

  private matchesShipListByOwnerRequestIdentity(
    left: ShipListByOwnerRequestIdentity | undefined,
    right: ShipListByOwnerRequestIdentity | undefined,
  ): boolean {
    if (!left || !right) {
      return false;
    }

    return (
      this.normalizeIdentityValue(left.operation) === this.normalizeIdentityValue(right.operation) &&
      this.normalizeIdentityValue(left.entityType) === this.normalizeIdentityValue(right.entityType) &&
      this.normalizeIdentityValue(left.containerId) === this.normalizeIdentityValue(right.containerId)
    );
  }

  private isShipListByOwnerResponseForRequest(
    response: ShipListByOwnerResponse,
    expectedCorrelationId: string,
    expectedRequestIdentity: ShipListByOwnerRequestIdentity,
    expectedRequest: ShipListByOwnerRequest,
  ): boolean {
    const responseCorrelationId = response.correlationId?.trim() ?? '';
    if (responseCorrelationId) {
      if (responseCorrelationId !== expectedCorrelationId) {
        return false;
      }

      if (response.requestIdentity) {
        return this.matchesShipListByOwnerRequestIdentity(response.requestIdentity, expectedRequestIdentity);
      }
    }

    const expectedOwnerKey = this.buildShipOwnerKey(expectedRequest.owner);
    const responseOwnerKey = response.owner ? this.buildShipOwnerKey(response.owner) : '';
    if (responseOwnerKey) {
      return responseOwnerKey === expectedOwnerKey;
    }

    return true;
  }

  private buildLaunchLegacyKey(input: {
    itemId: string;
    itemType: string;
    hotkey: number;
    shipId: string;
    characterId: string;
    targetCelestialBodyId: string;
  }): string {
    return [
      this.normalizeIdentityValue(input.itemId),
      this.normalizeIdentityValue(input.itemType),
      String(input.hotkey),
      this.normalizeIdentityValue(input.shipId),
      this.normalizeIdentityValue(input.characterId),
      this.normalizeIdentityValue(input.targetCelestialBodyId),
    ].join('|');
  }

  private incrementPendingLegacyKey(key: string): void {
    const next = (this.pendingLegacyLaunchKeyCount.get(key) ?? 0) + 1;
    this.pendingLegacyLaunchKeyCount.set(key, next);
  }

  private decrementPendingLegacyKey(key: string): void {
    const current = this.pendingLegacyLaunchKeyCount.get(key) ?? 0;
    if (current <= 1) {
      this.pendingLegacyLaunchKeyCount.delete(key);
      return;
    }

    this.pendingLegacyLaunchKeyCount.set(key, current - 1);
  }

  private registerPendingLaunch(request: LaunchItemRequest): void {
    const correlationId = request.correlationId?.trim();
    const requestIdentity = request.requestIdentity;
    const legacyKey = this.buildLaunchLegacyKey({
      itemId: request.itemId,
      itemType: request.itemType,
      hotkey: request.hotkey,
      shipId: request.shipId,
      characterId: request.characterId,
      targetCelestialBodyId: request.targetCelestialBodyId,
    });

    this.incrementPendingLegacyKey(legacyKey);

    if (correlationId && requestIdentity) {
      this.pendingLaunchByCorrelationId.set(correlationId, { requestIdentity, legacyKey });
    }
  }

  private consumePendingLaunchByLegacyKey(legacyKey: string): boolean {
    if (!this.pendingLegacyLaunchKeyCount.has(legacyKey)) {
      return false;
    }

    this.decrementPendingLegacyKey(legacyKey);
    for (const [correlationId, pending] of this.pendingLaunchByCorrelationId.entries()) {
      if (pending.legacyKey === legacyKey) {
        this.pendingLaunchByCorrelationId.delete(correlationId);
        break;
      }
    }
    return true;
  }

  private hasPendingLaunchRequests(): boolean {
    return this.pendingLaunchByCorrelationId.size > 0 || this.pendingLegacyLaunchKeyCount.size > 0;
  }

  private shouldAcceptLaunchResponse(response: LaunchItemResponse): boolean {
    if (!this.hasPendingLaunchRequests()) {
      return true;
    }

    const responseCorrelationId = response.correlationId?.trim() ?? '';
    if (responseCorrelationId) {
      const pending = this.pendingLaunchByCorrelationId.get(responseCorrelationId);
      if (!pending) {
        return false;
      }

      this.pendingLaunchByCorrelationId.delete(responseCorrelationId);
      this.decrementPendingLegacyKey(pending.legacyKey);
      return true;
    }

    const legacyKey = this.buildLaunchLegacyKey({
      itemId: response.itemId,
      itemType: response.itemType,
      hotkey: response.hotkey,
      shipId: response.shipId,
      characterId: response.characterId,
      targetCelestialBodyId: response.targetCelestialBodyId,
    });
    return this.consumePendingLaunchByLegacyKey(legacyKey);
  }

  /**
   * Subscribes to launch-item responses for active launch actions.
   */
  subscribeLaunchResponses(onResponse: (response: LaunchItemResponse) => void): () => void {
    return this.socketService.on(LAUNCH_ITEM_RESPONSE_EVENT, (response: LaunchItemResponse) => {
      if (!this.shouldAcceptLaunchResponse(response)) {
        appLogger.warn(
          `[socket-correlation] Dropping unmatched launch-item response in ship-exterior subscriber. responseCorrelationId=${response.correlationId ?? 'missing'} responseItemId=${response.itemId ?? 'missing'} responseItemType=${response.itemType ?? 'missing'} responseShipId=${response.shipId ?? 'missing'}`,
        );
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(
            new CustomEvent('socket-correlation-warning', {
              detail: {
                operation: 'launch-item',
                responseCorrelationId: response.correlationId ?? null,
                responseItemId: response.itemId ?? null,
                responseItemType: response.itemType ?? null,
                responseShipId: response.shipId ?? null,
              },
            }),
          );
        }
        return;
      }

      onResponse(response);
    });
  }

  /**
   * Requests ship list and resolves once with a matching response.
   */
  listShipsByOwner(
    request: ShipListByOwnerRequest,
    onResponse: (response: ShipListByOwnerResponse) => void,
  ): () => void {
    const expectedCorrelationId = request.correlationId?.trim() || createCorrelationId('ship-list-by-owner');
    const expectedRequestIdentity =
      request.requestIdentity ?? this.buildDefaultShipListByOwnerRequestIdentity(request);
    const requestWithCorrelation: ShipListByOwnerRequest = {
      ...request,
      correlationId: expectedCorrelationId,
      correlationSource: request.correlationSource ?? 'ship-exterior-socket.listShipsByOwner',
      requestIdentity: expectedRequestIdentity,
    };

    const unsubscribe = this.socketService.on(SHIP_LIST_BY_OWNER_RESPONSE_EVENT, (response: ShipListByOwnerResponse) => {
      if (
        !this.isShipListByOwnerResponseForRequest(
          response,
          expectedCorrelationId,
          expectedRequestIdentity,
          requestWithCorrelation,
        )
      ) {
        appLogger.warn(
          `[socket-correlation] Dropping unmatched ship-list-by-owner response in ship-exterior wrapper. responseCorrelationId=${response.correlationId ?? 'missing'} expectedCorrelationId=${expectedCorrelationId} responseOwnerType=${response.owner?.ownerType ?? 'missing'} responseOwnerCharacterId=${response.owner?.characterId ?? 'missing'}`,
        );
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(
            new CustomEvent('socket-correlation-warning', {
              detail: {
                operation: 'ship-list-by-owner',
                responseCorrelationId: response.correlationId ?? null,
                expectedCorrelationId,
                responseOwnerType: response.owner?.ownerType ?? null,
                responseOwnerCharacterId: response.owner?.characterId ?? null,
              },
            }),
          );
        }
        return;
      }

      unsubscribe();
      onResponse(response);
    });

    this.socketService.emit(SHIP_LIST_BY_OWNER_REQUEST_EVENT, requestWithCorrelation);
    return unsubscribe;
  }

  /**
   * Requests celestial bodies and resolves once with a matching response.
   */
  listCelestialBodies(
    request: CelestialBodyListRequest,
    onResponse: (response: CelestialBodyListResponse) => void,
  ): () => void {
    const expectedCorrelationId = request.correlationId?.trim() || createCorrelationId('celestial-body-list');
    const expectedRequestIdentity =
      request.requestIdentity ?? this.buildDefaultCelestialBodyListRequestIdentity(request);
    const requestWithCorrelation: CelestialBodyListRequest = {
      ...request,
      correlationId: expectedCorrelationId,
      correlationSource: request.correlationSource ?? 'ship-exterior-socket.listCelestialBodies',
      requestIdentity: expectedRequestIdentity,
    };

    const unsubscribe = this.socketService.on(
      CELESTIAL_BODY_LIST_RESPONSE_EVENT,
      (response: CelestialBodyListResponse) => {
        if (
          !this.isCelestialBodyListResponseForRequest(
            response,
            expectedCorrelationId,
            expectedRequestIdentity,
            requestWithCorrelation,
          )
        ) {
          appLogger.warn(
            `[socket-correlation] Dropping unmatched celestial-body-list response in ship-exterior wrapper. responseCorrelationId=${response.correlationId ?? 'missing'} expectedCorrelationId=${expectedCorrelationId} responseSolarSystemId=${response.solarSystemId ?? 'missing'}`,
          );
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(
              new CustomEvent('socket-correlation-warning', {
                detail: {
                  operation: 'celestial-body-list',
                  responseCorrelationId: response.correlationId ?? null,
                  expectedCorrelationId,
                  responseSolarSystemId: response.solarSystemId ?? null,
                },
              }),
            );
          }
          return;
        }

        unsubscribe();
        onResponse(response);
      },
    );

    this.socketService.emit(CELESTIAL_BODY_LIST_REQUEST_EVENT, requestWithCorrelation);
    return unsubscribe;
  }

  /**
   * Requests deployed items around the provided ship position and resolves once with a matching response.
   */
  listNearbyDeployedItems(
    request: ItemListByLocationRequest,
    onResponse: (response: ItemListByLocationResponse) => void,
  ): () => void {
    const expectedCorrelationId = request.correlationId?.trim() || createCorrelationId('item-list-by-location');
    const expectedRequestIdentity =
      request.requestIdentity ?? this.buildDefaultItemListByLocationRequestIdentity(request);
    const requestWithCorrelation: ItemListByLocationRequest = {
      ...request,
      correlationId: expectedCorrelationId,
      correlationSource: request.correlationSource ?? 'ship-exterior-socket.listNearbyDeployedItems',
      requestIdentity: expectedRequestIdentity,
    };

    const unsubscribe = this.socketService.on(
      ITEM_LIST_BY_LOCATION_RESPONSE_EVENT,
      (response: ItemListByLocationResponse) => {
        if (
          !this.isItemListByLocationResponseForRequest(
            response,
            expectedCorrelationId,
            expectedRequestIdentity,
            requestWithCorrelation,
          )
        ) {
          appLogger.warn(
            `[socket-correlation] Dropping unmatched item-list-by-location response in ship-exterior wrapper. responseCorrelationId=${response.correlationId ?? 'missing'} expectedCorrelationId=${expectedCorrelationId} expectedShipId=${request.shipId}`,
          );
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(
              new CustomEvent('socket-correlation-warning', {
                detail: {
                  operation: 'item-list-by-location',
                  responseCorrelationId: response.correlationId ?? null,
                  expectedCorrelationId,
                  expectedShipId: request.shipId,
                },
              }),
            );
          }
          return;
        }

        unsubscribe();
        onResponse(response);
      },
    );

    this.socketService.emit(ITEM_LIST_BY_LOCATION_REQUEST_EVENT, requestWithCorrelation);
    return unsubscribe;
  }

  /**
   * Emits launch-item request using the shared socket helper.
   */
  launchItem(request: LaunchItemRequest): void {
    const requestWithCorrelation = this.socketService.launchItem(request) ?? request;
    this.registerPendingLaunch(requestWithCorrelation);
  }
}
