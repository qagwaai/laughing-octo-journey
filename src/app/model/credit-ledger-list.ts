import type { CreditLedgerEntry } from './domain/character-economy';

export const CREDIT_LEDGER_LIST_REQUEST_EVENT = 'credit-ledger-list-request';
export const CREDIT_LEDGER_LIST_RESPONSE_EVENT = 'credit-ledger-list-response';

export interface CreditLedgerListRequestIdentity {
  operation: string;
  entityType: string;
  containerId: string;
  [key: string]: unknown;
}

/**
 * Socket payload for listing a character's credit ledger (`/socket/credit-ledger-list`).
 * Event names: `credit-ledger-list-request` / `credit-ledger-list-response`.
 * Server defaults: offset 0, limit 50; limits above 200 are clamped.
 */
export interface CreditLedgerListRequest {
  playerName: string;
  sessionKey: string;
  characterId?: string;
  correlationId?: string;
  requestIdentity?: CreditLedgerListRequestIdentity;
  startAt?: string;
  endAt?: string;
  offset?: number;
  limit?: number;
}

/**
 * Socket response payload containing a page of credit ledger entries plus the authoritative balance.
 * On failure (`success: false`), `reason` is set and `entries`/`total`/`balance` are empty/zero;
 * those zeros are NOT an account balance.
 */
export interface CreditLedgerListResponse {
  success: boolean;
  message: string;
  reason?: CreditLedgerListFailureReason;
  correlationId: string | null;
  requestIdentity: CreditLedgerListRequestIdentity | null;
  playerName: string;
  /** Page sorted by timestamp descending, then id ascending. */
  entries: CreditLedgerEntry[];
  /** Count of all entries matching startAt/endAt before paging. */
  total: number;
  /** Full-scope balance = sum(put) - sum(take), before date filters or paging. */
  balance: number;
  offset: number;
  limit: number;
}

export type CreditLedgerListFailureReason =
  | 'invalid-session'
  | 'character-not-found'
  | 'invalid-request'
  | 'internal-error';
