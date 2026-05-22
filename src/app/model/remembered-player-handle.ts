export const REMEMBERED_PLAYER_HANDLE_STORAGE_KEY = 'auth.rememberedPlayerHandle';

export function readRememberedPlayerHandle(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  const value = window.localStorage.getItem(REMEMBERED_PLAYER_HANDLE_STORAGE_KEY);
  const normalized = value?.trim() ?? '';
  return normalized ? normalized : null;
}

export function writeRememberedPlayerHandle(playerName: string): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  const normalized = playerName.trim();
  if (!normalized) {
    window.localStorage.removeItem(REMEMBERED_PLAYER_HANDLE_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(REMEMBERED_PLAYER_HANDLE_STORAGE_KEY, normalized);
}

export function clearRememberedPlayerHandle(): void {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  window.localStorage.removeItem(REMEMBERED_PLAYER_HANDLE_STORAGE_KEY);
}
