import { expect, test, type Page } from '@playwright/test';
import { configureFlightModeMock } from '../fixtures/ship-exterior-flight-mode-scenario';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';

const shipExteriorScene = (page: Page) => page.locator('.ship-exterior-bare-scene');
const flightToggle = (page: Page) => page.locator('.ship-exterior-bare-scene__flight-btn');

const COORDS_PATTERN = /COORD KM\s*\/\/\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/;

async function readCoordZ(page: Page): Promise<number | null> {
  const text = (await shipExteriorScene(page).innerText()).trim();
  const match = text.match(COORDS_PATTERN);
  if (!match) {
    return null;
  }
  return Number(match[3]);
}

async function readCoords(page: Page): Promise<{ x: number; y: number; z: number } | null> {
  const text = (await shipExteriorScene(page).innerText()).trim();
  const match = text.match(COORDS_PATTERN);
  if (!match) {
    return null;
  }
  return {
    x: Number(match[1]),
    y: Number(match[2]),
    z: Number(match[3]),
  };
}

async function waitForFlightTelemetryReady(page: Page): Promise<void> {
  await expect
    .poll(() => readCoordZ(page), { timeout: 10_000 })
    .not.toBeNull();
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
    await expect(page).toHaveURL(/right:opening-cold-boot-scan/, { timeout: 15_000 });

    const toggle = flightToggle(page);
    await expect(shipExteriorScene(page)).toBeVisible({ timeout: 10_000 });
    await waitForFlightTelemetryReady(page);
    await expect(toggle).toHaveText(/FLIGHT \/\/ OFF/);
    const coordsBeforeEnable = await readCoords(page);
    expect(coordsBeforeEnable).not.toBeNull();

    // --- Enable flight ---
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveText(/FLIGHT \/\/ ON/);

    // Enabling flight should not immediately jump location telemetry.
    await expect
      .poll(() => readCoords(page))
      .toEqual(coordsBeforeEnable);

    // --- Hold W then S; they should drive Z in opposite directions. ---
    const zBaseline = coordsBeforeEnable?.z ?? 0;

    await page.keyboard.down('KeyW');
    let zAfterW: number | null = null;
    try {
      await expect
        .poll(async () => {
          const z = await readCoordZ(page);
          if (z === null || z === zBaseline) {
            return false;
          }
          zAfterW = z;
          return true;
        }, { timeout: 5_000 })
        .toBe(true);
    } finally {
      await page.keyboard.up('KeyW');
    }

    expect(zAfterW).not.toBeNull();
    if (zAfterW === null) {
      throw new Error('Expected W movement to update Z telemetry.');
    }
    expect(zAfterW).not.toBe(zBaseline);
    const wDelta = zAfterW - zBaseline;

    await page.keyboard.down('KeyS');
    try {
      await expect
        .poll(async () => {
          const z = await readCoordZ(page);
          if (z === null) {
            return false;
          }
          return wDelta > 0 ? z < zAfterW : z > zAfterW;
        }, { timeout: 5_000 })
        .toBe(true);
    } finally {
      await page.keyboard.up('KeyS');
    }

    // --- Disable flight ---
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveText(/FLIGHT \/\/ OFF/);

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

  test('esc exits flight mode and releases pointer lock', async ({ page }) => {
    const mock = new SocketIOMock(page);
    const gameShell = new GameShellPage(page);
    await mock.setup();
    configureFlightModeMock(mock);

    await loginViaUI(page, mock);
    await gameShell.joinGame('Join Game in Progress');
    await expect(page).toHaveURL(/right:opening-cold-boot-scan/, { timeout: 15_000 });

    const toggle = flightToggle(page);
    await expect(shipExteriorScene(page)).toBeVisible({ timeout: 10_000 });
    await waitForFlightTelemetryReady(page);

    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveText(/FLIGHT \/\/ ON/);

    await page.keyboard.press('Escape');

    await expect(toggle).toHaveText(/FLIGHT \/\/ OFF/);

    await expect
      .poll(
        () => page.evaluate(() => document.pointerLockElement === document.body),
        { timeout: 5_000 },
      )
      .toBe(false);
  });
});
