import { Injectable, inject } from '@angular/core';
import { appLogger } from './logger';
import {
  MARKET_LIST_BY_LOCATION_REQUEST_EVENT,
  MARKET_LIST_BY_LOCATION_RESPONSE_EVENT,
  type MarketListRequestIdentity,
  type MarketListByLocationRequest,
  type MarketListByLocationResponse,
} from '../model/market-list';
import { createCorrelationId, matchesBasicRequestIdentity, normalizeIdentityValue } from './socket-correlation';
import { SocketService } from './socket.service';

function normalizeLocationTypes(locationTypes: string[] | undefined): string {
  return Array.isArray(locationTypes)
    ? locationTypes.map((locationType) => normalizeIdentityValue(locationType)).sort().join(',')
    : '';
}

function samePosition(
  left: MarketListByLocationRequest['positionKm'] | MarketListByLocationResponse['positionKm'],
  right: MarketListByLocationRequest['positionKm'] | MarketListByLocationResponse['positionKm'],
): boolean {
  if (!left || !right) {
    return false;
  }

  return left.x === right.x && left.y === right.y && left.z === right.z;
}

function buildDefaultMarketListByLocationRequestIdentity(
  request: MarketListByLocationRequest,
): MarketListRequestIdentity {
  return {
    operation: 'market-list-by-location',
    entityType: 'market',
    containerId: normalizeIdentityValue(request.solarSystemId) || 'unknown-solar-system',
  };
}

function matchesRequestIdentity(
  left: MarketListRequestIdentity | undefined,
  right: MarketListRequestIdentity | undefined,
): boolean {
  return matchesBasicRequestIdentity(left, right);
}

function isMarketListByLocationResponseForRequest(
  response: MarketListByLocationResponse,
  expectedCorrelationId: string,
  expectedRequestIdentity: MarketListRequestIdentity,
  expectedRequest: MarketListByLocationRequest,
): boolean {
  const responseCorrelationId = response.correlationId?.trim() ?? '';
  if (responseCorrelationId) {
    if (responseCorrelationId !== expectedCorrelationId) {
      return false;
    }

    if (response.requestIdentity) {
      return matchesRequestIdentity(response.requestIdentity, expectedRequestIdentity);
    }
  }

  if (response.playerName && response.playerName !== expectedRequest.playerName) {
    return false;
  }

  if (response.solarSystemId && response.solarSystemId !== expectedRequest.solarSystemId) {
    return false;
  }

  if (response.positionKm && !samePosition(response.positionKm, expectedRequest.positionKm)) {
    return false;
  }

  if (typeof response.distanceAu === 'number' && response.distanceAu !== expectedRequest.distanceAu) {
    return false;
  }

  if (response.locationTypes && normalizeLocationTypes(response.locationTypes) !== normalizeLocationTypes(expectedRequest.locationTypes)) {
    return false;
  }

  return true;
}

@Injectable({ providedIn: 'root' })
/**
 * Fetches market snapshots near a location through the market-list socket contract.
 */
export class MarketService {
  private socketService = inject(SocketService);

  /**
   * Requests nearby markets and forwards the first response to the provided callback.
   */
  listMarketsByLocation(
    request: MarketListByLocationRequest,
    onResponse: (response: MarketListByLocationResponse) => void,
  ): void {
    const expectedCorrelationId = request.correlationId?.trim() || createCorrelationId('market-list-by-location');
    const expectedRequestIdentity = request.requestIdentity ?? buildDefaultMarketListByLocationRequestIdentity(request);
    const requestWithCorrelation: MarketListByLocationRequest = {
      ...request,
      correlationId: expectedCorrelationId,
      correlationSource: request.correlationSource ?? 'market-service.listMarketsByLocation',
      requestIdentity: expectedRequestIdentity,
    };

    let handled = false;
    const unsubscribe = this.socketService.on(
      MARKET_LIST_BY_LOCATION_RESPONSE_EVENT,
      (response: MarketListByLocationResponse) => {
        if (handled) {
          return;
        }

        if (
          !isMarketListByLocationResponseForRequest(
            response,
            expectedCorrelationId,
            expectedRequestIdentity,
            requestWithCorrelation,
          )
        ) {
          appLogger.warn(
            `[socket-correlation] Dropping unmatched market-list-by-location response. responseCorrelationId=${response.correlationId ?? 'missing'} expectedCorrelationId=${expectedCorrelationId} responsePlayerName=${response.playerName ?? 'missing'} expectedPlayerName=${requestWithCorrelation.playerName} responseSolarSystemId=${response.solarSystemId ?? 'missing'} expectedSolarSystemId=${requestWithCorrelation.solarSystemId}`,
          );
          return;
        }

        handled = true;
        unsubscribe();
        onResponse(response);
      },
    );
    this.socketService.emit(MARKET_LIST_BY_LOCATION_REQUEST_EVENT, requestWithCorrelation);
  }
}
