import { expect, test, type Page } from '@playwright/test';
import {
  configureNavigateAwayPersistenceMock,
  SHIP_EXTERIOR_FLIGHT_PERSISTENCE_CHARACTER_ID,
  SHIP_EXTERIOR_FLIGHT_PERSISTENCE_SHIP_ID,
} from '../fixtures/ship-exterior-flight-persistence-scenario';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { ShipHangarPage } from '../page-objects/ship-hangar.page';

const SHIP_EXTERIOR_VIEW_URL_PATTERN = /(?:right:ship-exterior-view|\/ship-exterior-view(?:\(|$))/;

const shipExteriorScene = (page: Page) => page.locator('.ship-exterior-bare-scene');
const pilotStatus = (page: Page) => page.locator('.ship-exterior-bare-scene__flight-btn');
const debugButton = (page: Page) => page.getByRole('button', { name: 'Debug' });
const debugDrawer = (page: Page) => page.getByRole('dialog', { name: 'Ship scene diagnostics' });
const COORDS_PATTERN = /COORD KM\s*\/\/\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/;

async function readCoords(page: Page): Promise<{ x: number; y: number; z: number } | null> {
  const text = (await debugDrawer(page).innerText()).trim();
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

function toTelemetryCoords(coords: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  // Adding zero canonicalizes Math.round's -0 without masking non-finite values.
  return {
    x: Math.round(coords.x) + 0,
    y: Math.round(coords.y) + 0,
    z: Math.round(coords.z) + 0,
  };
}

async function waitForFlightTelemetryReady(page: Page): Promise<void> {
  await expect(pilotStatus(page)).toHaveText(/FLIGHT: CAPTURE/);
  if ((await debugButton(page).getAttribute('aria-expanded')) !== 'true') {
    await debugButton(page).click();
    await expect(debugDrawer(page)).toBeFocused();
  }
  await pilotStatus(page).focus();
  await expect.poll(() => readCoords(page), { timeout: 10_000 }).not.toBeNull();
}

async function moveForwardWithPilotControls(
  page: Page,
  coordsBeforeMove: { x: number; y: number; z: number },
): Promise<{ x: number; y: number; z: number }> {
  await pilotStatus(page).focus();
  await page.keyboard.down('KeyW');
  let movedCoords: { x: number; y: number; z: number } | null = null;
  try {
    await expect
      .poll(
        async () => {
          const coords = await readCoords(page);
          if (!coords) {
            return false;
          }
          if (coords.z === coordsBeforeMove.z) {
            return false;
          }
          movedCoords = coords;
          return true;
        },
        { timeout: 5_000 },
      )
      .toBe(true);
  } finally {
    await page.keyboard.up('KeyW');
  }

  if (!movedCoords) {
    throw new Error('Expected flight movement to change coordinates.');
  }

  let settledCoords: { x: number; y: number; z: number } | null = null;
  let previousCoords: { x: number; y: number; z: number } | null = null;
  let stableReadCount = 0;
  await expect
    .poll(
      async () => {
        const coords = await readCoords(page);
        if (!coords) {
          return false;
        }

        const movedFromStart =
          coords.x !== coordsBeforeMove.x || coords.y !== coordsBeforeMove.y || coords.z !== coordsBeforeMove.z;
        if (!movedFromStart) {
          return false;
        }

        if (
          previousCoords &&
          coords.x === previousCoords.x &&
          coords.y === previousCoords.y &&
          coords.z === previousCoords.z
        ) {
          stableReadCount += 1;
        } else {
          stableReadCount = 0;
        }

        previousCoords = coords;
        if (stableReadCount < 2) {
          return false;
        }

        settledCoords = coords;
        return true;
      },
      { timeout: 5_000 },
    )
    .toBe(true);

  return settledCoords ?? movedCoords;
}

test.describe('Ship Exterior - flight position persistence on re-entry', () => {
  test('keeps flight coordinates after mission board, market hub, and hangar navigation', async ({ page }) => {
    const persistedPosition = { x: 1_000_000, y: 0, z: 0 };
    const mock = new SocketIOMock(page);
    const gameShell = new GameShellPage(page);
    const shipHangarPage = new ShipHangarPage(page);

    await mock.setup();
    configureNavigateAwayPersistenceMock(mock, persistedPosition);

    await loginViaUI(page, mock);
    await gameShell.joinGame('Join Game in Progress');
    await expect(page).toHaveURL(/right:opening-cold-boot-scan/, { timeout: 15_000 });

    await expect(shipExteriorScene(page)).toBeVisible({ timeout: 10_000 });
    await waitForFlightTelemetryReady(page);

    const coordsBeforeMove = await readCoords(page);
    expect(coordsBeforeMove).not.toBeNull();

    const movedCoords = await moveForwardWithPilotControls(page, coordsBeforeMove!);
    await expect(pilotStatus(page)).toHaveText(/FLIGHT: CAPTURE/);

    await gameShell.openMissionBoard();
    await gameShell.openMarketHub();
    await shipHangarPage.openAndWaitForLoadedReadiness({
      routeContext: {
        playerName: TEST_PLAYER,
        characterId: SHIP_EXTERIOR_FLIGHT_PERSISTENCE_CHARACTER_ID,
        shipId: SHIP_EXTERIOR_FLIGHT_PERSISTENCE_SHIP_ID,
      },
    });
    await shipHangarPage.openExteriorForShip(0);

    await expect(page).toHaveURL(SHIP_EXTERIOR_VIEW_URL_PATTERN, { timeout: 15_000 });
    await expect(shipExteriorScene(page)).toBeVisible({ timeout: 10_000 });
    await waitForFlightTelemetryReady(page);

    const coordsAfterReturn = await readCoords(page);
    expect(coordsAfterReturn).not.toBeNull();
    expect(coordsAfterReturn).toEqual(movedCoords);
    expect(toTelemetryCoords(persistedPosition)).toEqual(toTelemetryCoords(movedCoords));
  });

  test('keeps latest coordinates across repeated re-entry cycles with different away-page order', async ({ page }) => {
    const persistedPosition = { x: 1_050_000, y: 0, z: 0 };
    const mock = new SocketIOMock(page);
    const gameShell = new GameShellPage(page);
    const shipHangarPage = new ShipHangarPage(page);

    await mock.setup();
    configureNavigateAwayPersistenceMock(mock, persistedPosition);

    await loginViaUI(page, mock);
    await gameShell.joinGame('Join Game in Progress');
    await expect(page).toHaveURL(/right:opening-cold-boot-scan/, { timeout: 15_000 });

    await expect(shipExteriorScene(page)).toBeVisible({ timeout: 10_000 });
    await waitForFlightTelemetryReady(page);

    const initialCoords = await readCoords(page);
    expect(initialCoords).not.toBeNull();

    const firstMovedCoords = await moveForwardWithPilotControls(page, initialCoords!);
    await expect(pilotStatus(page)).toHaveText(/FLIGHT: CAPTURE/);

    // First cycle: mission board -> market hub -> hangar -> exterior.
    await gameShell.openMissionBoard();
    await gameShell.openMarketHub();
    await shipHangarPage.openAndWaitForLoadedReadiness({
      routeContext: {
        playerName: TEST_PLAYER,
        characterId: SHIP_EXTERIOR_FLIGHT_PERSISTENCE_CHARACTER_ID,
        shipId: SHIP_EXTERIOR_FLIGHT_PERSISTENCE_SHIP_ID,
      },
    });
    await shipHangarPage.openExteriorForShip(0);
    await expect(page).toHaveURL(SHIP_EXTERIOR_VIEW_URL_PATTERN, { timeout: 15_000 });
    await expect(shipExteriorScene(page)).toBeVisible({ timeout: 10_000 });
    await waitForFlightTelemetryReady(page);

    const coordsAfterFirstReturn = await readCoords(page);
    expect(coordsAfterFirstReturn).toEqual(firstMovedCoords);
    expect(toTelemetryCoords(persistedPosition)).toEqual(toTelemetryCoords(firstMovedCoords));

    const secondMovedCoords = await moveForwardWithPilotControls(page, coordsAfterFirstReturn!);
    await expect(pilotStatus(page)).toHaveText(/FLIGHT: CAPTURE/);

    // Second cycle: market hub -> mission board -> hangar -> exterior.
    await gameShell.openMarketHub();
    await gameShell.openMissionBoard();
    await shipHangarPage.openAndWaitForLoadedReadiness({
      routeContext: {
        playerName: TEST_PLAYER,
        characterId: SHIP_EXTERIOR_FLIGHT_PERSISTENCE_CHARACTER_ID,
        shipId: SHIP_EXTERIOR_FLIGHT_PERSISTENCE_SHIP_ID,
      },
    });
    await shipHangarPage.openExteriorForShip(0);
    await expect(page).toHaveURL(SHIP_EXTERIOR_VIEW_URL_PATTERN, { timeout: 15_000 });
    await expect(shipExteriorScene(page)).toBeVisible({ timeout: 10_000 });
    await waitForFlightTelemetryReady(page);

    const coordsAfterSecondReturn = await readCoords(page);
    expect(coordsAfterSecondReturn).toEqual(secondMovedCoords);
    expect(toTelemetryCoords(persistedPosition)).toEqual(toTelemetryCoords(secondMovedCoords));
  });
});
