/**
 * Local economy model for a character. Tracks credits and transaction history
 * in the client until a backend contract is defined.
 *
 * NOTE: Backend integration is pending. When the server contract is available,
 * `CharacterCredits.balance` should be sourced from the join/session response
 * and kept in sync via a new `credits-update` socket event.
 */
export interface CharacterCredits {
	characterId: string;
	/** Current credit balance. */
	balance: number;
	/** ISO timestamp of last known update. */
	updatedAt: string;
}

export interface CreditTransaction {
	id: string;
	characterId: string;
	amount: number;
	/** Positive = earned, negative = spent. */
	direction: 'credit' | 'debit';
	reason: string;
	missionId?: string;
	createdAt: string;
}

/** Storage key used to persist credits locally (prefixed by characterId). */
export const CHARACTER_CREDITS_STORAGE_KEY_PREFIX = 'stellar.credits';

export function buildCreditsStorageKey(characterId: string): string {
	return `${CHARACTER_CREDITS_STORAGE_KEY_PREFIX}::${characterId}`;
}

export function coerceCharacterCredits(raw: unknown, characterId: string): CharacterCredits {
	if (raw && typeof raw === 'object') {
		const obj = raw as Record<string, unknown>;
		const balance = typeof obj['balance'] === 'number' ? obj['balance'] : 0;
		const updatedAt =
			typeof obj['updatedAt'] === 'string' ? obj['updatedAt'] : new Date().toISOString();
		return { characterId, balance, updatedAt };
	}
	return { characterId, balance: 0, updatedAt: new Date().toISOString() };
}
