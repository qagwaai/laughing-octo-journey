import { expect, test } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';

const CHARACTER_ID = 'char-repair-e2e';

function configureRepairMock(mock: SocketIOMock, options: { usableShipSpatial: boolean }): void {
  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characters: [
        {
          id: CHARACTER_ID,
          characterName: 'Repair Pilot',
          level: 3,
          missions: [{ missionId: 'first-target', status: 'started' }],
        },
      ],
    },
  }));

  mock.on('game-join-request', () => null);

  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: {
      success: true,
      message: '',
      owner: {
        ownerType: 'player-character',
        playerId: 'player-1',
        characterId: CHARACTER_ID,
        npcId: null,
        factionId: null,
      },
      ships: [
        {
          id: 'ship-repair-1',
          name: 'Repair Pod',
          model: 'Scavenger Pod',
          tier: 1,
          status: 'docked',
          inventory: [],
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: options.usableShipSpatial ? { x: 100, y: 0, z: 0 } : { x: 0, y: 0, z: 0 },
            epochMs: 0,
          },
        },
      ],
    },
  }));
}

async function loginAndOpenRepairPage(usableShipSpatial: boolean, page: Parameters<typeof test>[0]['page']) {
  const mock = new SocketIOMock(page);
  const gameShell = new GameShellPage(page);
  await mock.setup();
  configureRepairMock(mock, { usableShipSpatial });

  await loginViaUI(page, mock);
  await gameShell.joinGame('Join Game in Progress');
  await expect(page).toHaveURL(/left:game-main/, { timeout: 10_000 });

  await gameShell.openNav('Repair & Retrofit');
  await expect(page).toHaveURL(/left:repair-retrofit/, { timeout: 10_000 });
}

test.describe('Repair & Retrofit', () => {
  test('opens repair details when ship context has usable spatial data', async ({ page }) => {
    await loginAndOpenRepairPage(true, page);

    const viewDetailsButton = page.getByRole('button', { name: 'View details' });
    await expect(viewDetailsButton).toBeVisible();
    await expect(viewDetailsButton).toBeEnabled();

    await viewDetailsButton.click();
    await expect(page).toHaveURL(/right:repair-retrofit-items/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: 'Repair Items' })).toBeVisible();
  });

  test('shows hard-fail error and keeps detail action unavailable when no ship has usable spatial data', async ({ page }) => {
    await loginAndOpenRepairPage(false, page);

    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: 'No ship with usable spatial data is available.' })
        .first(),
    ).toHaveText('No ship with usable spatial data is available.');
    await expect(page.getByRole('button', { name: /Active ship:/ })).toContainText('No ship selected');
    await expect(page.getByRole('button', { name: 'View details' })).toHaveCount(0);
  });
});
