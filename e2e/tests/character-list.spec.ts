import { expect, test, type Page } from '@playwright/test';
import {
  characterListResponse,
  emptyCharacterListResponse,
  setupCharacterListTest,
} from '../fixtures/character-list-scenario';
import { TEST_PLAYER } from '../helpers/auth-helper';

// ── Shared test data ───────────────────────────────────────────────────────────

const FIRST_TARGET_MISSION_ID = 'first-target';

const twoCharacters = [
  { id: 'char-1', characterName: 'Zara Voss', level: 5 },
  { id: 'char-2', characterName: 'Commander Rex', level: 3 },
];

const characterWithStartedMission = {
  id: 'char-3',
  characterName: 'Scout Alpha',
  level: 2,
  missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' }],
};

const characterWithCompletedMission = {
  id: 'char-4',
  characterName: 'Survey Veteran',
  level: 8,
  missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'completed' }],
};

const characterWithFailedMission = {
  id: 'char-5',
  characterName: 'Damaged Relay',
  level: 7,
  missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'failed' }],
};

const characterWithAbandonedMission = {
  id: 'char-6',
  characterName: 'Lost Beacon',
  level: 6,
  missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'abandoned' }],
};

function characterDeleteResponse(characterId: string) {
  return {
    success: true,
    message: 'Character deleted.',
    playerName: TEST_PLAYER,
    characterId,
  };
}

// ── Tests: page structure ──────────────────────────────────────────────────────

test.describe('Character List — page structure', () => {
  test('renders heading and subtitle', async ({ page }) => {
    const { characterListPage } = await setupCharacterListTest(page);

    await expect(characterListPage.heading).toHaveText('Character List');
    await expect(characterListPage.subtitle).toHaveText('Review characters created for your player profile.');
  });

  test('shows logged-in player name', async ({ page }) => {
    const { characterListPage } = await setupCharacterListTest(page);

    await expect(characterListPage.playerNameDisplay).toContainText(TEST_PLAYER);
  });

  test('renders Load Characters and Create / Edit Character buttons', async ({ page }) => {
    const { characterListPage } = await setupCharacterListTest(page);

    await expect(characterListPage.loadButton).toBeVisible();
    await expect(characterListPage.setupButton).toBeVisible();
    await expect(characterListPage.setupButton).toHaveText('Create / Edit Character');
  });
});

// ── Tests: loading characters ──────────────────────────────────────────────────

test.describe('Character List — loading characters', () => {
  test('shows empty state when no characters exist', async ({ page }) => {
    const { characterListPage } = await setupCharacterListTest(page, {
      autoLoadResponse: [],
    });

    // Wait for the auto-load to complete
    await expect(characterListPage.emptyState).toBeVisible();
    await expect(characterListPage.emptyState).toHaveText('No characters loaded yet.');
  });

  test('renders character names from the server response', async ({ page }) => {
    const { characterListPage } = await setupCharacterListTest(page, {
      autoLoadResponse: twoCharacters,
    });

    await expect(characterListPage.characterItems).toHaveCount(2);
    await expect(characterListPage.characterName(0)).toHaveText('Zara Voss');
    await expect(characterListPage.characterName(1)).toHaveText('Commander Rex');
  });

  test('renders character level when present', async ({ page }) => {
    const { characterListPage } = await setupCharacterListTest(page, {
      autoLoadResponse: twoCharacters,
    });

    await expect(characterListPage.characterMeta(0)).toContainText('5');
    await expect(characterListPage.characterMeta(1)).toContainText('3');
  });

  test('shows error message when load fails', async ({ page }) => {
    const { mock, characterListPage } = await setupCharacterListTest(page, {
      autoLoadResponse: null, // disable auto-load handler
    });

    mock.on('character-list-request', () => ({
      event: 'character-list-response',
      data: {
        success: false,
        message: 'Session expired. Please log in again.',
        playerName: TEST_PLAYER,
        characters: [],
      },
    }));

    await characterListPage.clickLoad();

    await expect(characterListPage.errorMessage).toBeVisible();
    await expect(characterListPage.errorMessage).toContainText('Session expired');
  });

  test('load button is disabled while loading', async ({ page }) => {
    const { mock, characterListPage } = await setupCharacterListTest(page, {
      autoLoadResponse: null, // disable auto-load handler so we control the timing
    });

    // Hold the response until after disabled-state assertions.
    mock.on('character-list-request', () => null);

    await characterListPage.clickLoad();

    // The button text changes to "Loading..." while the request is in flight
    await expect(characterListPage.loadButton).toHaveText('Loading...');
    await expect(characterListPage.loadButton).toBeDisabled();

    // Release the request and verify button recovers
    mock.push('character-list-response', emptyCharacterListResponse());
    await expect(characterListPage.loadButton).toHaveText('Load Characters');
    await expect(characterListPage.loadButton).toBeEnabled();
  });

  test('reloading replaces existing character list', async ({ page }) => {
    const { mock, characterListPage } = await setupCharacterListTest(page, {
      autoLoadResponse: twoCharacters,
    });

    await expect(characterListPage.characterItems).toHaveCount(2);

    // Hold the next request so the replacement payload is delivered deterministically.
    mock.on('character-list-request', () => null);

    await characterListPage.clickLoad();

    mock.push(
      'character-list-response',
      characterListResponse([{ id: 'char-99', characterName: 'New Recruit', level: 1 }]),
    );

    await expect(characterListPage.characterItems).toHaveCount(1);
    await expect(characterListPage.characterName(0)).toHaveText('New Recruit');
  });
});

// ── Tests: join game label ─────────────────────────────────────────────────────

test.describe('Character List — join game label', () => {
  test('shows "Join Game" for characters without a started mission', async ({ page }) => {
    const { characterListPage } = await setupCharacterListTest(page, {
      autoLoadResponse: twoCharacters,
    });

    await expect(characterListPage.joinButton(0)).toHaveText('Join Game');
    await expect(characterListPage.joinButton(1)).toHaveText('Join Game');
  });

  test('shows "Join Game in Progress" for characters with a started mission', async ({ page }) => {
    const { characterListPage } = await setupCharacterListTest(page, {
      autoLoadResponse: [characterWithStartedMission],
    });

    await expect(characterListPage.joinButton(0)).toHaveText('Join Game in Progress');
  });

  test('shows "Join Game in Progress" for characters with a completed first-target mission', async ({ page }) => {
    const { characterListPage } = await setupCharacterListTest(page, {
      autoLoadResponse: [characterWithCompletedMission],
    });

    await expect(characterListPage.joinButton(0)).toHaveText('Join Game in Progress');
  });

  test('shows "Join Game in Progress" for characters with a failed first-target mission', async ({ page }) => {
    const { characterListPage } = await setupCharacterListTest(page, {
      autoLoadResponse: [characterWithFailedMission],
    });

    await expect(characterListPage.joinButton(0)).toHaveText('Join Game in Progress');
  });

  test('shows "Join Game in Progress" for characters with an abandoned first-target mission', async ({ page }) => {
    const { characterListPage } = await setupCharacterListTest(page, {
      autoLoadResponse: [characterWithAbandonedMission],
    });

    await expect(characterListPage.joinButton(0)).toHaveText('Join Game in Progress');
  });
});

// ── Tests: delete dialog ───────────────────────────────────────────────────────

test.describe('Character List — delete dialog', () => {
  test('opens delete dialog on delete button click', async ({ page }) => {
    const { characterListPage } = await setupCharacterListTest(page, {
      autoLoadResponse: twoCharacters,
    });

    await expect(characterListPage.deleteDialog).not.toBeVisible();

    await characterListPage.clickDelete(0);

    await expect(characterListPage.deleteDialog).toBeVisible();
    await expect(characterListPage.deleteDialogTitle).toHaveText('Delete Character');
  });

  test('delete dialog shows character name in confirmation text', async ({ page }) => {
    const { characterListPage } = await setupCharacterListTest(page, {
      autoLoadResponse: twoCharacters,
    });

    await characterListPage.clickDelete(0);

    await expect(characterListPage.deleteDialogPanel).toContainText('Zara Voss');
  });

  test('cancel closes the delete dialog without removing the character', async ({ page }) => {
    const { characterListPage } = await setupCharacterListTest(page, {
      autoLoadResponse: twoCharacters,
    });

    await characterListPage.clickDelete(0);
    await expect(characterListPage.deleteDialog).toBeVisible();

    await characterListPage.clickCancelDelete();

    await expect(characterListPage.deleteDialog).not.toBeVisible();
    await expect(characterListPage.characterItems).toHaveCount(2);
  });

  test('confirms delete and removes the character from the list', async ({ page }) => {
    const { mock, characterListPage } = await setupCharacterListTest(page, {
      autoLoadResponse: twoCharacters,
    });

    mock.on('character-delete-request', () => ({
      event: 'character-delete-response',
      data: characterDeleteResponse('char-1'),
    }));

    await characterListPage.clickDelete(0);
    await characterListPage.clickConfirmDelete();

    await expect(characterListPage.deleteDialog).not.toBeVisible();
    await expect(characterListPage.characterItems).toHaveCount(1);
    await expect(characterListPage.characterName(0)).toHaveText('Commander Rex');
  });

  test('confirm delete button is disabled while deletion is in progress', async ({ page }) => {
    const { mock, characterListPage } = await setupCharacterListTest(page, {
      autoLoadResponse: twoCharacters,
    });

    // Hold the delete response so we can assert in-flight UI state first.
    mock.on('character-delete-request', () => null);

    await characterListPage.clickDelete(0);
    await characterListPage.clickConfirmDelete();

    await expect(characterListPage.confirmDeleteButton).toHaveText('Deleting...');
    await expect(characterListPage.confirmDeleteButton).toBeDisabled();
    await expect(characterListPage.cancelDeleteButton).toBeDisabled();

    mock.push('character-delete-response', characterDeleteResponse('char-1'));
    await expect(characterListPage.deleteDialog).not.toBeVisible();
  });

  test('shows error and keeps dialog closed when delete fails', async ({ page }) => {
    const { mock, characterListPage } = await setupCharacterListTest(page, {
      autoLoadResponse: twoCharacters,
    });

    mock.on('character-delete-request', () => ({
      event: 'character-delete-response',
      data: {
        success: false,
        message: 'Character not found.',
        playerName: TEST_PLAYER,
      },
    }));

    await characterListPage.clickDelete(0);
    await characterListPage.clickConfirmDelete();

    await expect(characterListPage.errorMessage).toContainText('Character not found');
    // Character list is unchanged
    await expect(characterListPage.characterItems).toHaveCount(2);
  });
});

// ── Tests: navigation ──────────────────────────────────────────────────────────

test.describe('Character List — navigation', () => {
  test('navigates to character setup on "Create / Edit Character" click', async ({ page }) => {
    const { characterListPage } = await setupCharacterListTest(page);

    await characterListPage.clickSetup();

    await expect(page).toHaveURL(/left:character-setup/);
  });

  test('navigates to character setup on "Edit" button click', async ({ page }) => {
    const { characterListPage } = await setupCharacterListTest(page, {
      autoLoadResponse: twoCharacters,
    });

    await characterListPage.editButton(0).click();

    await expect(page).toHaveURL(/left:character-setup/);
  });

  test('routes completed first-target join to game-main and mission-board', async ({ page }) => {
    const { characterListPage } = await setupCharacterListTest(page, {
      autoLoadResponse: [characterWithCompletedMission],
    });

    await characterListPage.joinButton(0).click();

    await expect(page).toHaveURL(/left:game-main/);
    await expect(page).toHaveURL(/right:mission-board/);
  });
});
