import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';
import { CharacterListPage } from '../page-objects/character-list.page';
import { CharacterSetupPage } from '../page-objects/character-setup.page';

function characterListResponse(characters: object[]) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    characters,
  };
}

const BASE_CHARACTER = { id: 'char-edit-001', characterName: 'Zara Voss', level: 5 };

let sharedContext: BrowserContext;
let sharedPage: Page;
let sharedMock: SocketIOMock;
let sharedCharacterListPage: CharacterListPage;
let sharedCharacterSetupPage: CharacterSetupPage;

function registerCharacterEditHandlers(mock: SocketIOMock): void {
  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: characterListResponse([BASE_CHARACTER]),
  }));
}

test.describe.configure({ mode: 'serial' });

async function setupSharedCharacterEditSession(browser: Browser): Promise<void> {
  sharedContext = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
  sharedPage = await sharedContext.newPage();
  sharedMock = new SocketIOMock(sharedPage);
  sharedCharacterListPage = new CharacterListPage(sharedPage);
  sharedCharacterSetupPage = new CharacterSetupPage(sharedPage);

  await sharedMock.setup();
  registerCharacterEditHandlers(sharedMock);

  await sharedPage.goto('http://localhost:4200/(left:character-list)');

  try {
    await expect(sharedPage).toHaveURL(/left:character-list/, { timeout: 10_000 });
  } catch {
    registerCharacterEditHandlers(sharedMock);
    await loginViaUI(sharedPage, sharedMock);
    await expect(sharedPage).toHaveURL(/left:character-list/, { timeout: 10_000 });
  }

  const loginFormVisibleBeforeLoad = await sharedPage
    .locator('#playerName')
    .isVisible({ timeout: 1_000 })
    .catch(() => false);
  if (sharedPage.url().includes('left:login') || loginFormVisibleBeforeLoad) {
    registerCharacterEditHandlers(sharedMock);
    await loginViaUI(sharedPage, sharedMock);
    await expect(sharedPage).toHaveURL(/left:character-list/, { timeout: 10_000 });
  }

  if ((await sharedCharacterListPage.characterItems.count()) === 0) {
    await sharedCharacterListPage.loadButton.click();
  }
  await expect(sharedCharacterListPage.characterItems).toHaveCount(1, { timeout: 10_000 });
}

async function resetSharedCharacterEditSession(): Promise<void> {
  if (!sharedPage || sharedPage.isClosed()) {
    return;
  }

  sharedMock.reset();
  registerCharacterEditHandlers(sharedMock);

  let attempts = 0;
  while (!sharedPage.url().includes('left:character-list') && attempts < 4) {
    attempts += 1;
    await sharedPage.goBack();
  }

  await expect(sharedPage).toHaveURL(/left:character-list/, { timeout: 10_000 });
  await expect(sharedCharacterListPage.characterItems).toHaveCount(1, { timeout: 10_000 });
}

test.beforeAll(async ({ browser }) => {
  await setupSharedCharacterEditSession(browser);
});

test.afterEach(async () => {
  await resetSharedCharacterEditSession();
});

test.afterAll(async () => {
  await sharedContext.close();
});

test.describe('Character Edit — setup save redirect', () => {
  test('redirects to character list and shows updated character after successful edit save', async () => {
    let receivedEditRequest: Record<string, unknown> | null = null;
    let shipListRequestCount = 0;

    sharedMock.on('character-edit-request', (request) => {
      receivedEditRequest = request as Record<string, unknown>;
      // Override the character-list-request handler before the client redirects back,
      // so the post-edit auto-load returns the updated name.
      sharedMock.on('character-list-request', () => ({
        event: 'character-list-response',
        data: characterListResponse([{ ...BASE_CHARACTER, characterName: 'Zara Prime' }]),
      }));
      return {
        event: 'character-edit-response',
        data: {
          success: true,
          message: 'Character updated.',
          playerName: TEST_PLAYER,
          characterId: 'char-edit-001',
          characterName: 'Zara Prime',
        },
      };
    });

    sharedMock.on('ship-list-by-owner-request', () => {
      shipListRequestCount += 1;
      return null;
    });

    await expect(sharedCharacterListPage.characterItems).toHaveCount(1);
    await expect(sharedCharacterListPage.characterName(0)).toHaveText('Zara Voss');

    await sharedCharacterListPage.editButton(0).click();
    await expect(sharedPage).toHaveURL(/right:character-bust-preview/, { timeout: 15_000 });

    await sharedCharacterSetupPage.fillCharacterName('Zara Prime');
    await sharedCharacterSetupPage.clickSubmit();

    await expect(sharedPage).toHaveURL(/left:character-list/);
    await expect(sharedCharacterListPage.characterItems).toHaveCount(1);
    await expect(sharedCharacterListPage.characterName(0)).toHaveText('Zara Prime');

    expect(receivedEditRequest).toEqual(
      expect.objectContaining({
        characterId: 'char-edit-001',
        playerName: TEST_PLAYER,
        characterName: 'Zara Prime',
        sessionKey: 'test-session-key-abc123',
      }),
    );
    expect(shipListRequestCount).toBe(0);
  });

  test('renders the 2D portrait preview in edit mode', async () => {
    await expect(sharedCharacterListPage.characterItems).toHaveCount(1);
    await sharedCharacterListPage.editButton(0).click();
    await expect(sharedPage).toHaveURL(/right:character-bust-preview/, { timeout: 15_000 });

    await expect(sharedCharacterSetupPage.previewImage).toBeVisible();
    await expect(sharedCharacterSetupPage.previewImageAssetName).toContainText('.jpeg');
    await expect(sharedCharacterSetupPage.previewImageState).toContainText('.jpeg');
  });

  test('blocks edit when renaming to another existing character name', async () => {
    // Override to 2-character list and trigger a fresh load.
    sharedMock.on('character-list-request', () => ({
      event: 'character-list-response',
      data: characterListResponse([
        { id: 'char-edit-001', characterName: 'Zara Voss', level: 5 },
        { id: 'char-other-002', characterName: 'Atlas Commander', level: 2 },
      ]),
    }));
    await sharedCharacterListPage.loadButton.click();
    await expect(sharedCharacterListPage.characterItems).toHaveCount(2, { timeout: 10_000 });

    let editRequestCount = 0;
    sharedMock.on('character-edit-request', () => {
      editRequestCount += 1;
      return null;
    });

    await sharedCharacterListPage.editButton(0).click();
    await expect(sharedPage).toHaveURL(/right:character-bust-preview/, { timeout: 15_000 });

    await sharedCharacterSetupPage.fillCharacterName('  atlas   commander ');
    await sharedCharacterSetupPage.characterNameInput.blur();

    await expect(sharedCharacterSetupPage.submitButton).toBeDisabled();
    await expect(sharedCharacterSetupPage.fieldError).toContainText('Character name already exists. Choose a unique name.');
    expect(editRequestCount).toBe(0);
  });

  test('shows server-side edit error and stays on setup page', async () => {
    let editRequestCount = 0;
    sharedMock.on('character-edit-request', () => {
      editRequestCount += 1;
      return {
        event: 'character-edit-response',
        data: {
          success: false,
          message: 'Character name already exists.',
          playerName: TEST_PLAYER,
          characterId: 'char-edit-001',
        },
      };
    });

    await expect(sharedCharacterListPage.characterItems).toHaveCount(1);
    await sharedCharacterListPage.editButton(0).click();
    await expect(sharedPage).toHaveURL(/right:character-bust-preview/, { timeout: 15_000 });

    await sharedCharacterSetupPage.fillCharacterName('Zara Prime');
    await sharedCharacterSetupPage.clickSubmit();

    expect(editRequestCount).toBe(1);
    await expect(sharedCharacterSetupPage.errorMessage).toContainText('Character name already exists.');
    await expect(sharedCharacterSetupPage.successMessage).not.toBeVisible();
    await expect(sharedPage).toHaveURL(/left:character-setup/);
  });
});
