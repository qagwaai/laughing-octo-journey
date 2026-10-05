import { Injectable, inject } from '@angular/core';
import {
  CREDIT_LEDGER_LIST_REQUEST_EVENT,
  CREDIT_LEDGER_LIST_RESPONSE_EVENT,
  type CreditLedgerListFailureReason,
  type CreditLedgerListRequest,
  type CreditLedgerListRequestIdentity,
  type CreditLedgerListResponse,
} from '../model/credit-ledger-list';
import { appLogger } from './logger';
import { createCorrelationId, matchesBasicRequestIdentity } from './socket-correlation';
import { SocketService } from './socket.service';

/** Error raised when the server answers credit-ledger-list with `success: false`. */
export class CreditLedgerListError extends Error {
  constructor(
    message: string,
    readonly reason: CreditLedgerListFailureReason | undefined,
  ) {
    super(message);
    this.name = 'CreditLedgerListError';
  }
}

function createLedgerCorrelationId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : createCorrelationId('credit-ledger-list');
}

function buildDefaultCreditLedgerListRequestIdentity(request: CreditLedgerListRequest): CreditLedgerListRequestIdentity {
  return {
    operation: 'credit-ledger-list',
    entityType: 'credit-ledger',
    containerId: request.characterId?.trim() || `player-${request.playerName.trim().toLowerCase()}`,
  };
}

@Injectable({ providedIn: 'root' })
/**
 * Provides credit ledger retrieval through the credit-ledger-list socket contract.
 */
export class CreditLedgerService {
  private socketService = inject(SocketService);

  /**
   * Requests a single page of credit ledger entries and returns an unsubscribe function.
   * The listener detaches after the first correlated response.
   */
  listCreditLedger(
    request: CreditLedgerListRequest,
    onResponse: (response: CreditLedgerListResponse) => void,
  ): () => void {
    const expectedCorrelationId = request.correlationId?.trim() || createLedgerCorrelationId();
    const expectedRequestIdentity = request.requestIdentity ?? buildDefaultCreditLedgerListRequestIdentity(request);
    const requestWithCorrelation: CreditLedgerListRequest = {
      ...request,
      correlationId: expectedCorrelationId,
      requestIdentity: expectedRequestIdentity,
    };

    let unsubscribe: () => void = () => undefined;
    unsubscribe = this.socketService.on(CREDIT_LEDGER_LIST_RESPONSE_EVENT, (response: CreditLedgerListResponse) => {
      const responseCorrelationId = response?.correlationId?.trim() ?? '';
      if (
        responseCorrelationId !== expectedCorrelationId ||
        !matchesBasicRequestIdentity(response.requestIdentity ?? undefined, expectedRequestIdentity)
      ) {
        appLogger.warn(
          `[socket-correlation] Dropping unmatched credit-ledger-list response. responseCorrelationId=${response?.correlationId ?? 'missing'} expectedCorrelationId=${expectedCorrelationId}`,
        );
        return;
      }

      unsubscribe();
      onResponse(response);
    });

    this.socketService.emit(CREDIT_LEDGER_LIST_REQUEST_EVENT, requestWithCorrelation);
    return () => unsubscribe();
  }

  /**
   * Fetches one ledger page. Resolves only on `success: true` (so failure zeros are never
   * mistaken for a balance); rejects with {@link CreditLedgerListError} on failure, or a
   * `TimeoutError` when no correlated response arrives within `timeoutMs`.
   */
  fetchCreditLedgerPage(request: CreditLedgerListRequest, timeoutMs: number): Promise<CreditLedgerListResponse> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        unsubscribe();
        const error = new Error(`credit-ledger-list timed out after ${timeoutMs}ms`);
        error.name = 'TimeoutError';
        reject(error);
      }, timeoutMs);

      const unsubscribe = this.listCreditLedger(request, (response) => {
        clearTimeout(timer);
        if (!response.success) {
          reject(new CreditLedgerListError(response.message || 'credit-ledger-list failed', response.reason));
          return;
        }
        resolve(response);
      });
    });
  }
}
