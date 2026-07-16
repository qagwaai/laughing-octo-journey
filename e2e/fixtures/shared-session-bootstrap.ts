import { expect, type Page } from '@playwright/test';
import { loginViaUI } from '../helpers/auth-helper';
import type { SocketIOMock } from './socket-mock';
import type { GameShellPage } from '../page-objects/game-shell.page';

interface SharedSessionBootstrapOptions {
  page: Page;
  mock: SocketIOMock;
  gameShell: GameShellPage;
  registerSessionHandlers?: (mock: SocketIOMock) => void;
  joinButtonText?: string;
}

export async function bootstrapSharedGameMainSession(options: SharedSessionBootstrapOptions): Promise<void> {
  const { page, mock, gameShell, registerSessionHandlers, joinButtonText = 'Join Game in Progress' } = options;

  registerSessionHandlers?.(mock);

  await page.goto('http://localhost:4200/(left:character-list)');
  await page
    .waitForURL(/left:(character-list|login)/, { timeout: 15_000 })
    .catch(() => null);

  const isLoginFormVisible = async (): Promise<boolean> =>
    page
      .locator('#playerName')
      .isVisible({ timeout: 1_000 })
      .catch(() => false);

  if (!page.url().includes('left:character-list') || (await isLoginFormVisible())) {
    registerSessionHandlers?.(mock);
    await loginViaUI(page, mock);
  }

  await expect(page).toHaveURL(/left:character-list/, { timeout: 10_000 });

  if ((await isLoginFormVisible()) || page.url().includes('left:login')) {
    registerSessionHandlers?.(mock);
    await loginViaUI(page, mock);
    await expect(page).toHaveURL(/left:character-list/, { timeout: 10_000 });
  }

  if ((await page.locator('.character-item').count()) === 0) {
    const loadButton = page.locator('.load-btn').first();
    const loadButtonVisible = (await loadButton.count()) > 0 && (await loadButton.isVisible());
    if (!loadButtonVisible) {
      throw new Error(`Character list is empty and load button is unavailable (url=${page.url()}).`);
    }

    await expect(loadButton).toBeEnabled({ timeout: 5_000 });
    await loadButton.click();
    await expect.poll(() => page.locator('.character-item').count(), { timeout: 10_000 }).toBeGreaterThan(0);
  }

  await gameShell.joinGame(joinButtonText);
  await expect(page).toHaveURL(/left:game-main/, { timeout: 10_000 });
}
