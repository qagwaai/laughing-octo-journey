import { expect } from '@playwright/test';
import { createJoinedGameTest } from '../fixtures/joined-game-fixture';
import { TEST_PLAYER } from '../helpers/auth-helper';
import {
  MARKET_HUB_CHARACTER,
  MARKET_HUB_SHIP_WITH_POSITION,
  openMarketHubWithDefaultData,
  registerSharedSessionHandlers,
  type MarketByLocationRequest,
} from '../fixtures/market-hub-by-location-scenario';
import { MarketHubPage } from '../page-objects/market-hub.page';

const test = createJoinedGameTest({
  registerSessionHandlers: registerSharedSessionHandlers,
  joinButtonText: 'Join Game in Progress',
});

let sharedMarketHubPage: MarketHubPage;

test.describe.configure({ mode: 'serial' });

test.beforeEach(async ({ sharedPage, prepareJoinedPage }) => {
  await prepareJoinedPage();
  sharedMarketHubPage = new MarketHubPage(sharedPage);
});

test.describe('Market Hub by-location contract', () => {
  test('emits by-location request and renders markets ordered by authoritative distance', async ({ sharedGameShell, sharedMock }) => {
    const requests: MarketByLocationRequest[] = [];
    await openMarketHubWithDefaultData(sharedGameShell, sharedMock, (request) => requests.push(request));

    await expect
      .poll(
        async () => {
          const marketHubRequest = requests.find((request) => request.limit === 50);
          if (!marketHubRequest) {
            await sharedMarketHubPage.reloadButton.click();
          }
          return marketHubRequest ?? null;
        },
        { timeout: 15_000 },
      )
      .not.toBeNull();

    const marketHubRequest = requests.find((request) => request.limit === 50);
    expect(marketHubRequest).toBeDefined();
    expect(marketHubRequest!.playerName).toBe(TEST_PLAYER);
    expect(marketHubRequest!.solarSystemId).toBe('sol');
    expect(marketHubRequest!.distanceAu).toBe(0.5);
    expect(marketHubRequest!.limit).toBe(50);
    expect(marketHubRequest!.locationTypes).toEqual(['station', 'free-floating']);
    expect(marketHubRequest!.characterId).toBe(MARKET_HUB_CHARACTER.id);
    expect(marketHubRequest!.shipId).toBe(MARKET_HUB_SHIP_WITH_POSITION.id);
    expect(marketHubRequest!.positionKm).toEqual({ x: 413_700_000, y: 10, z: -5 });

    const marketRows = sharedMarketHubPage.marketItems;
    await expect(marketRows).toHaveCount(2);
    await expect(marketRows.nth(0)).toContainText('Ceres Exchange');
    await expect(marketRows.nth(0)).toContainText('In-system');
    await expect(marketRows.nth(0)).toContainText('0.150 AU');
    await expect(marketRows.nth(0)).toContainText('about less than 1 hour at standard cruise');
    await expect(marketRows.nth(1)).toContainText('Far Exchange');
    await expect(marketRows.nth(1)).toContainText('In-system');
    await expect(marketRows.nth(1)).toContainText('0.350 AU');
  });
});
