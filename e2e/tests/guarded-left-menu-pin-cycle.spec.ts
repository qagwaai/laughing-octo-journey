import { expect, test, type Page } from '@playwright/test';
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

async function setupGuardedMenuTest(page: Page) {
  const mock = new SocketIOMock(page);
  await mock.setup();

  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: characterListResponse([characterWithStartedMission]),
  }));

  mock.on('game-join-request', () => null);

  mock.on('ship-list-by-owner-request', () => ({
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

  mock.on('list-missions-request', () => ({
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

  await loginViaUI(page, mock);

  const gameShell = new GameShellPage(page);
  await gameShell.joinGame('Join Game in Progress');
  await expect(page).toHaveURL(/left:game-main/, { timeout: 10_000 });

  const opsMenu = page.locator('app-guarded-left-menu nav.ops-menu').first();
  const pinToggle = page.locator('app-guarded-left-menu .pin-toggle').first();
  const pinToggleLabel = page.locator('app-guarded-left-menu .pin-toggle .menu-label').first();

  await expect(opsMenu).toBeVisible();
  await expect(pinToggle).toBeVisible();

  return { mock, gameShell, opsMenu, pinToggle, pinToggleLabel };
}

test.describe('Guarded Left Menu - pin cycle', () => {
  test('cycles unpinned to pinned to keep-mini and suppresses hover expansion in keep-mini', async ({ page }) => {
    const { opsMenu, pinToggle, pinToggleLabel } = await setupGuardedMenuTest(page);

    await expect(pinToggleLabel).toHaveText('Pin Menu');
    await expect(opsMenu).not.toHaveClass(/is-expanded/);

    await opsMenu.hover();
    await expect(opsMenu).toHaveClass(/is-expanded/);

    await page.locator('body').hover();
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

  test('keeps keep-mini mode after menu navigation clicks', async ({ page }) => {
    const { opsMenu, pinToggle, pinToggleLabel } = await setupGuardedMenuTest(page);

    await pinToggle.click();
    await pinToggle.click();

    await expect(pinToggleLabel).toHaveText('Unpin Menu');
    await expect(opsMenu).toHaveClass(/is-keep-mini/);
    await expect(opsMenu).not.toHaveClass(/is-expanded/);

    await page.locator('app-guarded-left-menu button[aria-label="Market Hub"]').first().click();
    await expect(page).toHaveURL(/left:market-hub/, { timeout: 10_000 });

    await expect(pinToggleLabel).toHaveText('Unpin Menu');
    await expect(opsMenu).toHaveClass(/is-keep-mini/);
    await expect(opsMenu).not.toHaveClass(/is-expanded/);

    await page.locator('app-guarded-left-menu button[aria-label="Mission Board"]').first().click();
    await expect(page).toHaveURL(/right:mission-board/, { timeout: 10_000 });

    await expect(pinToggleLabel).toHaveText('Unpin Menu');
    await expect(opsMenu).toHaveClass(/is-keep-mini/);
    await expect(opsMenu).not.toHaveClass(/is-expanded/);
  });
});
