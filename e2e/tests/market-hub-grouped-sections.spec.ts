import { expect, test, type Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';

const CHARACTER = {
  id: 'char-market-grouped',
  characterName: 'Pathfinder',
  level: 2,
  missions: [{ missionId: 'first-target', status: 'started' }],
};

/** Standard-cruise drive: 0.5 AU range. Near Exchange (0.2 AU) is reachable;
 *  Distant Exchange (2.5 AU) exceeds that range and should appear only when
 *  the "show out-of-range" toggle is enabled. */
const SHIP = {
  id: `starter-pod-${CHARACTER.id}`,
  name: 'Scavenger Pod',
  model: 'Scavenger Pod',
  tier: 1,
  driveProfile: {
    id: 'standard-cruise',
    name: 'Standard Cruise Drive',
    rangeAu: 0.5,
    cruiseSpeedAuPerHour: 0.3,
    fuelCostPerAu: 1,
  },
  status: 'ACTIVE',
  spatial: {
    solarSystemId: 'sol',
    frame: 'barycentric',
    positionKm: { x: 413_700_000, y: 0, z: 0 },
    epochMs: 1_777_000_000_000,
  },
  motion: {
    velocityKmPerSec: { x: 0, y: 0, z: 0 },
    angularVelocityRadPerSec: { x: 0, y: 0, z: 0 },
  },
  observability: {
    sensorConfidence: 1,
    source: {
      solarSystemId: 'sol',
      sourceType: 'server-feed',
      observedAt: new Date(1_777_000_000_000).toISOString(),
    },
  },
};

const NEAR_MARKET = {
  marketId: 'sol-near-exchange',
  solarSystemId: 'sol',
  marketName: 'Near Exchange',
  siteType: 'station',
  siteName: 'Inner Belt Ring',
  spatial: {
    solarSystemId: 'sol',
    frame: 'barycentric',
    positionKm: { x: 413_729_950, y: 0, z: 0 },
    epochMs: Date.now(),
  },
  distanceAu: 0.2,
  isDocked: false,
  priceMultiplier: 1,
  driftPercentPerHour: 6,
  restockIntervalMinutes: 60,
};

const DISTANT_MARKET = {
  marketId: 'sol-distant-exchange',
  solarSystemId: 'sol',
  marketName: 'Distant Exchange',
  siteType: 'station',
  siteName: 'Outer Rim Hub',
  spatial: {
    solarSystemId: 'sol',
    frame: 'barycentric',
    positionKm: { x: 414_073_947, y: 0, z: 0 },
    epochMs: Date.now(),
  },
  distanceAu: 2.5,
  isDocked: false,
  priceMultiplier: 1.2,
  driftPercentPerHour: 8,
  restockIntervalMinutes: 120,
};

type MarketByLocationRequest = { distanceAu: number };

async function setupAndOpenMarketHub(page: Page) {
  const mock = new SocketIOMock(page);
  await mock.setup();

  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characters: [CHARACTER],
    },
  }));

  mock.on('game-join', () => null);

  mock.on('ship-list-request', () => ({
    event: 'ship-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: CHARACTER.id,
      ships: [SHIP],
    },
  }));

  mock.on('market-list-by-location-request', () => ({
    event: 'market-list-by-location-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      solarSystemId: 'sol',
      positionKm: SHIP.spatial.positionKm,
      locationTypes: ['station'],
      isDocked: false,
      dockedMarketId: null,
      markets: [NEAR_MARKET, DISTANT_MARKET],
    },
  }));

  await loginViaUI(page, mock);

  await page.locator('.character-item button', { hasText: 'Join Game in Progress' }).click();
  await expect(page).toHaveURL(/left:game-main/, { timeout: 10_000 });

  await page.locator('button[aria-label="Market Hub"]').click();
  await expect(page).toHaveURL(/left:market-hub/, { timeout: 10_000 });

  // Wait for at least one rendered market row before returning.
  await expect.poll(() => page.locator('.market-item').count(), { timeout: 15_000 }).toBeGreaterThan(0);
}

test.describe('Market Hub grouped sections', () => {
  test('shows reachable markets section by default with in-range markets only', async ({ page }) => {
    await setupAndOpenMarketHub(page);

    // Reachable section heading is visible.
    const reachableHeading = page.getByRole('heading', { name: 'Reachable Markets' });
    await reachableHeading.scrollIntoViewIfNeeded();
    await expect(reachableHeading).toBeVisible();

    // Near Exchange is within drive range — shown in the reachable section.
    const reachableItems = page.locator('.market-item');
    await expect(reachableItems).toHaveCount(1);
    await expect(reachableItems.nth(0)).toContainText('Near Exchange');
    await expect(reachableItems.nth(0)).toContainText('In-system');

    // Beyond Current Drive section heading must NOT be visible yet.
    await expect(page.getByRole('heading', { name: 'Beyond Current Drive' })).not.toBeVisible();

    // Distant Exchange must not be visible.
    await expect(page.getByRole('heading', { name: 'Distant Exchange' })).not.toBeVisible();
  });

  test('enabling the toggle reveals the Beyond Current Drive section', async ({ page }) => {
    await setupAndOpenMarketHub(page);

    // Toggle is unchecked by default.
    await expect(page.locator('#showOutOfRangeMarkets')).not.toBeChecked();

    // Enable the toggle.
    const toggleCheckbox = page.locator('#showOutOfRangeMarkets');
    await toggleCheckbox.scrollIntoViewIfNeeded();
    await toggleCheckbox.check();

    // Beyond Current Drive section heading appears.
    await expect(page.getByRole('heading', { name: 'Beyond Current Drive' })).toBeVisible({ timeout: 5_000 });

    // Distant Exchange now visible with Out of range badge.
    await expect(page.getByRole('heading', { name: 'Distant Exchange' })).toBeVisible();
    const outOfRangeItems = page.locator('.market-list').nth(1).locator('.market-item');
    await expect(outOfRangeItems).toHaveCount(1);
    await expect(outOfRangeItems.nth(0)).toContainText('Out of range');

    // Reachable section still shows Near Exchange.
    const reachableItems = page.locator('.market-list').nth(0).locator('.market-item');
    await expect(reachableItems).toHaveCount(1);
    await expect(reachableItems.nth(0)).toContainText('Near Exchange');
  });

  test('out-of-range market shows required drive upgrade info', async ({ page }) => {
    await setupAndOpenMarketHub(page);
    const toggleCheckbox = page.locator('#showOutOfRangeMarkets');
    await toggleCheckbox.scrollIntoViewIfNeeded();
    await toggleCheckbox.check();
    await expect(page.getByRole('heading', { name: 'Beyond Current Drive' })).toBeVisible({ timeout: 5_000 });

    const distantMarket = page.locator('.market-list').nth(1).locator('.market-item').nth(0);
    await expect(distantMarket).toContainText('Requires drive range upgrade.');
    await expect(distantMarket).toContainText('Rapid Transit Thruster');

    // Transact button must be disabled for the out-of-range market.
    await expect(distantMarket.locator('.transact-btn')).toBeDisabled();
  });

  test('sends selected radius to server without clamping to drive range', async ({ page }) => {
    const mock = new SocketIOMock(page);
    await mock.setup();

    const requests: MarketByLocationRequest[] = [];

    mock.on('character-list-request', () => ({
      event: 'character-list-response',
      data: { success: true, message: '', playerName: TEST_PLAYER, characters: [CHARACTER] },
    }));
    mock.on('game-join', () => null);
    mock.on('ship-list-request', () => ({
      event: 'ship-list-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        characterId: CHARACTER.id,
        ships: [SHIP],
      },
    }));
    mock.on('market-list-by-location-request', (payload) => {
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

    await loginViaUI(page, mock);
    await page.locator('.character-item button', { hasText: 'Join Game in Progress' }).click();
    await expect(page).toHaveURL(/left:game-main/, { timeout: 10_000 });
    await page.locator('button[aria-label="Market Hub"]').click();
    await expect(page).toHaveURL(/left:market-hub/, { timeout: 10_000 });

    // Wait for the initial request.
    await expect.poll(() => requests.length, { timeout: 15_000 }).toBeGreaterThan(0);
    expect(requests[0].distanceAu).toBe(0.5);

    // Select a radius of 5 AU — still within the toggle-off path, no clamping.
    await page.selectOption('#radiusAu', '5');
    await expect.poll(() => requests.length, { timeout: 10_000 }).toBeGreaterThan(1);
    expect(requests[requests.length - 1].distanceAu).toBe(5);

    // Enable the out-of-range toggle — should trigger the unlimited (1,000,000 AU) request.
    await page.locator('#showOutOfRangeMarkets').check();
    await expect.poll(() => requests.length, { timeout: 10_000 }).toBeGreaterThan(2);
    expect(requests[requests.length - 1].distanceAu).toBe(1_000_000);
  });
});
