export type OwnershipFailureReason =
  | 'OWNERSHIP_VALIDATION_FAILED'
  | 'SHIP_LIST_OWNER_FORBIDDEN'
  | 'ITEM_LIST_OWNER_FORBIDDEN'
  | 'OWNERSHIP_ITEM_FORBIDDEN'
  | 'OWNERSHIP_LISTING_FORBIDDEN'
  | 'OWNERSHIP_OFFER_FORBIDDEN'
  | 'OWNERSHIP_ACCEPT_FORBIDDEN'
  | 'SALVAGE_CLAIM_FORBIDDEN'
  | 'SALVAGE_ALREADY_OWNED'
  | 'PIRACY_SEIZE_INVALID_TARGET'
  | (string & {});

const OWNERSHIP_REASON_MESSAGES: Record<string, string> = {
  OWNERSHIP_VALIDATION_FAILED: 'Ownership payload is invalid for this operation.',
  SHIP_LIST_OWNER_FORBIDDEN: 'You cannot view ships for a different owner.',
  ITEM_LIST_OWNER_FORBIDDEN: 'You cannot view items for a different owner.',
  OWNERSHIP_ITEM_FORBIDDEN: 'You cannot modify items for a different owner.',
  OWNERSHIP_LISTING_FORBIDDEN: 'You cannot create a listing for a different owner.',
  OWNERSHIP_OFFER_FORBIDDEN: 'You cannot create an offer for a different owner.',
  OWNERSHIP_ACCEPT_FORBIDDEN: 'Only the listing owner can accept this offer.',
  SALVAGE_CLAIM_FORBIDDEN: 'You cannot claim salvage for a different owner.',
  SALVAGE_ALREADY_OWNED: 'This ship already has an owner and cannot be claimed as salvage.',
  PIRACY_SEIZE_INVALID_TARGET: 'Piracy target is invalid for ownership transfer.',
};

export function resolveOwnershipFailureMessage(reason: OwnershipFailureReason | undefined, fallback: string): string {
  const normalizedReason = reason?.trim() ?? '';
  if (!normalizedReason) {
    return fallback;
  }

  return OWNERSHIP_REASON_MESSAGES[normalizedReason] ?? fallback;
}
