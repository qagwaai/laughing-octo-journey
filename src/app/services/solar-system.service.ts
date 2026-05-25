import { Injectable, inject } from '@angular/core';
import { appLogger } from './logger';
import {
  SOLAR_SYSTEM_GET_REQUEST_EVENT,
  SOLAR_SYSTEM_GET_RESPONSE_EVENT,
  type SolarSystemGetRequestIdentity,
  type SolarSystemGetRequest,
  type SolarSystemGetResponse,
} from '../model/solar-system-get';
import {
  SOLAR_SYSTEM_LIST_REQUEST_EVENT,
  SOLAR_SYSTEM_LIST_RESPONSE_EVENT,
  type SolarSystemListRequestIdentity,
  type SolarSystemListRequest,
  type SolarSystemListResponse,
} from '../model/solar-system-list';
import { createCorrelationId, matchesBasicRequestIdentity, normalizeIdentityValue } from './socket-correlation';
import { SocketService } from './socket.service';

function buildSolarSystemListLegacyKey(request: SolarSystemListRequest): string {
  return [
    normalizeIdentityValue(request.playerName),
    normalizeIdentityValue(request.source),
    normalizeIdentityValue(request.search),
    String(request.maxDistanceParsec ?? ''),
    String(request.limit ?? ''),
  ].join('|');
}

function buildDefaultSolarSystemListRequestIdentity(request: SolarSystemListRequest): SolarSystemListRequestIdentity {
  return {
    operation: 'solar-system-list',
    entityType: request.source?.trim() || 'all-sources',
    containerId: buildSolarSystemListLegacyKey(request),
  };
}

function matchesSolarSystemListRequestIdentity(
  left: SolarSystemListRequestIdentity | undefined,
  right: SolarSystemListRequestIdentity | undefined,
): boolean {
  return matchesBasicRequestIdentity(left, right);
}

function isSolarSystemListResponseForRequest(
  response: SolarSystemListResponse,
  expectedCorrelationId: string,
  expectedRequestIdentity: SolarSystemListRequestIdentity,
  expectedRequest: SolarSystemListRequest,
): boolean {
  const responseCorrelationId = response.correlationId?.trim() ?? '';
  if (responseCorrelationId) {
    if (responseCorrelationId !== expectedCorrelationId) {
      return false;
    }

    if (response.requestIdentity) {
      return matchesSolarSystemListRequestIdentity(response.requestIdentity, expectedRequestIdentity);
    }
  }

  const hasResponseRequestId = typeof response.requestId === 'string' && response.requestId.length > 0;
  if (hasResponseRequestId && response.requestId !== expectedRequest.requestId) {
    return false;
  }
  if (!hasResponseRequestId && response.playerName && response.playerName !== expectedRequest.playerName) {
    return false;
  }

  return true;
}

function buildDefaultSolarSystemGetRequestIdentity(request: SolarSystemGetRequest): SolarSystemGetRequestIdentity {
  return {
    operation: 'solar-system-get',
    entityType: request.solarSystemId?.trim() || 'unknown-solar-system',
    containerId: [
      normalizeIdentityValue(request.playerName),
      normalizeIdentityValue(request.solarSystemId),
      normalizeIdentityValue(request.asOf),
    ].join('|'),
  };
}

function matchesSolarSystemGetRequestIdentity(
  left: SolarSystemGetRequestIdentity | undefined,
  right: SolarSystemGetRequestIdentity | undefined,
): boolean {
  return matchesBasicRequestIdentity(left, right);
}

function isSolarSystemGetResponseForRequest(
  response: SolarSystemGetResponse,
  expectedCorrelationId: string,
  expectedRequestIdentity: SolarSystemGetRequestIdentity,
  expectedRequest: SolarSystemGetRequest,
): boolean {
  const responseCorrelationId = response.correlationId?.trim() ?? '';
  if (responseCorrelationId) {
    if (responseCorrelationId !== expectedCorrelationId) {
      return false;
    }

    if (response.requestIdentity) {
      return matchesSolarSystemGetRequestIdentity(response.requestIdentity, expectedRequestIdentity);
    }
  }

  const hasResponseRequestId = typeof response.requestId === 'string' && response.requestId.length > 0;
  if (hasResponseRequestId && response.requestId !== expectedRequest.requestId) {
    return false;
  }
  if (!hasResponseRequestId) {
    if (response.solarSystemId && response.solarSystemId !== expectedRequest.solarSystemId) {
      return false;
    }
    if (response.playerName && response.playerName !== expectedRequest.playerName) {
      return false;
    }
  }

  return true;
}

@Injectable({ providedIn: 'root' })
/**
 * Handles solar-system list/get socket request/response flow for the Viewer page/scene.
 *
 * Response handlers are guarded so each `listSolarSystems`/`getSolarSystem` call
 * resolves its callback at most once even if multiple matching responses arrive
 * (e.g. background `on` listener races with `once`).
 */
export class SolarSystemService {
  private socketService = inject(SocketService);

  private nextRequestId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `ss-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  /**
   * Lists curated/procedural solar systems via `solar-system-list-request`.
   */
  listSolarSystems(request: SolarSystemListRequest, onResponse: (response: SolarSystemListResponse) => void): void {
    const requestWithId: SolarSystemListRequest = {
      ...request,
      requestId: request.requestId ?? this.nextRequestId(),
    };
    const expectedCorrelationId = request.correlationId?.trim() || createCorrelationId('solar-system-list');
    const expectedRequestIdentity = request.requestIdentity ?? buildDefaultSolarSystemListRequestIdentity(requestWithId);
    const requestWithCorrelation: SolarSystemListRequest = {
      ...requestWithId,
      correlationId: expectedCorrelationId,
      correlationSource: request.correlationSource ?? 'solar-system-service.listSolarSystems',
      requestIdentity: expectedRequestIdentity,
    };

    let handled = false;
    const unsubscribe = this.socketService.on(SOLAR_SYSTEM_LIST_RESPONSE_EVENT, (response: SolarSystemListResponse) => {
      if (handled) {
        return;
      }

      if (
        !isSolarSystemListResponseForRequest(
          response,
          expectedCorrelationId,
          expectedRequestIdentity,
          requestWithCorrelation,
        )
      ) {
        appLogger.warn(
          `[socket-correlation] Dropping unmatched solar-system-list response. responseCorrelationId=${response.correlationId ?? 'missing'} expectedCorrelationId=${expectedCorrelationId} responseRequestId=${response.requestId ?? 'missing'} expectedRequestId=${requestWithCorrelation.requestId ?? 'missing'}`,
        );
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(
            new CustomEvent('socket-correlation-warning', {
              detail: {
                operation: 'solar-system-list',
                responseCorrelationId: response.correlationId ?? null,
                expectedCorrelationId,
                responseRequestId: response.requestId ?? null,
                expectedRequestId: requestWithCorrelation.requestId ?? null,
              },
            }),
          );
        }
        return;
      }

      handled = true;
      unsubscribe();
      onResponse(response);
    });

    this.socketService.emit(SOLAR_SYSTEM_LIST_REQUEST_EVENT, requestWithCorrelation);
  }

  /**
   * Retrieves a single solar system (with bodies) via `solar-system-get-request`.
   */
  getSolarSystem(request: SolarSystemGetRequest, onResponse: (response: SolarSystemGetResponse) => void): void {
    const requestWithId: SolarSystemGetRequest = {
      ...request,
      requestId: request.requestId ?? this.nextRequestId(),
    };
    const expectedCorrelationId = request.correlationId?.trim() || createCorrelationId('solar-system-get');
    const expectedRequestIdentity = request.requestIdentity ?? buildDefaultSolarSystemGetRequestIdentity(requestWithId);
    const requestWithCorrelation: SolarSystemGetRequest = {
      ...requestWithId,
      correlationId: expectedCorrelationId,
      correlationSource: request.correlationSource ?? 'solar-system-service.getSolarSystem',
      requestIdentity: expectedRequestIdentity,
    };

    let handled = false;
    const unsubscribe = this.socketService.on(SOLAR_SYSTEM_GET_RESPONSE_EVENT, (response: SolarSystemGetResponse) => {
      if (handled) {
        return;
      }

      if (
        !isSolarSystemGetResponseForRequest(
          response,
          expectedCorrelationId,
          expectedRequestIdentity,
          requestWithCorrelation,
        )
      ) {
        appLogger.warn(
          `[socket-correlation] Dropping unmatched solar-system-get response. responseCorrelationId=${response.correlationId ?? 'missing'} expectedCorrelationId=${expectedCorrelationId} responseRequestId=${response.requestId ?? 'missing'} expectedRequestId=${requestWithCorrelation.requestId ?? 'missing'} responseSolarSystemId=${response.solarSystemId ?? 'missing'} expectedSolarSystemId=${requestWithCorrelation.solarSystemId}`,
        );
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
          window.dispatchEvent(
            new CustomEvent('socket-correlation-warning', {
              detail: {
                operation: 'solar-system-get',
                responseCorrelationId: response.correlationId ?? null,
                expectedCorrelationId,
                responseRequestId: response.requestId ?? null,
                expectedRequestId: requestWithCorrelation.requestId ?? null,
                responseSolarSystemId: response.solarSystemId ?? null,
                expectedSolarSystemId: requestWithCorrelation.solarSystemId,
              },
            }),
          );
        }
        return;
      }

      handled = true;
      unsubscribe();
      onResponse(response);
    });

    this.socketService.emit(SOLAR_SYSTEM_GET_REQUEST_EVENT, requestWithCorrelation);
  }
}
