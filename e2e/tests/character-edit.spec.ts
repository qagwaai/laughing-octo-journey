import { expect, test, type Page } from '@playwright/test';
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

async function setupCharacterEditTest(page: Page) {
  const mock = new SocketIOMock(page);
  await mock.setup();

  let currentCharacterName = 'Zara Voss';

  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: characterListResponse([{ id: 'char-edit-001', characterName: currentCharacterName, level: 5 }]),
  }));

  await loginViaUI(page, mock);

  return {
    mock,
    characterListPage: new CharacterListPage(page),
    characterSetupPage: new CharacterSetupPage(page),
    updateCharacterName: (name: string) => {
      currentCharacterName = name;
    },
  };
}

test.describe('Character Edit — setup save redirect', () => {
  test('redirects to character list and shows updated character after successful edit save', async ({ page }) => {
    const { mock, characterListPage, characterSetupPage, updateCharacterName } = await setupCharacterEditTest(page);

    let receivedEditRequest: Record<string, unknown> | null = null;
    let shipListRequestCount = 0;

    mock.on('character-edit-request', (request) => {
      receivedEditRequest = request as Record<string, unknown>;
      updateCharacterName('Zara Prime');
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

    mock.on('ship-list-by-owner-request', () => {
      shipListRequestCount += 1;
      return null;
    });

    await expect(characterListPage.characterItems).toHaveCount(1);
    await expect(characterListPage.characterName(0)).toHaveText('Zara Voss');

    await characterListPage.editButton(0).click();
    await expect(page).toHaveURL(/right:character-bust-preview/, { timeout: 15000 });

    await characterSetupPage.fillCharacterName('Zara Prime');
    await characterSetupPage.clickSubmit();

    await expect(page).toHaveURL(/left:character-list/);
    await expect(characterListPage.characterItems).toHaveCount(1);
    await expect(characterListPage.characterName(0)).toHaveText('Zara Prime');

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

  test('renders the 3D bust viewer in edit mode', async ({ page }) => {
    const { characterListPage, characterSetupPage } = await setupCharacterEditTest(page);

    await expect(characterListPage.characterItems).toHaveCount(1);
    await characterListPage.editButton(0).click();
    await expect(page).toHaveURL(/right:character-bust-preview/, { timeout: 15000 });

    await expect(characterSetupPage.bustViewer).toBeVisible();
    await expect(characterSetupPage.bustViewerAssetRoot).toContainText('src/assets/models/characters/busts/sw15/');
    await expect(characterSetupPage.bustViewerState).toContainText('Three-quarter');
  });

  test('blocks edit when renaming to another existing character name', async ({ page }) => {
    const mock = new SocketIOMock(page);
    await mock.setup();

    let editRequestCount = 0;
    mock.on('character-list-request', () => ({
      event: 'character-list-response',
      data: characterListResponse([
        { id: 'char-edit-001', characterName: 'Zara Voss', level: 5 },
        { id: 'char-other-002', characterName: 'Atlas Commander', level: 2 },
      ]),
    }));
    mock.on('character-edit-request', () => {
      editRequestCount += 1;
      return null;
    });

    await loginViaUI(page, mock);

    const characterListPage = new CharacterListPage(page);
    const characterSetupPage = new CharacterSetupPage(page);

    await expect(characterListPage.characterItems).toHaveCount(2);
    await characterListPage.editButton(0).click();
    await expect(page).toHaveURL(/right:character-bust-preview/, { timeout: 15000 });

    await characterSetupPage.fillCharacterName('  atlas   commander ');
    await characterSetupPage.characterNameInput.blur();

    await expect(characterSetupPage.submitButton).toBeDisabled();
    await expect(characterSetupPage.fieldError).toContainText('Character name already exists. Choose a unique name.');
    expect(editRequestCount).toBe(0);
  });
});
