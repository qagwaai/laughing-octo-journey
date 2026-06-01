import { Injectable, inject } from '@angular/core';
import {
  SHIP_LIST_BY_OWNER_REQUEST_EVENT,
  SHIP_LIST_BY_OWNER_RESPONSE_EVENT,
  type ShipListByOwnerRequestIdentity,
  type ShipListByOwnerRequest,
  type ShipListByOwnerResponse,
} from '../model/ship-list-by-owner';
import {
  SHIP_TRANSFER_REQUEST_EVENT,
  SHIP_TRANSFER_RESPONSE_EVENT,
  type ShipTransferRequestIdentity,
  type ShipTransferRequest,
  type ShipTransferResponse,
} from '../model/ship-transfer';
import { appLogger } from './logger';
import { createCorrelationId, matchesBasicRequestIdentity, normalizeIdentityValue } from './socket-correlation';
import { SocketService } from './socket.service';

function buildShipOwnerKey(owner: {
  ownerType?: string | null;
  playerId?: string | null;
  characterId?: string | null;
  npcId?: string | null;
  factionId?: string | null;
}): string {
  return [
    normalizeIdentityValue(owner.ownerType),
    normalizeIdentityValue(owner.playerId),
    normalizeIdentityValue(owner.characterId),
    normalizeIdentityValue(owner.npcId),
    normalizeIdentityValue(owner.factionId),
  ].join('|');
}

function buildShipOwnerCorrelationContainerId(owner: {
  ownerType?: string | null;
  playerId?: string | null;
  characterId?: string | null;
  npcId?: string | null;
  factionId?: string | null;
}): string {
  const ownerType = normalizeIdentityValue(owner.ownerType) || 'unknown';

  switch (ownerType) {
    case 'player-character':
      return `player-character:${normalizeIdentityValue(owner.characterId) || 'unknown-character'}`;
    case 'npc-pirate':
      return `npc-pirate:${normalizeIdentityValue(owner.npcId) || 'unknown-npc'}`;
    case 'unowned':
      return 'unowned';
    case 'unknown':
      return 'unknown';
    case 'player':
      return `player:${normalizeIdentityValue(owner.playerId) || 'unknown-player'}`;
    case 'npc':
      return `npc:${normalizeIdentityValue(owner.npcId) || 'unknown-npc'}`;
    case 'faction':
      return `faction:${normalizeIdentityValue(owner.factionId) || 'unknown-faction'}`;
    default:
      return buildShipOwnerKey(owner);
  }
}

function buildDefaultShipListByOwnerRequestIdentity(request: ShipListByOwnerRequest): ShipListByOwnerRequestIdentity {
  return {
    operation: 'ship-list-by-owner',
    entityType: 'ship',
    containerId: buildShipOwnerCorrelationContainerId(request.owner),
  };
}

function matchesShipListByOwnerRequestIdentity(
  left: ShipListByOwnerRequestIdentity | undefined,
  right: ShipListByOwnerRequestIdentity | undefined,
): boolean {
  return matchesBasicRequestIdentity(left, right);
}

function isShipListByOwnerResponseForRequest(
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
      return matchesShipListByOwnerRequestIdentity(response.requestIdentity, expectedRequestIdentity);
    }
  }

  const expectedOwnerKey = buildShipOwnerKey(expectedRequest.owner);
  const responseOwnerKey = response.owner ? buildShipOwnerKey(response.owner) : '';
  if (responseOwnerKey) {
    return responseOwnerKey === expectedOwnerKey;
  }

  return true;
}

function buildDefaultShipTransferRequestIdentity(request: ShipTransferRequest): ShipTransferRequestIdentity {
  return {
    operation: 'ship-transfer',
    entityType: 'ship',
    containerId: normalizeIdentityValue(request.shipId) || 'unknown-ship',
  };
}

function matchesShipTransferRequestIdentity(
  left: ShipTransferRequestIdentity | undefined,
  right: ShipTransferRequestIdentity | undefined,
): boolean {
  return matchesBasicRequestIdentity(left, right);
}

function isShipTransferResponseForRequest(
  response: ShipTransferResponse,
  expectedCorrelationId: string,
  expectedRequestIdentity: ShipTransferRequestIdentity,
  expectedRequest: ShipTransferRequest,
): boolean {
  const responseCorrelationId = response.correlationId?.trim() ?? '';
  if (responseCorrelationId) {
    if (responseCorrelationId !== expectedCorrelationId) {
      return false;
    }

    if (response.requestIdentity) {
      return matchesShipTransferRequestIdentity(response.requestIdentity, expectedRequestIdentity);
    }
  }

  const responseShipId = normalizeIdentityValue(response.shipId);
  const expectedShipId = normalizeIdentityValue(expectedRequest.shipId);
  if (responseShipId && expectedShipId && responseShipId !== expectedShipId) {
    return false;
  }

  return true;
}

function emitSocketCorrelationWarning(operation: string, detail: Record<string, unknown>): void {
  const detailKeys = Object.keys(detail);
  const serializedDetail = detailKeys
    .map((key) => `${key}=${detail[key] ?? 'missing'}`)
    .join(' ');

  appLogger.warn(`[socket-correlation] Dropping unmatched ${operation} response. ${serializedDetail}`);

  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(
      new CustomEvent('socket-correlation-warning', {
        detail: {
          operation,
          ...detail,
        },
      }),
    );
  }
}

@Injectable({ providedIn: 'root' })
/**
 * Handles ship-list socket request/response flow for pages that need active ship data.
 * Response handlers are guarded so callback logic executes at most once per request.
 */
export class ShipService {
  private socketService = inject(SocketService);

  /**
   * Requests ships by normalized ownership descriptor and resolves only matching responses.
   */
  listShipsByOwner(request: ShipListByOwnerRequest, onResponse: (response: ShipListByOwnerResponse) => void): void {
    const expectedCorrelationId = request.correlationId?.trim() || createCorrelationId('ship-list-by-owner');
    const expectedRequestIdentity = request.requestIdentity ?? buildDefaultShipListByOwnerRequestIdentity(request);
    const requestWithCorrelation: ShipListByOwnerRequest = {
      ...request,
      correlationId: expectedCorrelationId,
      correlationSource: request.correlationSource ?? 'ship-service.listShipsByOwner',
      requestIdentity: expectedRequestIdentity,
    };

    const unsubscribe = this.socketService.on(SHIP_LIST_BY_OWNER_RESPONSE_EVENT, (response: ShipListByOwnerResponse) => {
      if (
        !isShipListByOwnerResponseForRequest(
          response,
          expectedCorrelationId,
          expectedRequestIdentity,
          requestWithCorrelation,
        )
      ) {
        const responseCorrelationId = response.correlationId?.trim() ?? '';
        if (responseCorrelationId && responseCorrelationId !== expectedCorrelationId) {
          // Another in-flight request won this response; ignore without contract-variance warning noise.
          return;
        }

        emitSocketCorrelationWarning('ship-list-by-owner', {
          responseCorrelationId: response.correlationId ?? null,
          responseOwnerType: response.owner?.ownerType ?? null,
          responseOwnerCharacterId: response.owner?.characterId ?? null,
          expectedCorrelationId,
          expectedOwnerKey: expectedRequestIdentity.containerId,
        });
        return;
      }

      unsubscribe();
      onResponse(response);
    });

    this.socketService.emit(SHIP_LIST_BY_OWNER_REQUEST_EVENT, requestWithCorrelation);
  }

  /**
   * Requests a ship ownership transfer and resolves only matching responses.
   */
  transferShip(request: ShipTransferRequest, onResponse: (response: ShipTransferResponse) => void): void {
    const expectedCorrelationId = request.correlationId?.trim() || createCorrelationId('ship-transfer');
    const expectedRequestIdentity = request.requestIdentity ?? buildDefaultShipTransferRequestIdentity(request);
    const requestWithCorrelation: ShipTransferRequest = {
      ...request,
      correlationId: expectedCorrelationId,
      correlationSource: request.correlationSource ?? 'ship-service.transferShip',
      requestIdentity: expectedRequestIdentity,
    };

    const unsubscribe = this.socketService.on(SHIP_TRANSFER_RESPONSE_EVENT, (response: ShipTransferResponse) => {
      if (
        !isShipTransferResponseForRequest(
          response,
          expectedCorrelationId,
          expectedRequestIdentity,
          requestWithCorrelation,
        )
      ) {
        emitSocketCorrelationWarning('ship-transfer', {
          responseCorrelationId: response.correlationId ?? null,
          responseShipId: response.shipId ?? null,
          expectedCorrelationId,
          expectedShipId: requestWithCorrelation.shipId,
        });
        return;
      }

      unsubscribe();
      onResponse(response);
    });

    this.socketService.emit(SHIP_TRANSFER_REQUEST_EVENT, requestWithCorrelation);
  }
}
