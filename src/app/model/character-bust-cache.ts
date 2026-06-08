import type { BustDescriptorInput } from './bust-descriptor';

const CHARACTER_BUST_CACHE_PREFIX = 'character-bust-cache::';

function cacheKey(characterId: string): string {
  return `${CHARACTER_BUST_CACHE_PREFIX}${characterId}`;
}

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && !!window.localStorage;
}

export function readCachedCharacterBustDescriptor(characterId: string): BustDescriptorInput | null {
  const normalizedCharacterId = characterId.trim();
  if (!normalizedCharacterId || !canUseLocalStorage()) {
    return null;
  }

  const raw = window.localStorage.getItem(cacheKey(normalizedCharacterId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as BustDescriptorInput;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeCachedCharacterBustDescriptor(characterId: string, descriptor: BustDescriptorInput): void {
  const normalizedCharacterId = characterId.trim();
  if (!normalizedCharacterId || !canUseLocalStorage()) {
    return;
  }

  window.localStorage.setItem(cacheKey(normalizedCharacterId), JSON.stringify(descriptor));
}
