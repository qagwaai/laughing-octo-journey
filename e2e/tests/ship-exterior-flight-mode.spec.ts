import { expect, test, type Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';

const FIRST_TARGET_MISSION_ID = 'first-target';
const TEST_CHARACTER_ID = 'char-flight-smoke';

function configureFlightModeMock(mock: SocketIOMock): void {
  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characters: [
        {
          id: TEST_CHARACTER_ID,
          characterName: 'Flight Pilot',
          level: 2,
          missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'started' }],
        },
      ],
    },
  }));

  mock.on('game-join-request', () => null);

  mock.on('list-missions-request', () => ({
    event: 'list-missions-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: TEST_CHARACTER_ID,
      missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'started' }],
    },
  }));

  mock.on('ship-list-request', () => ({
    event: 'ship-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: TEST_CHARACTER_ID,
      ships: [
        {
          id: 'ship-1',
          name: 'Starter Pod',
          model: 'Scavenger Pod',
          status: 'Damaged',
          inventory: [],
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: { x: 1_000_000, y: 0, z: 0 },
            epochMs: Date.now(),
          },
          motion: { velocityKmPerSec: { x: 0, y: 0, z: 0 } },
          observability: { visibility: 'visible', scanState: 'scanned' },
        },
      ],
    },
  }));

  mock.on('celestial-body-list-request', () => ({
    event: 'celestial-body-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      solarSystemId: 'sol',
      positionKm: { x: 1_000_000, y: 0, z: 0 },
      distanceKm: 900_000,
      celestialBodies: [],
    },
  }));

  mock.on('add-mission-request', () => ({
    event: 'add-mission-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: TEST_CHARACTER_ID,
    },
  }));
}

const flightPanel = (page: Page) => page.locator('.ship-exterior-flight-panel');
const flightToggle = (page: Page) =>
  page.locator('.ship-exterior-flight-panel__toggle');
const flightHint = (page: Page) =>
  page.locator('.ship-exterior-flight-panel__hint');

async function readCoordZ(page: Page): Promise<number | null> {
  const text = (await flightPanel(page).innerText()).trim();
  const match = text.match(/COORD KM\s*\/\/\s*X\s+(-?\d+)\s+Y\s+(-?\d+)\s+Z\s+(-?\d+)/);
  if (!match) {
    return null;
  }
  return Number(match[3]);
}

test.describe('Ship Exterior — flight mode smoke', () => {
  test('toggles flight, integrates WASD movement, then unlocks cleanly on disable', async ({
    page,
  }) => {
    const mock = new SocketIOMock(page);
    const gameShell = new GameShellPage(page);
    await mock.setup();
    configureFlightModeMock(mock);

    await loginViaUI(page, mock);
    await gameShell.joinGame('Join Game in Progress');
    await expect(page).toHaveURL(/right:opening-cold-boot-scan/);

    const panel = flightPanel(page);
    const toggle = flightToggle(page);
    await expect(panel).toBeVisible();
    await expect(toggle).toHaveText(/ENABLE FLIGHT/);
    await expect(flightHint(page)).toHaveCount(0);

    // --- Enable flight ---
    await toggle.click();
    await expect(toggle).toHaveText(/DISABLE FLIGHT/);
    await expect(toggle).toHaveClass(/ship-exterior-flight-panel__toggle--active/);
    await expect(flightHint(page)).toBeVisible();

    // After enabling, the camera/coord state is reset to origin.
    await expect
      .poll(() => readCoordZ(page))
      .toBe(0);

    // --- Hold W to integrate forward movement; expect COORD Z to change. ---
    await page.keyboard.down('KeyW');
    try {
      await expect
        .poll(async () => {
          const z = await readCoordZ(page);
          return z !== null && z !== 0;
        }, { timeout: 5_000 })
        .toBe(true);
    } finally {
      await page.keyboard.up('KeyW');
    }

    // --- Disable flight ---
    await toggle.click();
    await expect(toggle).toHaveText(/ENABLE FLIGHT/);
    await expect(toggle).not.toHaveClass(/ship-exterior-flight-panel__toggle--active/);
    await expect(flightHint(page)).toHaveCount(0);

    // Pointer lock must not still be held by the document body after disable.
    // Acquisition is async, so the release may race with the click handler —
    // poll to give the browser a frame to settle.
    await expect
      .poll(
        () => page.evaluate(() => document.pointerLockElement === document.body),
        { timeout: 5_000 },
      )
      .toBe(false);
  });
});
