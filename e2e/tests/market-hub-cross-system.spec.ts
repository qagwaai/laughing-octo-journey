import { expect } from '@playwright/test';
import { createJoinedGameTest } from '../fixtures/joined-game-fixture';
import {
  registerDefaultMarketHandler,
  registerServerNoRouteOverrideHandler,
  registerSharedSessionHandlers,
  type MarketByLocationRequest,
} from '../fixtures/market-hub-cross-system-scenario';
import { SocketIOMock } from '../fixtures/socket-mock';
import { GameShellPage } from '../page-objects/game-shell.page';
import { MarketHubPage } from '../page-objects/market-hub.page';

let sharedMarketHubPage: MarketHubPage;

const test = createJoinedGameTest({
  registerSessionHandlers: registerSharedSessionHandlers,
  joinButtonText: 'Join Game in Progress',
});

async function openMarketHubWithDefaultData(
  sharedGameShell: GameShellPage,
  sharedMock: SocketIOMock,
  onRequest: (req: MarketByLocationRequest) => void,
) {
  sharedMock.reset();
  registerSharedSessionHandlers(sharedMock);
  registerDefaultMarketHandler(sharedMock, onRequest);

  await sharedGameShell.openMarketHub();
  await expect(sharedMarketHubPage.reachableHeading).toBeVisible({ timeout: 15_000 });
}

test.describe.configure({ mode: 'serial', timeout: 60_000 });

test.beforeEach(async ({ sharedPage, prepareJoinedPage }) => {
  await prepareJoinedPage();
  sharedMarketHubPage = new MarketHubPage(sharedPage);
});

test.describe('Market Hub cross-system route badges', () => {
  test.setTimeout(60_000);

  test('renders in-system, gate-route, and no-route badges correctly', async ({
    sharedGameShell,
    sharedMock,
  }) => {
    const requests: MarketByLocationRequest[] = [];
    await openMarketHubWithDefaultData(sharedGameShell, sharedMock, (req) => requests.push(req));

    const marketRows = sharedMarketHubPage.marketItems;
    await expect(marketRows).toHaveCount(3);

    const nearStation = marketRows.nth(0);
    await expect(nearStation).toContainText('Near Station');
    await expect(nearStation).toContainText('In-system');

    const alphaMarket = marketRows.nth(1);
    await expect(alphaMarket).toContainText('Alpha Station');
    await expect(alphaMarket).toContainText('1 gate hop');
    await expect(alphaMarket).toContainText('Alpha Station, 1 gate hop away');

    const barnardsMarket = marketRows.nth(2);
    await expect(barnardsMarket).toContainText("Barnard's Depot");
    await expect(barnardsMarket).toContainText('2 gate hops');
    await expect(barnardsMarket).toContainText("Barnard's Depot, 2 gate hops away");

    await sharedMarketHubPage.enableOutOfRangeMarkets();
    await expect(marketRows).toHaveCount(4, { timeout: 5_000 });
    const wolfMarket = marketRows.nth(3);
    await expect(wolfMarket).toContainText('Wolf-359 Outpost');
    await expect(wolfMarket).toContainText('No route');
    await expect(wolfMarket).toContainText('Wolf-359 Outpost, no known gate route');
  });

  test('gate-route markets have transact button disabled and no-route market is not transactable', async ({
    sharedGameShell,
    sharedMock,
  }) => {
    const requests: MarketByLocationRequest[] = [];
    await openMarketHubWithDefaultData(sharedGameShell, sharedMock, (req) => requests.push(req));

    const marketRows = sharedMarketHubPage.marketItems;

    await sharedMarketHubPage.enableOutOfRangeMarkets();
    await expect(marketRows).toHaveCount(4, { timeout: 5_000 });

    const alphaMarket = marketRows.nth(1);
    const barnardsMarket = marketRows.nth(2);
    const wolfMarket = marketRows.nth(3);

    await expect(alphaMarket.locator('.transact-btn')).toBeDisabled();
    await expect(barnardsMarket.locator('.transact-btn')).toBeDisabled();
    await expect(wolfMarket.locator('.transact-btn')).toBeDisabled();
  });

  test('server no-route overrides client BFS — alpha-centauri shows No route when server says so', async ({
    sharedGameShell,
    sharedMock,
  }) => {
    sharedMock.reset();
    registerSharedSessionHandlers(sharedMock);
    registerServerNoRouteOverrideHandler(sharedMock);

    await sharedGameShell.openMarketHub();
    await expect(sharedMarketHubPage.reachableHeading).toBeVisible({ timeout: 15_000 });

    await sharedMarketHubPage.enableOutOfRangeMarkets();
    await expect(sharedMarketHubPage.marketItems).toHaveCount(2, { timeout: 5_000 });

    const alphaMarket = sharedMarketHubPage.marketItems.nth(1);
    await expect(alphaMarket).toContainText('Alpha Station');
    await expect(alphaMarket).toContainText('No route');
    await expect(alphaMarket).not.toContainText('gate hop');
    await expect(alphaMarket.locator('.transact-btn')).toBeDisabled();
  });
});
