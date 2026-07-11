import { expect, test, type Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { ShipHangarPage } from '../page-objects/ship-hangar.page';

const FIRST_TARGET_MISSION_ID = 'first-target';
const TEST_CHARACTER_ID = 'char-flight-position-persistence';
const TEST_SHIP_ID = 'ship-flight-position-persistence';
const SHIP_EXTERIOR_VIEW_URL_PATTERN = /(?:right:ship-exterior-view|\/ship-exterior-view(?:\(|$))/;

function shipSummary(positionKm: { x: number; y: number; z: number }) {
  return {
    id: TEST_SHIP_ID,
    name: 'Starter Pod',
    model: 'Scavenger Pod',
    status: 'Damaged',
    inventory: [],
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm,
      epochMs: Date.now(),
    },
    motion: { velocityKmPerSec: { x: 0, y: 0, z: 0 } },
    observability: { visibility: 'visible', scanState: 'scanned' },
  };
}

function configureNavigateAwayPersistenceMock(
  mock: SocketIOMock,
  persistedPosition: { x: number; y: number; z: number },
): void {
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
          missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' }],
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
      missions: [{ missionId: FIRST_TARGET_MISSION_ID, status: 'active' }],
    },
  }));

  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: TEST_CHARACTER_ID,
      ships: [shipSummary(persistedPosition)],
    },
  }));

  mock.on('ship-upsert-request', (request) => {
    const payload = request as {
      ship?: {
        spatial?: {
          positionKm?: { x?: number; y?: number; z?: number };
        };
      };
    };
    const next = payload.ship?.spatial?.positionKm;
    if (
      typeof next?.x === 'number' &&
      Number.isFinite(next.x) &&
      typeof next?.y === 'number' &&
      Number.isFinite(next.y) &&
      typeof next?.z === 'number' &&
      Number.isFinite(next.z)
    ) {
      persistedPosition.x = next.x;
      persistedPosition.y = next.y;
      persistedPosition.z = next.z;
    }

    return {
      event: 'ship-upsert-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        characterId: TEST_CHARACTER_ID,
        ship: shipSummary(persistedPosition),
      },
    };
  });

  mock.on('celestial-body-list-request', () => ({
    event: 'celestial-body-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      solarSystemId: 'sol',
      positionKm: persistedPosition,
      distanceKm: 900_000,
      celestialBodies: [],
    },
  }));

  mock.on('market-list-by-location-request', (request) => {
    const payload = request as {
      distanceAu?: number;
      locationTypes?: string[];
      positionKm?: { x: number; y: number; z: number };
    };
    return {
      event: 'market-list-by-location-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        solarSystemId: 'sol',
        positionKm: payload.positionKm ?? persistedPosition,
        distanceAu: payload.distanceAu ?? 0.5,
        locationTypes: payload.locationTypes ?? ['station', 'free-floating'],
        isDocked: false,
        dockedMarketId: null,
        markets: [],
      },
    };
  });

  mock.on('mission-upsert-request', () => ({
    event: 'mission-upsert-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: TEST_CHARACTER_ID,
    },
  }));
}

const shipExteriorScene = (page: Page) => page.locator('.ship-exterior-bare-scene');
const flightToggle = (page: Page) => page.locator('.ship-exterior-bare-scene__flight-btn');
const COORDS_PATTERN = /COORD KM\s*\/\/\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/;

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

function toTelemetryCoords(coords: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
  return {
    x: Math.round(coords.x),
    y: Math.round(coords.y),
    z: Math.round(coords.z),
  };
}

async function waitForFlightTelemetryReady(page: Page): Promise<void> {
  await expect.poll(() => readCoords(page), { timeout: 10_000 }).not.toBeNull();
}

async function moveForwardInFlightMode(
  page: Page,
  coordsBeforeMove: { x: number; y: number; z: number },
): Promise<{ x: number; y: number; z: number }> {
  await page.keyboard.down('KeyW');
  let movedCoords: { x: number; y: number; z: number } | null = null;
  try {
    await expect
      .poll(async () => {
        const coords = await readCoords(page);
        if (!coords) {
          return false;
        }
        if (coords.z === coordsBeforeMove.z) {
          return false;
        }
        movedCoords = coords;
        return true;
      }, { timeout: 5_000 })
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
    .poll(async () => {
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
    }, { timeout: 5_000 })
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

    const toggle = flightToggle(page);
    await expect(shipExteriorScene(page)).toBeVisible({ timeout: 10_000 });
    await waitForFlightTelemetryReady(page);

    const coordsBeforeEnable = await readCoords(page);
    expect(coordsBeforeEnable).not.toBeNull();

    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveText(/FLIGHT \/\/ ON/);

    await moveForwardInFlightMode(page, coordsBeforeEnable!);

    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveText(/FLIGHT \/\/ OFF/);
    const movedCoords = await readCoords(page);
    expect(movedCoords).not.toBeNull();

    await gameShell.openMissionBoard();
    await gameShell.openMarketHub();
    await gameShell.openShipHangar();
    await shipHangarPage.waitForLoadedReadiness({
      routeContext: {
        playerName: TEST_PLAYER,
        characterId: TEST_CHARACTER_ID,
        shipId: TEST_SHIP_ID,
      },
    });

    const shipRow = page.locator('.ship-item').first();
    await expect(shipRow).toBeVisible({ timeout: 10_000 });
    await shipRow.locator('button', { hasText: 'View Exterior' }).click();

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

    const toggle = flightToggle(page);
    await expect(shipExteriorScene(page)).toBeVisible({ timeout: 10_000 });
    await waitForFlightTelemetryReady(page);

    const initialCoords = await readCoords(page);
    expect(initialCoords).not.toBeNull();

    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveText(/FLIGHT \/\/ ON/);
    await moveForwardInFlightMode(page, initialCoords!);
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveText(/FLIGHT \/\/ OFF/);
    const firstMovedCoords = await readCoords(page);
    expect(firstMovedCoords).not.toBeNull();

    // First cycle: mission board -> market hub -> hangar -> exterior.
    await gameShell.openMissionBoard();
    await gameShell.openMarketHub();
    await gameShell.openShipHangar();
    await shipHangarPage.waitForLoadedReadiness({
      routeContext: {
        playerName: TEST_PLAYER,
        characterId: TEST_CHARACTER_ID,
        shipId: TEST_SHIP_ID,
      },
    });

    const shipRow = page.locator('.ship-item').first();
    await expect(shipRow).toBeVisible({ timeout: 10_000 });
    await shipRow.locator('button', { hasText: 'View Exterior' }).click();
    await expect(page).toHaveURL(SHIP_EXTERIOR_VIEW_URL_PATTERN, { timeout: 15_000 });
    await expect(shipExteriorScene(page)).toBeVisible({ timeout: 10_000 });
    await waitForFlightTelemetryReady(page);

    const coordsAfterFirstReturn = await readCoords(page);
    expect(coordsAfterFirstReturn).toEqual(firstMovedCoords);
    expect(toTelemetryCoords(persistedPosition)).toEqual(toTelemetryCoords(firstMovedCoords));

    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveText(/FLIGHT \/\/ ON/);
    await moveForwardInFlightMode(page, coordsAfterFirstReturn!);
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(toggle).toHaveText(/FLIGHT \/\/ OFF/);
    const secondMovedCoords = await readCoords(page);
    expect(secondMovedCoords).not.toBeNull();

    // Second cycle: market hub -> mission board -> hangar -> exterior.
    await gameShell.openMarketHub();
    await gameShell.openMissionBoard();
    await gameShell.openShipHangar();
    await shipHangarPage.waitForLoadedReadiness({
      routeContext: {
        playerName: TEST_PLAYER,
        characterId: TEST_CHARACTER_ID,
        shipId: TEST_SHIP_ID,
      },
    });

    const shipRowSecondCycle = page.locator('.ship-item').first();
    await expect(shipRowSecondCycle).toBeVisible({ timeout: 10_000 });
    await shipRowSecondCycle.locator('button', { hasText: 'View Exterior' }).click();
    await expect(page).toHaveURL(SHIP_EXTERIOR_VIEW_URL_PATTERN, { timeout: 15_000 });
    await expect(shipExteriorScene(page)).toBeVisible({ timeout: 10_000 });
    await waitForFlightTelemetryReady(page);

    const coordsAfterSecondReturn = await readCoords(page);
    expect(coordsAfterSecondReturn).toEqual(secondMovedCoords);
    expect(toTelemetryCoords(persistedPosition)).toEqual(toTelemetryCoords(secondMovedCoords));
  });
});
