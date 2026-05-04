import { test, expect, type Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';

// ── Shared test data ───────────────────────────────────────────────────────────

const MISSION_ID = 'first-target';

// Character with a started mission — join button reads "Join Game in Progress"
// which navigates directly to game-main, bypassing the opening-cold-boot sequence.
const CHARACTER_WITH_MISSION = {
  id: 'char-1',
  characterName: 'Nova-Prime',
  level: 5,
  missions: [{ missionId: MISSION_ID, status: 'started' }],
};

const SHIP = { id: 'd-1', name: 'Surveyor', model: 'Scavenger Pod', tier: 1, status: 'ACTIVE' };

function characterListResponse(characters: object[]) {
  return { success: true, message: '', playerName: TEST_PLAYER, characters };
}

// ── Helper ─────────────────────────────────────────────────────────────────────

async function setupAndNavigateToShipHangar(page: Page) {
  const mock = new SocketIOMock(page);
  await mock.setup();

  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: characterListResponse([CHARACTER_WITH_MISSION]),
  }));

  mock.on('game-join-request', () => null);

  // Ship-list loads in ship-hangar
  mock.on('ship-list-request', () => ({
    event: 'ship-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: CHARACTER_WITH_MISSION.id,
      ships: [SHIP],
    },
  }));

  await loginViaUI(page, mock);

  // Join in-progress game — goes directly to game-main
  await page.locator('.character-item button', { hasText: 'Join Game in Progress' }).click();
  await expect(page).toHaveURL(/left:game-main/, { timeout: 10_000 });

  // Navigate to ship-hangar via the left outlet
  await page.locator('button[aria-label="Ship Hangar"]').click();
  await expect(page).toHaveURL(/left:ship-hangar/, { timeout: 10_000 });

  return { mock };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

test.describe('Character ship badge', () => {
  test('ship badge defaults to "Scavenger Pod" when joining first-target in progress', async ({ page }) => {
    await setupAndNavigateToShipHangar(page);

    // first-target in-progress join seeds active ship to the starter pod
    const badgeName = page.locator('app-character-ship-badge .ship-badge-name');
    await expect(badgeName).toBeVisible({ timeout: 10_000 });
    await expect(badgeName).toHaveText('Scavenger Pod');
  });

  test('ship badge shows active ship name after clicking "Set as Active Ship"', async ({ page }) => {
    await setupAndNavigateToShipHangar(page);

    // Wait for ship list to populate (headed mode can be slower to render rows)
    await expect.poll(async () => page.locator('.ship-item').count(), { timeout: 20_000 }).toBeGreaterThan(0);
    await expect(page.locator('.ship-item').first()).toBeVisible({ timeout: 20_000 });

    // Click the "Set as Active Ship" button for the first ship row
    await page.locator('.ship-item').first().locator('button', { hasText: 'Set as Active Ship' }).click();

    // Badge should now reflect the chosen ship name
    const badgeName = page.locator('app-character-ship-badge .ship-badge-name');
    await expect(badgeName).toHaveText('Surveyor', { timeout: 10_000 });
  });
});
