import { expect, type Page } from '@playwright/test';
import { loginViaUI } from '../helpers/auth-helper';
import type { GameShellPage } from '../page-objects/game-shell.page';
import type { SocketIOMock } from './socket-mock';

interface SharedSessionBootstrapOptions {
  page: Page;
  mock: SocketIOMock;
  gameShell: GameShellPage;
  registerSessionHandlers?: (mock: SocketIOMock) => void;
  joinButtonText?: string;
}

export interface CharacterListReadinessOptions {
  page: Page;
  mock: SocketIOMock;
  registerSessionHandlers: (mock: SocketIOMock) => void;
  characterListUrl?: string;
}

type CharacterListReadinessState = 'characters' | 'load' | 'login' | 'pending';

async function resolveCharacterListReadinessState(page: Page): Promise<CharacterListReadinessState> {
  const loginFormVisible = await page
    .locator('#playerName')
    .isVisible({ timeout: 250 })
    .catch(() => false);
  if (page.url().includes('left:login') || loginFormVisible) {
    return 'login';
  }
  if (!page.url().includes('left:character-list')) {
    return 'pending';
  }
  if ((await page.locator('.character-item').count()) > 0) {
    return 'characters';
  }
  const loadButton = page.locator('.load-btn').first();
  if ((await loadButton.count()) > 0 && (await loadButton.isVisible())) {
    return 'load';
  }
  return 'pending';
}

export async function ensureCharacterListReady(options: CharacterListReadinessOptions): Promise<void> {
  const {
    page,
    mock,
    registerSessionHandlers,
    characterListUrl = 'http://localhost:4200/(left:character-list)',
  } = options;
  await page.goto(characterListUrl);

  for (let recoveryAttempt = 0; recoveryAttempt < 3; recoveryAttempt += 1) {
    await expect
      .poll(() => resolveCharacterListReadinessState(page), { timeout: 15_000 })
      .not.toBe('pending');
    const readinessState = await resolveCharacterListReadinessState(page);

    if (readinessState === 'login') {
      registerSessionHandlers(mock);
      await loginViaUI(page, mock);
      continue;
    }

    if (readinessState === 'characters') {
      return;
    }

    if (readinessState === 'load') {
      const loadButton = page.locator('.load-btn').first();
      await expect(loadButton).toBeEnabled({ timeout: 5_000 });
      await loadButton.click();
      await expect.poll(() => page.locator('.character-item').count(), { timeout: 10_000 }).toBeGreaterThan(0);
      return;
    }
  }

  throw new Error(`Character list did not become ready after login recovery (url=${page.url()}).`);
}

export async function bootstrapSharedGameMainSession(options: SharedSessionBootstrapOptions): Promise<void> {
  const { page, mock, gameShell, registerSessionHandlers = () => {}, joinButtonText = 'Join Game in Progress' } = options;

  registerSessionHandlers(mock);
  await ensureCharacterListReady({ page, mock, registerSessionHandlers });
  await gameShell.joinGame(joinButtonText);
  await expect(page).toHaveURL(/left:game-main/, { timeout: 10_000 });
}
