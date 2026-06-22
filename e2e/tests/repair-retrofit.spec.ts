import { expect } from '@playwright/test';
import { createJoinedGameTest } from '../fixtures/joined-game-fixture';
import { SocketIOMock } from '../fixtures/socket-mock';
import { TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';

const CHARACTER_ID = 'char-repair-e2e';

function registerRepairMockDefault(mock: SocketIOMock): void {
  configureRepairMock(mock, { usableShipSpatial: true });
}

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
          missions: [{ missionId: 'first-target', status: 'active' }],
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

const test = createJoinedGameTest({
  registerSessionHandlers: registerRepairMockDefault,
  joinButtonText: 'Join Game in Progress',
});

test.describe('Repair & Retrofit', () => {
  let gameShell: GameShellPage;

  test.beforeEach(async ({ sharedPage, prepareJoinedPage }) => {
    await prepareJoinedPage();
    gameShell = new GameShellPage(sharedPage);
  });

  async function openRepairPage(sharedPage: Parameters<typeof test>[0]['sharedPage']): Promise<void> {
    await gameShell.openNav('Repair & Retrofit');
    await expect(sharedPage).toHaveURL(/left:repair-retrofit/, { timeout: 10_000 });
  }

  test('opens repair details when ship context has usable spatial data', async ({ sharedPage }) => {
    await openRepairPage(sharedPage);

    const viewDetailsButton = sharedPage.getByRole('button', { name: 'View details' });
    await expect(viewDetailsButton).toBeVisible();
    await expect(viewDetailsButton).toBeEnabled();

    await viewDetailsButton.click();
    await expect(sharedPage).toHaveURL(/right:repair-retrofit-items/, { timeout: 10_000 });
    await expect(sharedPage.getByRole('heading', { name: 'Repair Items' })).toBeVisible();
  });

  test('shows hard-fail error and keeps detail action unavailable when no ship has usable spatial data', async ({
    sharedPage,
    sharedMock,
  }) => {
    // Override the ship-list handler for this test variation (don't reset — that breaks fixture state)
    configureRepairMock(sharedMock, { usableShipSpatial: false });

    await openRepairPage(sharedPage);

    await expect(sharedPage.getByText('No ship with usable spatial data is available.').first()).toBeVisible();
    await expect(sharedPage.getByRole('button', { name: /Active ship:/ })).toContainText('Repair Pod');
    await expect(sharedPage.getByRole('button', { name: 'View details' })).toHaveCount(0);
  });
});
