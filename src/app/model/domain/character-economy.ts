/**
 * Credit ledger model aligned with the server contract (OpenAPI 4.0.0, credit-ledger-entry.schema.json).
 * The authoritative balance comes from `credit-ledger-list` `balance` (full scope, before filters/paging).
 * `creditLedger` on character-list is a complete snapshot in append order.
 */

/** A single immutable entry in a character's credit ledger. */
export interface CreditLedgerEntry {
  /** Opaque ID, unique across the player's ledger and stable across reads. */
  id: string;
  /** 'put' = credits in, 'take' = credits out. */
  type: 'put' | 'take';
  /** Positive amount for this transaction. */
  amount: number;
  /** Human-readable reason for the transaction. */
  description: string;
  /** ISO 8601 timestamp of the transaction. */
  timestamp: string;
  /** Optional identifier linking to a source event; null when not applicable. */
  referenceId: string | null;
}
