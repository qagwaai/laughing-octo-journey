import { expect, test as base, type BrowserContext, type Page } from '@playwright/test';
import { SocketIOMock } from './socket-mock';
import { loginViaUI } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';

export type SessionHandlerRegistrar = (mock: SocketIOMock) => void;

export type JoinedGameFixtureConfig = {
  registerSessionHandlers: SessionHandlerRegistrar;
  storageStatePath?: string;
  characterListUrl?: string;
  joinedUrlPattern?: RegExp;
  joinButtonText?: string;
};

type JoinedGameWorkerState = {
  context: BrowserContext;
  page: Page;
  mock: SocketIOMock;
  gameShell: GameShellPage;
  joinedUrlPattern: RegExp;
  registerSessionHandlers: SessionHandlerRegistrar;
};

export type JoinedGameFixtures = {
  sharedPage: Page;
  sharedMock: SocketIOMock;
  sharedGameShell: GameShellPage;
  prepareJoinedPage: () => Promise<void>;
};

async function ensureCharacterListReady(
  page: Page,
  mock: SocketIOMock,
  registerSessionHandlers: SessionHandlerRegistrar,
  characterListUrl: string,
): Promise<void> {
  await page.goto(characterListUrl);

  try {
    await expect(page).toHaveURL(/left:character-list/, { timeout: 10_000 });
  } catch {
    // Full-suite runs can briefly bounce back to login even after storageState hydrate.
    registerSessionHandlers(mock);
    await loginViaUI(page, mock);
    await expect(page).toHaveURL(/left:character-list/, { timeout: 10_000 });
  }

  const loginFormVisibleBeforeLoad = await page
    .locator('#playerName')
    .isVisible({ timeout: 1_000 })
    .catch(() => false);
  if (page.url().includes('left:login') || loginFormVisibleBeforeLoad) {
    registerSessionHandlers(mock);
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
    await expect(page.locator('.character-item')).toHaveCount(1, { timeout: 10_000 });
  }
}

async function ensureGameJoined(
  page: Page,
  gameShell: GameShellPage,
  joinedUrlPattern: RegExp,
  joinButtonText?: string,
): Promise<void> {
  await gameShell.joinGame(joinButtonText);
  await expect(page).toHaveURL(joinedUrlPattern, { timeout: 10_000 });
}

export function createJoinedGameTest(config: JoinedGameFixtureConfig) {
  const storageStatePath = config.storageStatePath ?? 'e2e/.auth/user.json';
  const characterListUrl = config.characterListUrl ?? 'http://localhost:4200/(left:character-list)';
  const joinedUrlPattern = config.joinedUrlPattern ?? /left:game-main/;

  return base.extend<JoinedGameFixtures, { joinedGameWorker: JoinedGameWorkerState }>({
    joinedGameWorker: [
      async ({ browser }, use) => {
        const context = await browser.newContext({ storageState: storageStatePath });
        const page = await context.newPage();
        const mock = new SocketIOMock(page);
        const gameShell = new GameShellPage(page);

        await mock.setup();
        config.registerSessionHandlers(mock);

        await ensureCharacterListReady(page, mock, config.registerSessionHandlers, characterListUrl);
        await ensureGameJoined(page, gameShell, joinedUrlPattern, config.joinButtonText);

        await use({
          context,
          page,
          mock,
          gameShell,
          joinedUrlPattern,
          registerSessionHandlers: config.registerSessionHandlers,
        });

        await context.close();
      },
      { scope: 'worker' },
    ],

    sharedPage: async ({ joinedGameWorker }, use) => {
      await use(joinedGameWorker.page);
    },

    sharedMock: async ({ joinedGameWorker }, use) => {
      await use(joinedGameWorker.mock);
    },

    sharedGameShell: async ({ joinedGameWorker }, use) => {
      await use(joinedGameWorker.gameShell);
    },

    prepareJoinedPage: async ({ joinedGameWorker }, use) => {
      await use(async () => {
        const { page, mock, registerSessionHandlers, joinedUrlPattern } = joinedGameWorker;
        if (page.isClosed()) {
          throw new Error('joined-game fixture page closed unexpectedly.');
        }

        mock.reset();
        registerSessionHandlers(mock);

        if (joinedUrlPattern.test(page.url())) {
          return;
        }

        let attempts = 0;
        while (!joinedUrlPattern.test(page.url()) && attempts < 4) {
          attempts += 1;
          await page.goBack().catch(() => null);
        }

        if (!joinedUrlPattern.test(page.url())) {
          await page.goto('/(left:game-main)');
        }

        await expect(page).toHaveURL(joinedUrlPattern, { timeout: 10_000 });
      });
    },
  });
}
