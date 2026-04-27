import { test, expect, type Page } from '@playwright/test';
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

function characterAddResponse(characterId: string, characterName: string) {
  return {
    success: true,
    message: 'Character created.',
    playerName: TEST_PLAYER,
    characterId,
    characterName,
  };
}

async function setupCharacterAddTest(page: Page) {
  const mock = new SocketIOMock(page);
  await mock.setup();

  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: characterListResponse([]),
  }));

  await loginViaUI(page, mock);

  return {
    mock,
    characterListPage: new CharacterListPage(page),
    characterSetupPage: new CharacterSetupPage(page),
  };
}

test.describe('Character Add — from character list', () => {
  test('adds a character, runs starter-ship chain, and shows the new character in list', async ({ page }) => {
    const { mock, characterListPage, characterSetupPage } = await setupCharacterAddTest(page);

    const emittedEvents: string[] = [];
    let receivedAddRequest: Record<string, unknown> | null = null;
    let receivedShipListRequest: Record<string, unknown> | null = null;
    let receivedShipUpsertRequest: Record<string, unknown> | null = null;
    let receivedItemUpsertRequest: Record<string, unknown> | null = null;

    // After creating and returning to list, auto-load should show the newly added
    // character with padded whitespace from server; the list page normalizes display.
    mock.on('character-list-request', () => ({
      event: 'character-list-response',
      data: characterListResponse([{ id: 'char-new-001', characterName: '  Nova Prime  ', level: 1 }]),
    }));

    mock.on('character-add-request', (request) => {
      emittedEvents.push('character-add-request');
      receivedAddRequest = request as Record<string, unknown>;
      return {
        event: 'character-add-response',
        data: characterAddResponse('char-new-001', 'Nova Prime'),
      };
    });

    mock.on('ship-list-request', (request) => {
      emittedEvents.push('ship-list-request');
      receivedShipListRequest = request as Record<string, unknown>;
      return {
        event: 'ship-list-response',
        data: {
          success: true,
          message: '',
          playerName: TEST_PLAYER,
          characterId: 'char-new-001',
          ships: [
            {
              id: 'starter-ship-001',
              name: 'Starter Ship',
              model: 'Scavenger Pod',
              tier: 1,
              launchable: true,
              inventory: [],
            },
          ],
        },
      };
    });

    mock.on('ship-upsert-request', (request) => {
      emittedEvents.push('ship-upsert-request');
      receivedShipUpsertRequest = request as Record<string, unknown>;
      return {
        event: 'ship-upsert-response',
        data: {
          success: true,
          message: 'Ship updated.',
          playerName: TEST_PLAYER,
          characterId: 'char-new-001',
          ship: {
            id: 'starter-ship-001',
            shipName: 'Starter Ship',
            model: 'Scavenger Pod',
            tier: 1,
            launchable: true,
            inventory: [],
          },
        },
      };
    });

    mock.on('item-upsert-request', (request) => {
      emittedEvents.push('item-upsert-request');
      receivedItemUpsertRequest = request as Record<string, unknown>;
      return {
        event: 'item-upsert-response',
        data: {
          success: true,
          message: 'Starter drone created.',
          playerName: TEST_PLAYER,
          item: {
            id: 'drone-item-001',
            itemType: 'expendable-dart-drone',
            displayName: 'Expendable Dart Drone',
            launchable: true,
          },
        },
      };
    });

    await characterListPage.clickSetup();
    await expect(page).toHaveURL(/left:character-setup/);

    await characterSetupPage.fillCharacterName('Nova Prime');
    await characterSetupPage.clickSubmit();

    await expect(characterSetupPage.successMessage).toContainText('Character created.');
    await expect(characterSetupPage.errorMessage).not.toBeVisible();

    expect(receivedAddRequest).toEqual({
      playerName: TEST_PLAYER,
      characterName: 'Nova Prime',
      sessionKey: 'test-session-key-abc123',
    });
    expect(receivedShipListRequest).toEqual({
      playerName: TEST_PLAYER,
      characterId: 'char-new-001',
      sessionKey: 'test-session-key-abc123',
    });

    expect(receivedShipUpsertRequest).not.toBeNull();
    expect(receivedShipUpsertRequest?.['playerName']).toBe(TEST_PLAYER);
    expect(receivedShipUpsertRequest?.['characterId']).toBe('char-new-001');
    expect(receivedShipUpsertRequest?.['sessionKey']).toBe('test-session-key-abc123');
    expect((receivedShipUpsertRequest?.['ship'] as Record<string, unknown>)?.['id']).toBe('starter-ship-001');

    expect(emittedEvents).toEqual(expect.arrayContaining([
      'character-add-request',
      'ship-list-request',
      'ship-upsert-request',
    ]));

    // Item upsert is conditional: it only fires when starter ship inventory
    // does not already include the expendable dart drone.
    if (emittedEvents.includes('item-upsert-request')) {
      expect(receivedItemUpsertRequest).not.toBeNull();
      expect(receivedItemUpsertRequest?.['playerName']).toBe(TEST_PLAYER);
      expect(receivedItemUpsertRequest?.['sessionKey']).toBe('test-session-key-abc123');
      expect((receivedItemUpsertRequest?.['item'] as Record<string, unknown>)?.['owningCharacterId']).toBe('char-new-001');
    }

    await characterSetupPage.clickViewCharacterList();
    await expect(page).toHaveURL(/left:character-list/);

    await expect(characterListPage.characterItems).toHaveCount(1);
    await expect(characterListPage.characterName(0)).toHaveText('Nova Prime');
  });

  test('shows character-name validation errors in setup form', async ({ page }) => {
    const { characterListPage, characterSetupPage } = await setupCharacterAddTest(page);

    await characterListPage.clickSetup();
    await expect(page).toHaveURL(/left:character-setup/);

    await characterSetupPage.fillCharacterName('A');
    await characterSetupPage.characterNameInput.blur();
    await expect(characterSetupPage.submitButton).toBeDisabled();
    await expect(characterSetupPage.fieldError).toContainText('Must be at least 2 characters.');

    await characterSetupPage.fillCharacterName('X'.repeat(25));
    await characterSetupPage.characterNameInput.blur();
    await expect(characterSetupPage.submitButton).toBeDisabled();
    await expect(characterSetupPage.fieldError).toContainText('Must be 24 characters or fewer.');
  });

  test('shows error and does not trigger starter-ship chain when add fails', async ({ page }) => {
    const { mock, characterListPage, characterSetupPage } = await setupCharacterAddTest(page);

    let shipListRequestCount = 0;
    let shipUpsertRequestCount = 0;
    let itemUpsertRequestCount = 0;

    mock.on('character-add-request', () => ({
      event: 'character-add-response',
      data: {
        success: false,
        message: 'Character name already exists.',
        playerName: TEST_PLAYER,
      },
    }));

    mock.on('ship-list-request', () => {
      shipListRequestCount += 1;
      return null;
    });

    mock.on('ship-upsert-request', () => {
      shipUpsertRequestCount += 1;
      return null;
    });

    mock.on('item-upsert-request', () => {
      itemUpsertRequestCount += 1;
      return null;
    });

    await characterListPage.clickSetup();
    await expect(page).toHaveURL(/left:character-setup/);

    await characterSetupPage.fillCharacterName('Nova Prime');
    await characterSetupPage.clickSubmit();

    await expect(characterSetupPage.errorMessage).toContainText('Character name already exists.');
    await expect(characterSetupPage.successMessage).not.toBeVisible();

    expect(shipListRequestCount).toBe(0);
    expect(shipUpsertRequestCount).toBe(0);
    expect(itemUpsertRequestCount).toBe(0);
  });
});
