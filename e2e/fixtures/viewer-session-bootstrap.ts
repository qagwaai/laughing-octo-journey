import { expect, type Page } from '@playwright/test';
import { loginViaUI } from '../helpers/auth-helper';
import type { SocketIOMock } from './socket-mock';
import type { GameShellPage } from '../page-objects/game-shell.page';

interface ViewerSessionBootstrapOptions {
  page: Page;
  mock: SocketIOMock;
  gameShell: GameShellPage;
  joinButtonText?: string;
  timeout?: number;
}

export async function loginAndJoinViewerSession(options: ViewerSessionBootstrapOptions): Promise<void> {
  const { page, mock, gameShell, joinButtonText, timeout = 15_000 } = options;

  await loginViaUI(page, mock);
  await gameShell.joinGame(joinButtonText);
  await expect(page).toHaveURL(/left:game-main/, { timeout });
}
