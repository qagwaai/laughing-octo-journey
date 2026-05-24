/**
 * Canonical ship ownership descriptors returned by owner-aware ship contract endpoints.
 */

export type ShipOwnerType = 'unknown' | 'player' | 'player-character' | 'npc' | 'faction';

export interface ShipOwnerDescriptor {
  ownerType: ShipOwnerType;
  playerId: string | null;
  characterId: string | null;
  npcId: string | null;
  factionId: string | null;
}

export interface ShipOwnership extends ShipOwnerDescriptor {}

function coerceNullableString(value: unknown): string | null {
  if (value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function coerceShipOwnerType(value: unknown): ShipOwnerType | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case 'unknown':
    case 'player':
    case 'player-character':
    case 'npc':
    case 'faction':
      return normalized;
    default:
      return null;
  }
}

export function coerceShipOwnerDescriptor(raw: unknown): ShipOwnerDescriptor | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const candidate = raw as {
    ownerType?: unknown;
    playerId?: unknown;
    characterId?: unknown;
    npcId?: unknown;
    factionId?: unknown;
  };

  const ownerType = coerceShipOwnerType(candidate.ownerType);
  if (!ownerType) {
    return null;
  }

  return {
    ownerType,
    playerId: coerceNullableString(candidate.playerId),
    characterId: coerceNullableString(candidate.characterId),
    npcId: coerceNullableString(candidate.npcId),
    factionId: coerceNullableString(candidate.factionId),
  };
}

export function coerceShipOwnershipOrNull(raw: unknown): ShipOwnership | null {
  return coerceShipOwnerDescriptor(raw);
}