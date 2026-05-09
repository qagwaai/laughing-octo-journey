/**
 * Credit ledger model aligned with the server contract.
 * `credits` is always a computed sum: sum(put.amount) - sum(take.amount).
 * `creditLedger` is the canonical transaction history sourced from the server.
 */

/** A single entry in a character's credit ledger. */
export interface CreditLedgerEntry {
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