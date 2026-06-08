import { expect, test, type Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';

const FIRST_TARGET_MISSION_ID = 'first-target';

const PROFILE_CHARACTER = {
  id: 'char-profile-1',
  characterName: 'Profile Pilot',
  level: 4,
  missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' }],
};

const PROFILE_SHIP = {
  id: 'ship-profile-1',
  name: 'Pathfinder',
  model: 'Scavenger Pod',
  tier: 1,
  status: 'ACTIVE',
  spatial: {
    solarSystemId: 'sol',
    frame: 'barycentric',
    positionKm: { x: 1, y: 0, z: 0 },
    epochMs: 0,
  },
};

const PROFILE_DESCRIPTOR = {
  schemaVersion: 'sw-15-m1-v1',
  presetVersion: 'sw-15-m2-a-v1',
  faceShape: 'oval',
  skinTone: 'medium',
  hairStyle: 'short-crop',
  hairColor: 'brown',
  eyeStyle: 'almond',
  eyeColor: 'green',
  expressionPreset: 'focused',
  apparelAccent: 'collar',
  facialHair: 'none',
  scar: 'none',
  tattoo: 'none',
};

function characterListResponse(characters: object[]) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    characters,
  };
}

function shipListByOwnerResponse() {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    characterId: PROFILE_CHARACTER.id,
    owner: {
      ownerType: 'player-character',
      playerId: 'player-1',
      characterId: PROFILE_CHARACTER.id,
      npcId: null,
      factionId: null,
    },
    ships: [PROFILE_SHIP],
  };
}

function characterBustReadResponse() {
  return {
    success: true,
    message: 'Character bust retrieved successfully',
    playerName: TEST_PLAYER,
    characterId: PROFILE_CHARACTER.id,
    descriptor: PROFILE_DESCRIPTOR,
  };
}

async function setupCharacterProfileTest(page: Page, mode: 'immediate' | 'delayed' = 'immediate') {
  const mock = new SocketIOMock(page);
  await mock.setup();

  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: characterListResponse([PROFILE_CHARACTER]),
  }));

  mock.on('game-join-request', () => null);
  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: shipListByOwnerResponse(),
  }));

  let capturedBustReadRequest: Record<string, unknown> | null = null;
  if (mode === 'immediate') {
    mock.on('character-bust-read-request', () => ({
      event: 'character-bust-read-response',
      data: characterBustReadResponse(),
    }));
  } else {
    mock.on('character-bust-read-request', (request) => {
      capturedBustReadRequest = request as Record<string, unknown>;
      return null;
    });
  }

  await loginViaUI(page, mock);

  const gameShell = new GameShellPage(page);
  await gameShell.joinGame('Join Game in Progress');
  await expect(page).toHaveURL(/left:game-main/);

  await gameShell.openNav('Character Profile');
  await expect(page).toHaveURL(/left:character-profile/);

  return { mock, capturedBustReadRequestRef: () => capturedBustReadRequest };
}

test.describe('Character Profile - portrait and attributes', () => {
  test('renders portrait image and read-only persisted attributes from character setup descriptor', async ({ page }) => {
    await setupCharacterProfileTest(page, 'immediate');

    await expect(page.locator('.page-main h1')).toHaveText('Character Profile');
    await expect(page.locator('.portrait-window')).toBeVisible();

    const portraitImage = page.locator('.portrait-window__image');
    await expect(portraitImage).toBeVisible();
    await expect(portraitImage).toHaveAttribute(
      'src',
      /oval__medium__short-crop__brown__almond__green__focused__collar__none__none__none\.jpeg/,
    );

    const attributesSection = page.locator('.attributes-section');
    await expect(attributesSection).toContainText('Profile Attributes');
    await expect(attributesSection.locator('.attribute-row')).toHaveCount(12);
    await expect(attributesSection).toContainText('Preset Version');
    await expect(attributesSection).toContainText('sw-15-m2-a-v1');
    await expect(attributesSection).toContainText('Face Shape');
    await expect(attributesSection).toContainText('oval');
    await expect(attributesSection).toContainText('Expression');
    await expect(attributesSection).toContainText('focused');

    await expect(attributesSection.locator('input, select, textarea, button')).toHaveCount(0);
  });

  test('shows loading state then resolves to portrait and attributes when bust read response arrives late', async ({ page }) => {
    const { mock, capturedBustReadRequestRef } = await setupCharacterProfileTest(page, 'delayed');

    await expect(page.locator('.portrait-window__empty')).toContainText('Loading portrait descriptor...');

    await expect.poll(() => !!capturedBustReadRequestRef(), { timeout: 5000 }).toBe(true);
    const request = capturedBustReadRequestRef()!;

    mock.push('character-bust-read-response', {
      ...characterBustReadResponse(),
      correlationId: request['correlationId'] as string,
      requestIdentity: request['requestIdentity'] as Record<string, unknown>,
    });

    await expect(page.locator('.portrait-window__empty')).toHaveCount(0);
    await expect(page.locator('.portrait-window__image')).toBeVisible();
    await expect(page.locator('.attributes-section .attribute-row')).toHaveCount(12);
  });
});
