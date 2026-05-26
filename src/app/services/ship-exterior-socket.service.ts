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
  private pendingLaunchByCorrelationId = new Map<string, LaunchItemRequestIdentity>();

  private normalizeIdentityValue(value: unknown): string {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
  }

  private serializeWarningDetail(detail: Record<string, unknown>): string {
    return Object.entries(detail)
      .map(([key, value]) => `${key}=${value ?? 'missing'}`)
      .join(' ');
  }

  private buildIdentityMismatchReason(
    expectedCorrelationId: string,
    responseCorrelationId: string | undefined,
    expectedRequestIdentity:
      | ShipListByOwnerRequestIdentity
      | CelestialBodyListRequestIdentity
      | ItemListByLocationRequestIdentity,
    responseRequestIdentity:
      | ShipListByOwnerRequestIdentity
      | CelestialBodyListRequestIdentity
      | ItemListByLocationRequestIdentity
      | undefined,
  ): string {
    const reasons: string[] = [];
    const normalizedResponseCorrelationId = responseCorrelationId?.trim() ?? '';
    if (!normalizedResponseCorrelationId) {
      reasons.push('missing-correlation-id');
    } else if (normalizedResponseCorrelationId !== expectedCorrelationId) {
      reasons.push('correlation-id');
    }

    if (!responseRequestIdentity) {
      reasons.push('missing-request-identity');
      return reasons.join('|');
    }

    if (
      this.normalizeIdentityValue(responseRequestIdentity.operation) !==
      this.normalizeIdentityValue(expectedRequestIdentity.operation)
    ) {
      reasons.push('operation');
    }

    if (
      this.normalizeIdentityValue(responseRequestIdentity.entityType) !==
      this.normalizeIdentityValue(expectedRequestIdentity.entityType)
    ) {
      reasons.push('entity-type');
    }

    if (
      this.normalizeIdentityValue(responseRequestIdentity.containerId) !==
      this.normalizeIdentityValue(expectedRequestIdentity.containerId)
    ) {
      reasons.push('container-id');
    }

    return reasons.join('|') || 'unknown';
  }

  private isForeignOperationPayload(
    expectedOperation: string,
    responseOperation: string | undefined,
  ): boolean {
    const normalizedResponseOperation = this.normalizeIdentityValue(responseOperation);
    if (!normalizedResponseOperation) {
      return false;
    }

    return normalizedResponseOperation !== this.normalizeIdentityValue(expectedOperation);
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
      case 'npc-pirate':
        return `npc-pirate:${this.normalizeIdentityValue(owner.npcId) || 'unknown-npc'}`;
      case 'unowned':
        return 'unowned';
      case 'unknown':
        return 'unknown';
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

  private buildDefaultCelestialBodyListRequestIdentity(
    request: CelestialBodyListRequest,
  ): CelestialBodyListRequestIdentity {
    return {
      operation: 'celestial-body-list',
      entityType: 'celestial-body',
      containerId: request.solarSystemId?.trim() || 'unknown-solar-system',
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
    _expectedRequest: CelestialBodyListRequest,
  ): boolean {
    const responseCorrelationId = response.correlationId?.trim() ?? '';
    if (!responseCorrelationId || responseCorrelationId !== expectedCorrelationId) {
      return false;
    }

    if (!response.requestIdentity) {
      return false;
    }

    return this.matchesCelestialBodyListRequestIdentity(response.requestIdentity, expectedRequestIdentity);
  }

  private buildDefaultItemListByLocationRequestIdentity(
    request: ItemListByLocationRequest,
  ): ItemListByLocationRequestIdentity {
    return {
      operation: 'item-list-by-location',
      entityType: 'item',
      containerId: request.solarSystemId?.trim() || 'unknown-solar-system',
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
    _expectedRequest: ItemListByLocationRequest,
  ): boolean {
    const responseCorrelationId = response.correlationId?.trim() ?? '';
    if (!responseCorrelationId || responseCorrelationId !== expectedCorrelationId) {
      return false;
    }

    if (!response.requestIdentity) {
      return false;
    }

    return this.matchesItemListByLocationRequestIdentity(response.requestIdentity, expectedRequestIdentity);
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
    _expectedRequest: ShipListByOwnerRequest,
  ): boolean {
    const responseCorrelationId = response.correlationId?.trim() ?? '';
    if (!responseCorrelationId || responseCorrelationId !== expectedCorrelationId) {
      return false;
    }

    if (!response.requestIdentity) {
      return false;
    }

    return this.matchesShipListByOwnerRequestIdentity(response.requestIdentity, expectedRequestIdentity);
  }

  private registerPendingLaunch(request: LaunchItemRequest): void {
    const correlationId = request.correlationId?.trim();
    const requestIdentity = request.requestIdentity;
    if (correlationId && requestIdentity) {
      this.pendingLaunchByCorrelationId.set(correlationId, requestIdentity);
    }
  }

  private shouldAcceptLaunchResponse(response: LaunchItemResponse): boolean {
    if (this.pendingLaunchByCorrelationId.size === 0) {
      return false;
    }

    const responseCorrelationId = response.correlationId?.trim() ?? '';
    if (!responseCorrelationId) {
      return false;
    }

    const pendingIdentity = this.pendingLaunchByCorrelationId.get(responseCorrelationId);
    if (!pendingIdentity) {
      return false;
    }

    this.pendingLaunchByCorrelationId.delete(responseCorrelationId);

    if (!response.requestIdentity) {
      return false;
    }

    return (
      this.normalizeIdentityValue(response.requestIdentity.operation) ===
        this.normalizeIdentityValue(pendingIdentity.operation) &&
      this.normalizeIdentityValue(response.requestIdentity.entityType) ===
        this.normalizeIdentityValue(pendingIdentity.entityType) &&
      this.normalizeIdentityValue(response.requestIdentity.containerId) ===
        this.normalizeIdentityValue(pendingIdentity.containerId)
    );
  }

  /**
   * Subscribes to launch-item responses for active launch actions.
   */
  subscribeLaunchResponses(onResponse: (response: LaunchItemResponse) => void): () => void {
    return this.socketService.on(LAUNCH_ITEM_RESPONSE_EVENT, (response: LaunchItemResponse) => {
      if (!this.shouldAcceptLaunchResponse(response)) {
        const warningDetail = {
          code: 'socket-correlation-unmatched',
          channel: 'ship-exterior-subscriber',
          operation: 'launch-item',
          reason: 'pending-correlation-not-found',
          responseEvent: LAUNCH_ITEM_RESPONSE_EVENT,
          responseCorrelationId: response.correlationId ?? null,
          responseItemId: response.itemId ?? null,
          responseItemType: response.itemType ?? null,
          responseShipId: response.shipId ?? null,
        };
        appLogger.warn(
          `[socket-correlation] Dropping unmatched launch-item response in ship-exterior subscriber. ${this.serializeWarningDetail(warningDetail)}`,
        );
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(
            new CustomEvent('socket-correlation-warning', {
              detail: warningDetail,
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
        if (
          this.isForeignOperationPayload(
            expectedRequestIdentity.operation,
            response.requestIdentity?.operation,
          )
        ) {
          const contractViolationDetail = {
            code: 'socket-contract-violation',
            channel: 'ship-exterior-wrapper',
            operation: 'ship-list-by-owner',
            reason: 'foreign-operation-on-channel',
            requestEvent: SHIP_LIST_BY_OWNER_REQUEST_EVENT,
            responseEvent: SHIP_LIST_BY_OWNER_RESPONSE_EVENT,
            expectedCorrelationId,
            expectedRequestOperation: expectedRequestIdentity.operation,
            expectedRequestEntityType: expectedRequestIdentity.entityType,
            expectedRequestContainerId: expectedRequestIdentity.containerId,
            responseCorrelationId: response.correlationId ?? null,
            responseRequestOperation: response.requestIdentity?.operation ?? null,
            responseRequestEntityType: response.requestIdentity?.entityType ?? null,
            responseRequestContainerId: response.requestIdentity?.containerId ?? null,
          };
          appLogger.error(
            `[socket-correlation] Contract violation: foreign operation payload on ship-list-by-owner response channel. ${this.serializeWarningDetail(contractViolationDetail)}`,
          );
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(
              new CustomEvent('socket-correlation-warning', {
                detail: contractViolationDetail,
              }),
            );
          }
          return;
        }

        const mismatchReason = this.buildIdentityMismatchReason(
          expectedCorrelationId,
          response.correlationId,
          expectedRequestIdentity,
          response.requestIdentity,
        );
        const warningDetail = {
          code: 'socket-correlation-unmatched',
          channel: 'ship-exterior-wrapper',
          operation: 'ship-list-by-owner',
          reason: mismatchReason,
          requestEvent: SHIP_LIST_BY_OWNER_REQUEST_EVENT,
          responseEvent: SHIP_LIST_BY_OWNER_RESPONSE_EVENT,
          expectedCorrelationId,
          expectedRequestOperation: expectedRequestIdentity.operation,
          expectedRequestEntityType: expectedRequestIdentity.entityType,
          expectedRequestContainerId: expectedRequestIdentity.containerId,
          responseCorrelationId: response.correlationId ?? null,
          responseOwnerType: response.owner?.ownerType ?? null,
          responseOwnerCharacterId: response.owner?.characterId ?? null,
          responseRequestOperation: response.requestIdentity?.operation ?? null,
          responseRequestEntityType: response.requestIdentity?.entityType ?? null,
          responseRequestContainerId: response.requestIdentity?.containerId ?? null,
        };
        appLogger.warn(
          `[socket-correlation] Dropping unmatched ship-list-by-owner response in ship-exterior wrapper. ${this.serializeWarningDetail(warningDetail)}`,
        );
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(
            new CustomEvent('socket-correlation-warning', {
              detail: warningDetail,
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
          const mismatchReason = this.buildIdentityMismatchReason(
            expectedCorrelationId,
            response.correlationId,
            expectedRequestIdentity,
            response.requestIdentity,
          );
          const warningDetail = {
            code: 'socket-correlation-unmatched',
            channel: 'ship-exterior-wrapper',
            operation: 'celestial-body-list',
            reason: mismatchReason,
            requestEvent: CELESTIAL_BODY_LIST_REQUEST_EVENT,
            responseEvent: CELESTIAL_BODY_LIST_RESPONSE_EVENT,
            expectedCorrelationId,
            expectedRequestOperation: expectedRequestIdentity.operation,
            expectedRequestEntityType: expectedRequestIdentity.entityType,
            expectedRequestContainerId: expectedRequestIdentity.containerId,
            responseCorrelationId: response.correlationId ?? null,
            responseSolarSystemId: response.solarSystemId ?? null,
            responseRequestOperation: response.requestIdentity?.operation ?? null,
            responseRequestEntityType: response.requestIdentity?.entityType ?? null,
            responseRequestContainerId: response.requestIdentity?.containerId ?? null,
          };
          appLogger.warn(
            `[socket-correlation] Dropping unmatched celestial-body-list response in ship-exterior wrapper. ${this.serializeWarningDetail(warningDetail)}`,
          );
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(
              new CustomEvent('socket-correlation-warning', {
                detail: warningDetail,
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
          const mismatchReason = this.buildIdentityMismatchReason(
            expectedCorrelationId,
            response.correlationId,
            expectedRequestIdentity,
            response.requestIdentity,
          );
          const warningDetail = {
            code: 'socket-correlation-unmatched',
            channel: 'ship-exterior-wrapper',
            operation: 'item-list-by-location',
            reason: mismatchReason,
            requestEvent: ITEM_LIST_BY_LOCATION_REQUEST_EVENT,
            responseEvent: ITEM_LIST_BY_LOCATION_RESPONSE_EVENT,
            expectedCorrelationId,
            expectedRequestOperation: expectedRequestIdentity.operation,
            expectedRequestEntityType: expectedRequestIdentity.entityType,
            expectedRequestContainerId: expectedRequestIdentity.containerId,
            expectedSolarSystemId: request.solarSystemId,
            expectedDistanceKm: request.distanceKm,
            responseCorrelationId: response.correlationId ?? null,
            responseRequestOperation: response.requestIdentity?.operation ?? null,
            responseRequestEntityType: response.requestIdentity?.entityType ?? null,
            responseRequestContainerId: response.requestIdentity?.containerId ?? null,
          };
          appLogger.warn(
            `[socket-correlation] Dropping unmatched item-list-by-location response in ship-exterior wrapper. ${this.serializeWarningDetail(warningDetail)}`,
          );
          if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(
              new CustomEvent('socket-correlation-warning', {
                detail: warningDetail,
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
