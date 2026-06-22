import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
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

let sharedContext: BrowserContext;
let sharedPage: Page;
let sharedMock: SocketIOMock;
let sharedGameShell: GameShellPage;

function registerSharedSessionHandlers(): void {
  sharedMock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: characterListResponse([PROFILE_CHARACTER]),
  }));
  sharedMock.on('game-join-request', () => null);
  sharedMock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: shipListByOwnerResponse(),
  }));
}

test.describe.configure({ mode: 'serial', timeout: 60_000 });

test.beforeAll(async ({ browser }) => {
  sharedContext = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
  sharedPage = await sharedContext.newPage();
  sharedMock = new SocketIOMock(sharedPage);
  sharedGameShell = new GameShellPage(sharedPage);

  await sharedMock.setup();
  registerSharedSessionHandlers();

  await sharedPage.goto('http://localhost:4200/(left:character-list)');
  await sharedPage
    .waitForURL(/left:(character-list|login)/, { timeout: 15_000 })
    .catch(() => null);

  const loginFormInitiallyVisible = await sharedPage
    .locator('#playerName')
    .isVisible({ timeout: 1_000 })
    .catch(() => false);

  if (!sharedPage.url().includes('left:character-list') || loginFormInitiallyVisible) {
    await loginViaUI(sharedPage, sharedMock);
  }

  try {
    await expect(sharedPage).toHaveURL(/left:character-list/, { timeout: 10_000 });
  } catch {
    // Full-suite runs can briefly bounce back to login even after storageState hydrate.
    await loginViaUI(sharedPage, sharedMock);
    await expect(sharedPage).toHaveURL(/left:character-list/, { timeout: 10_000 });
  }

  const loginFormStillVisible = await sharedPage
    .locator('#playerName')
    .isVisible({ timeout: 1_000 })
    .catch(() => false);
  if (loginFormStillVisible) {
    await loginViaUI(sharedPage, sharedMock);
    await expect(sharedPage).toHaveURL(/left:character-list/, { timeout: 10_000 });
  }

  if ((await sharedPage.locator('.character-item').count()) === 0) {
    const loadButton = sharedPage.locator('.load-btn');
    const loadButtonVisible = (await loadButton.count()) > 0 && (await loadButton.first().isVisible());
    if (!loadButtonVisible) {
      throw new Error(`Character list is empty and load button is unavailable (url=${sharedPage.url()}).`);
    }

    await expect(loadButton.first()).toBeEnabled({ timeout: 5_000 });
    await loadButton.first().click();
    await expect(sharedPage.locator('.character-item')).toHaveCount(1, { timeout: 10_000 });
  }

  await sharedGameShell.joinGame('Join Game in Progress');
  await expect(sharedPage).toHaveURL(/left:game-main/, { timeout: 10_000 });
});

test.afterEach(async () => {
  if (!sharedPage || sharedPage.isClosed()) return;
  sharedMock.reset();
  registerSharedSessionHandlers();

  let attempts = 0;
  while (!sharedPage.url().includes('left:game-main') && attempts < 4) {
    attempts += 1;
    await sharedPage.goBack();
  }
  await expect(sharedPage).toHaveURL(/left:game-main/, { timeout: 10_000 });
});

test.afterAll(async () => {
  await sharedContext.close();
});

test.describe('Character Profile - portrait and attributes', () => {
  test('renders portrait image and read-only persisted attributes from character setup descriptor', async () => {
    sharedMock.on('character-bust-read-request', () => ({
      event: 'character-bust-read-response',
      data: characterBustReadResponse(),
    }));

    await sharedGameShell.openNav('Character Profile');
    await expect(sharedPage).toHaveURL(/left:character-profile/);

    await expect(sharedPage.locator('.page-main h1')).toHaveText('Character Profile');
    await expect(sharedPage.locator('.portrait-window')).toBeVisible();

    const portraitImage = sharedPage.locator('.portrait-window__image');
    await expect(portraitImage).toBeVisible();
    await expect(portraitImage).toHaveAttribute(
      'src',
      /oval__medium__short-crop__brown__almond__green__focused__collar__none__none__none\.jpeg/,
    );

    const attributesSection = sharedPage.locator('.attributes-section');
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

  test('shows loading state then resolves to portrait and attributes when bust read response arrives late', async () => {
    let capturedBustReadRequest: Record<string, unknown> | null = null;
    sharedMock.on('character-bust-read-request', (request) => {
      capturedBustReadRequest = request as Record<string, unknown>;
      return null;
    });

    await sharedGameShell.openNav('Character Profile');
    await expect(sharedPage).toHaveURL(/left:character-profile/);

    await expect(sharedPage.locator('.portrait-window__empty')).toContainText('Loading portrait descriptor...');

    await expect.poll(() => !!capturedBustReadRequest, { timeout: 5000 }).toBe(true);

    sharedMock.push('character-bust-read-response', {
      ...characterBustReadResponse(),
      correlationId: capturedBustReadRequest!['correlationId'] as string,
      requestIdentity: capturedBustReadRequest!['requestIdentity'] as Record<string, unknown>,
    });

    await expect(sharedPage.locator('.portrait-window__empty')).toHaveCount(0);
    await expect(sharedPage.locator('.portrait-window__image')).toBeVisible();
    await expect(sharedPage.locator('.attributes-section .attribute-row')).toHaveCount(12);
  });
});
