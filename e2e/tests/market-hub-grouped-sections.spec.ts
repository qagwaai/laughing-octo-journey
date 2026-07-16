import { expect } from '@playwright/test';
import { createJoinedGameTest } from '../fixtures/joined-game-fixture';
import {
  getDefaultGroupedMarkets,
  openMarketHubWithDefaultData,
  registerSessionHandlers,
  type MarketByLocationRequest,
} from '../fixtures/market-hub-grouped-sections-scenario';
import { MarketHubPage } from '../page-objects/market-hub.page';

const { nearMarket: NEAR_MARKET, distantMarket: DISTANT_MARKET, ship: SHIP } = getDefaultGroupedMarkets();

let sharedMarketHubPage: MarketHubPage;

const test = createJoinedGameTest({
  registerSessionHandlers,
  joinButtonText: 'Join Game in Progress',
});

test.describe.configure({ mode: 'serial', timeout: 60_000 });

test.beforeEach(async ({ sharedPage, prepareJoinedPage }) => {
  await prepareJoinedPage();
  sharedMarketHubPage = new MarketHubPage(sharedPage);
});

test.describe('Market Hub grouped sections', () => {
  test('shows reachable markets section by default with in-range markets only', async ({
    sharedGameShell,
    sharedMock,
    sharedPage,
  }) => {
    await openMarketHubWithDefaultData(sharedGameShell, sharedMock, sharedMarketHubPage);

    const reachableHeading = sharedMarketHubPage.reachableHeading;
    await reachableHeading.scrollIntoViewIfNeeded();
    await expect(reachableHeading).toBeVisible();

    const reachableItems = sharedMarketHubPage.marketItems;
    await sharedMarketHubPage.waitForMarketItemCount(1);
    await expect(reachableItems.nth(0)).toContainText('Near Exchange');
    await expect(reachableItems.nth(0)).toContainText('In-system');

    await expect(sharedMarketHubPage.beyondCurrentDriveHeading).not.toBeVisible();
    await expect(sharedPage.getByRole('heading', { name: 'Distant Exchange' })).not.toBeVisible();
  });

  test('enabling the toggle reveals the Beyond Current Drive section', async ({
    sharedGameShell,
    sharedMock,
    sharedPage,
  }) => {
    await openMarketHubWithDefaultData(sharedGameShell, sharedMock, sharedMarketHubPage);

    await expect(sharedMarketHubPage.showOutOfRangeToggle).not.toBeChecked();
    await sharedMarketHubPage.enableOutOfRangeMarkets();

    await expect(sharedMarketHubPage.beyondCurrentDriveHeading).toBeVisible({ timeout: 5_000 });

    await expect(sharedPage.getByRole('heading', { name: 'Distant Exchange' })).toBeVisible();
    const outOfRangeItems = sharedMarketHubPage.marketList(1).locator('.market-item');
    await sharedMarketHubPage.waitForMarketItemCount(2);
    await expect(outOfRangeItems).toHaveCount(1);
    await expect(outOfRangeItems.nth(0)).toContainText('Out of range');

    const reachableItems = sharedMarketHubPage.marketList(0).locator('.market-item');
    await sharedMarketHubPage.waitForMarketItemCount(2);
    await expect(reachableItems).toHaveCount(1);
    await expect(reachableItems.nth(0)).toContainText('Near Exchange');
  });

  test('out-of-range market shows required drive upgrade info', async ({ sharedGameShell, sharedMock }) => {
    await openMarketHubWithDefaultData(sharedGameShell, sharedMock, sharedMarketHubPage);

    await sharedMarketHubPage.enableOutOfRangeMarkets();
    await expect(sharedMarketHubPage.beyondCurrentDriveHeading).toBeVisible({ timeout: 5_000 });

    const distantMarket = sharedMarketHubPage.marketItemInList(1, 0);
    await expect(distantMarket).toContainText('Requires drive range upgrade.');
    await expect(distantMarket).toContainText('Rapid Transit Thruster');
    await expect(distantMarket.locator('.transact-btn')).toBeDisabled();
  });

  test('sends selected radius to server without clamping to drive range', async ({
    sharedGameShell,
    sharedMock,
    sharedPage,
  }) => {
    const requests: MarketByLocationRequest[] = [];

    sharedMock.reset();
    registerSessionHandlers(sharedMock);
    sharedMock.on('market-list-by-location-request', (payload) => {
      requests.push(payload as MarketByLocationRequest);
      return {
        event: 'market-list-by-location-response',
        data: {
          success: true,
          message: '',
          isDocked: false,
          dockedMarketId: null,
          markets: [NEAR_MARKET, DISTANT_MARKET],
        },
      };
    });

    await sharedGameShell.openMarketHub();

    await expect
      .poll(() => requests.some((request) => request.distanceAu === 0.5), { timeout: 15_000 })
      .toBe(true);

    const requestsBeforeRadiusChange = requests.length;
    await sharedPage.selectOption('#radiusAu', '5');
    await expect
      .poll(
        () => requests.slice(requestsBeforeRadiusChange).some((request) => request.distanceAu === 5),
        { timeout: 10_000 },
      )
      .toBe(true);

    const requestsBeforeToggle = requests.length;
    await sharedMarketHubPage.showOutOfRangeToggle.check();
    await expect
      .poll(
        () => requests.slice(requestsBeforeToggle).some((request) => request.distanceAu === 1_000_000),
        { timeout: 10_000 },
      )
      .toBe(true);
  });
});
