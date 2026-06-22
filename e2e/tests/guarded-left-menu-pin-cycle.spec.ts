import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';

const FIRST_TARGET_MISSION_ID = 'first-target';

const characterWithStartedMission = {
  id: 'char-3',
  characterName: 'Scout Alpha',
  level: 2,
  missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' }],
};

function characterListResponse(characters: object[]) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    characters,
  };
}

let sharedContext: BrowserContext;
let sharedPage: Page;
let sharedMock: SocketIOMock;
let sharedGameShell: GameShellPage;

function registerSharedSessionHandlers(): void {
  sharedMock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: characterListResponse([characterWithStartedMission]),
  }));
  sharedMock.on('game-join-request', () => null);
  sharedMock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: 'char-3',
      ships: [
        {
          id: 'ship-1',
          name: 'Nomad',
          model: 'Scavenger Pod',
          tier: 1,
          status: 'ACTIVE',
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: { x: 350000000, y: 0, z: 10000000 },
            epochMs: 1715000000000,
          },
        },
      ],
    },
  }));
  sharedMock.on('list-missions-request', () => ({
    event: 'list-missions-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: 'char-3',
      missions: [
        {
          missionId: FIRST_TARGET_MISSION_ID,
          status: 'active',
          startedAt: '2026-04-01T10:00:00.000Z',
          updatedAt: '2026-04-02T10:00:00.000Z',
        },
      ],
    },
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

test.describe('Guarded Left Menu - pin cycle', () => {
  test('cycles unpinned to pinned to keep-mini and suppresses hover expansion in keep-mini', async () => {
    const opsMenu = sharedPage.locator('app-guarded-left-menu nav.ops-menu').first();
    const pinToggle = sharedPage.locator('app-guarded-left-menu .pin-toggle').first();
    const pinToggleLabel = sharedPage.locator('app-guarded-left-menu .pin-toggle .menu-label').first();

    await expect(opsMenu).toBeVisible();
    await expect(pinToggle).toBeVisible();

    await expect(pinToggleLabel).toHaveText('Pin Menu');
    await expect(opsMenu).not.toHaveClass(/is-expanded/);

    await opsMenu.hover();
    await expect(opsMenu).toHaveClass(/is-expanded/);

    await sharedPage.locator('body').hover();
    await expect(opsMenu).not.toHaveClass(/is-expanded/);

    await pinToggle.click();
    await expect(pinToggleLabel).toHaveText('Keep Mini');
    await expect(opsMenu).toHaveClass(/is-expanded/);

    await pinToggle.click();
    await expect(pinToggleLabel).toHaveText('Unpin Menu');
    await expect(opsMenu).toHaveClass(/is-keep-mini/);
    await expect(opsMenu).not.toHaveClass(/is-expanded/);

    await opsMenu.hover();
    await expect(opsMenu).not.toHaveClass(/is-expanded/);

    await pinToggle.click();
    await expect(pinToggleLabel).toHaveText('Pin Menu');
    await expect(opsMenu).not.toHaveClass(/is-expanded/);
  });

  test('keeps keep-mini mode after menu navigation clicks', async () => {
    const opsMenu = sharedPage.locator('app-guarded-left-menu nav.ops-menu').first();
    const pinToggle = sharedPage.locator('app-guarded-left-menu .pin-toggle').first();
    const pinToggleLabel = sharedPage.locator('app-guarded-left-menu .pin-toggle .menu-label').first();

    await expect(opsMenu).toBeVisible();
    await expect(pinToggle).toBeVisible();

    await pinToggle.click();
    await pinToggle.click();

    await expect(pinToggleLabel).toHaveText('Unpin Menu');
    await expect(opsMenu).toHaveClass(/is-keep-mini/);
    await expect(opsMenu).not.toHaveClass(/is-expanded/);

    await sharedPage.locator('app-guarded-left-menu button[aria-label="Market Hub"]').first().click();
    await expect(sharedPage).toHaveURL(/left:market-hub/, { timeout: 10_000 });

    await expect(pinToggleLabel).toHaveText('Unpin Menu');
    await expect(opsMenu).toHaveClass(/is-keep-mini/);
    await expect(opsMenu).not.toHaveClass(/is-expanded/);

    await sharedPage.locator('app-guarded-left-menu button[aria-label="Mission Board"]').first().click();
    await expect(sharedPage).toHaveURL(/right:mission-board/, { timeout: 10_000 });

    await expect(pinToggleLabel).toHaveText('Unpin Menu');
    await expect(opsMenu).toHaveClass(/is-keep-mini/);
    await expect(opsMenu).not.toHaveClass(/is-expanded/);
  });
});
