import { expect } from '@playwright/test';
import { createJoinedGameTest } from '../fixtures/joined-game-fixture';
import {
  registerCrossSystemMarketHandler,
  registerDefaultMarketHandler,
  registerSharedSessionHandlers,
  setupAndOpenMarketHub,
  type MarketByLocationRequest,
} from '../fixtures/market-hub-docking-scenario';
import { MarketHubPage } from '../page-objects/market-hub.page';

let sharedMarketHubPage: MarketHubPage;

const test = createJoinedGameTest({
  registerSessionHandlers: registerSharedSessionHandlers,
  joinButtonText: 'Join Game in Progress',
});

test.describe.configure({ mode: 'serial', timeout: 60_000 });

test.beforeEach(async ({ sharedPage, prepareJoinedPage }) => {
  await prepareJoinedPage();
  sharedMarketHubPage = new MarketHubPage(sharedPage);
});

test.describe('Market Hub docking and radius behavior', () => {
  test('shows in-system route badge for local non-docked market', async ({ sharedGameShell, sharedMock }) => {
    const requests: MarketByLocationRequest[] = [];
    await setupAndOpenMarketHub(sharedGameShell, sharedMock, (mock) => registerDefaultMarketHandler(mock, (request) => requests.push(request)));

    await expect
      .poll(
        async () => {
          if (requests.length === 0) {
            await sharedMarketHubPage.reloadButton.click();
          }
          return requests.length;
        },
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);

    const marketRows = sharedMarketHubPage.marketItems;
    const remoteMarket = marketRows.nth(1);

    await expect(remoteMarket).toContainText('Remote Market');
    await expect(remoteMarket).toContainText('In-system');
  });

  test('docked cross-system market: gate-route badge shown, transact disabled when not docked there', async ({
    sharedGameShell,
    sharedMock,
  }) => {
    sharedMock.reset();
    registerSharedSessionHandlers(sharedMock);
    registerCrossSystemMarketHandler(sharedMock);

    await sharedGameShell.openMarketHub();

    await expect
      .poll(
        async () => {
          const count = await sharedMarketHubPage.marketItems.count();
          if (count === 0) {
            await sharedMarketHubPage.reloadButton.click();
          }
          return count;
        },
        { timeout: 15_000 },
      )
      .toBe(2);

    const marketRows = sharedMarketHubPage.marketItems;

    const dockedMarket = marketRows.nth(0);
    await expect(dockedMarket).toContainText('Ceres Exchange');
    await expect(dockedMarket).toContainText('In-system');
    await expect(dockedMarket.locator('.transact-btn')).toBeEnabled();

    const crossSystemMarket = marketRows.nth(1);
    await expect(crossSystemMarket).toContainText('Alpha Station');
    await expect(crossSystemMarket).toContainText('1 gate hop');
    await expect(crossSystemMarket.locator('.transact-btn')).toBeDisabled();
  });

  test('enables transact only for docked market and refreshes with selected radius', async ({
    sharedGameShell,
    sharedMock,
    sharedPage,
  }) => {
    const requests: MarketByLocationRequest[] = [];
    await setupAndOpenMarketHub(sharedGameShell, sharedMock, (mock) => registerDefaultMarketHandler(mock, (request) => requests.push(request)));

    await expect
      .poll(
        async () => {
          if (requests.length === 0) {
            await sharedMarketHubPage.reloadButton.click();
          }
          return requests.length;
        },
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0);

    const marketRows = sharedMarketHubPage.marketItems;
    await expect(marketRows).toHaveCount(2);

    const dockedMarket = marketRows.nth(0);
    const remoteMarket = marketRows.nth(1);

    await expect(dockedMarket).toContainText('Ceres Exchange');
    await expect(remoteMarket).toContainText('Remote Market');
    await expect(remoteMarket).toContainText('In-system');

    await expect(dockedMarket.locator('.transact-btn')).toBeEnabled();
    await expect(remoteMarket.locator('.transact-btn')).toBeDisabled();
    await expect(remoteMarket.locator('.dock-required-badge', { hasText: 'Dock required' })).toBeVisible();
    await expect(sharedPage.getByText('Rapid Transit Thruster').first()).toBeVisible();

    await sharedPage.selectOption('#radiusAu', '1');
    const applyRadiusButton = sharedPage.getByRole('button', { name: /apply radius/i });
    if ((await applyRadiusButton.count()) > 0) {
      await applyRadiusButton.click();
    }

    await expect
      .poll(() => requests.some((request) => request.distanceAu === 1), { timeout: 10_000 })
      .toBe(true);
  });
});