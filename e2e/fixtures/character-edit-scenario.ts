import type { Browser, BrowserContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { TEST_PLAYER } from '../helpers/auth-helper';
import { CharacterListPage } from '../page-objects/character-list.page';
import { CharacterSetupPage } from '../page-objects/character-setup.page';
import { ensureCharacterListReady } from './shared-session-bootstrap';
import { SocketIOMock } from './socket-mock';

export const BASE_CHARACTER = { id: 'char-edit-001', characterName: 'Zara Voss', level: 5 };

export type CharacterEditSession = {
  context: BrowserContext;
  page: Page;
  mock: SocketIOMock;
  characterListPage: CharacterListPage;
  characterSetupPage: CharacterSetupPage;
};

export function characterListResponse(characters: object[]) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    characters,
  };
}

export function registerCharacterEditHandlers(mock: SocketIOMock): void {
  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: characterListResponse([BASE_CHARACTER]),
  }));
}

export async function setupSharedCharacterEditSession(browser: Browser): Promise<CharacterEditSession> {
  const context = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
  const page = await context.newPage();
  const mock = new SocketIOMock(page);
  const characterListPage = new CharacterListPage(page);
  const characterSetupPage = new CharacterSetupPage(page);

  await mock.setup();
  registerCharacterEditHandlers(mock);

  await ensureCharacterListReady({
    page,
    mock,
    registerSessionHandlers: registerCharacterEditHandlers,
  });
  await expect(characterListPage.characterItems).toHaveCount(1, { timeout: 10_000 });

  return { context, page, mock, characterListPage, characterSetupPage };
}

export async function resetSharedCharacterEditSession(session: {
  page: Page;
  mock: SocketIOMock;
  characterListPage: CharacterListPage;
}): Promise<void> {
  if (!session.page || session.page.isClosed()) {
    return;
  }

  session.mock.reset();
  registerCharacterEditHandlers(session.mock);

  await ensureCharacterListReady({
    page: session.page,
    mock: session.mock,
    registerSessionHandlers: registerCharacterEditHandlers,
  });
  await expect(session.characterListPage.characterItems).toHaveCount(1, { timeout: 10_000 });
}
