import { expect } from '@playwright/test';
import { createJoinedGameTest } from '../fixtures/joined-game-fixture';
import {
  configureRepairMock,
  openRepairRetrofitPage,
  registerRepairMockDefault,
} from '../fixtures/repair-retrofit-scenario';
import { GameShellPage } from '../page-objects/game-shell.page';

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

  test('opens repair details when ship context has usable spatial data', async ({ sharedPage }) => {
    await openRepairRetrofitPage(sharedPage, gameShell);

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

    await openRepairRetrofitPage(sharedPage, gameShell);

    await expect(sharedPage.getByText('No ship with usable spatial data is available.').first()).toBeVisible();
    await expect(sharedPage.getByRole('button', { name: /Active ship:/ })).toContainText('Repair Pod');
    await expect(sharedPage.getByRole('button', { name: 'View details' })).toHaveCount(0);
  });
});
