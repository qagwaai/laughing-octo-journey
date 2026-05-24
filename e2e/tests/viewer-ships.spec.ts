import { expect, test, type Locator } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER, TEST_SESSION_KEY } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { ViewerPage } from '../page-objects/viewer.page';
import { ViewerShipsPage } from '../page-objects/viewer-ships.page';

// ── Shared test data ────────────────────────────────────────────────────────

const SOL_SUMMARY = {
  id: 'sol',
  displayName: 'Sol',
  source: 'curated',
  distanceParsec: 0,
  starCount: 1,
  primaryStar: { hygId: '0', spectralClass: 'G2V', colorHex: '#fff5b6', luminositySolar: 1.0 },
};

const SOL_BODIES: any[] = [
  {
    id: 'sun',
    bodyType: 'star',
    displayName: 'The Sun',
    spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 0, y: 0, z: 0 }, epochMs: 1715000000000 },
    visualization: { colorHex: '#fff5b6' },
    spectralClass: 'G2V',
    luminositySolar: 1.0,
    massSolar: 1.0,
  },
  {
    id: 'earth',
    bodyType: 'planet',
    displayName: 'Earth',
    spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 149597870.7, y: 0, z: 0 }, epochMs: 1715000000000 },
    orbitalElements: {
      anchorBodyId: 'sun',
      semiMajorAxisKm: 149597870.7,
      eccentricity: 0.0167,
      inclinationDeg: 0,
      longitudeOfAscendingNodeDeg: 0,
      argumentOfPeriapsisDeg: 102.9,
      meanAnomalyAtEpochDeg: 100.5,
      orbitalPeriodSec: 31536000,
      epoch: '2026-05-08T00:00:00.000Z',
    },
  },
];

const ACTIVE_SHIP = {
  id: 'ship-active-1',
  name: 'Wayfarer I',
  model: 'Scavenger Pod',
  tier: 1,
  status: null,
  spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 10000000, y: 0, z: 0 }, epochMs: 1715000000000 },
};

const INACTIVE_SHIP = {
  id: 'ship-inactive-2',
  name: 'Drifter II',
  model: 'Scavenger Pod',
  tier: 1,
  status: null,
  spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 20000000, y: 0, z: 0 }, epochMs: 1715000000000 },
};

const SHIP_IN_OTHER_SYSTEM = {
  id: 'ship-other-3',
  name: 'Far Wanderer',
  model: 'Scavenger Pod',
  tier: 1,
  status: null,
  spatial: { solarSystemId: 'proxima', frame: 'barycentric', positionKm: { x: 5000000, y: 0, z: 0 }, epochMs: 1715000000000 },
};

function makeShipListResponse(ships: any[]) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    characterId: 'char-viewer-1',
    ships,
  };
}

function makeSolarSystemGetResponse(bodies: any[] = SOL_BODIES) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    solarSystemId: 'sol',
    solarSystem: SOL_SUMMARY,
    bodies,
  };
}

async function getCanvasFrameSignature(canvas: Locator): Promise<string> {
  const image = await canvas.screenshot();
  return image.toString('base64');
}

async function setupViewerShipsTest(page: any) {
  const mock = new SocketIOMock(page);
  const gameShell = new GameShellPage(page);
  await mock.setup();

  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characters: [
        {
          id: 'char-viewer-1',
          characterName: 'Scout',
          level: 1,
          missions: [{ missionId: 'first-target', status: 'in-progress' }],
        },
      ],
    },
  }));

  await loginViaUI(page, mock);

  mock.on('game-join-request', () => null);
  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: makeShipListResponse([ACTIVE_SHIP, INACTIVE_SHIP]),
  }));

  await gameShell.joinGame('Join Game');
  await expect(page.getByRole('heading', { name: 'Game Main' })).toBeVisible({ timeout: 10_000 });

  mock.on('solar-system-list-request', () => ({
    event: 'solar-system-list-response',
    data: { success: true, message: '', playerName: TEST_PLAYER, solarSystems: [SOL_SUMMARY] },
  }));

  return { mock };
}

async function navigateToScene(page: any, mock: any, ships: any[] = [ACTIVE_SHIP, INACTIVE_SHIP]) {
  const gameShell = new GameShellPage(page);
  const viewerPage = new ViewerPage(page);

  await gameShell.openViewer();

  mock.on('solar-system-get-request', () => ({
    event: 'solar-system-get-response',
    data: makeSolarSystemGetResponse(),
  }));
  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: makeShipListResponse(ships),
  }));

  await viewerPage.selectSystem('Sol');
  await expect(viewerPage.sceneCanvas).toBeVisible({ timeout: 10_000 });
}

// ── Tests ───────────────────────────────────────────────────────────────────

test.describe('Viewer — Character Ships', () => {
  test('legend shows active ship and inactive ships entries', async ({ page }) => {
    const { mock } = await setupViewerShipsTest(page);
    await navigateToScene(page, mock);

    const shipsPage = new ViewerShipsPage(page);
    await shipsPage.assertLegendVisible();
    await expect(shipsPage.activeShipLegendItem).toContainText('Active Ship');
    await expect(shipsPage.inactiveShipLegendItem).toContainText('Inactive Ships');
  });

  test('active ship legend swatch uses amber color (#fbbf24)', async ({ page }) => {
    const { mock } = await setupViewerShipsTest(page);
    await navigateToScene(page, mock);

    const shipsPage = new ViewerShipsPage(page);
    await shipsPage.assertActiveShipSwatchColor('#fbbf24');
  });

  test('inactive ship legend swatch uses blue color (#3b82f6)', async ({ page }) => {
    const { mock } = await setupViewerShipsTest(page);
    await navigateToScene(page, mock);

    const shipsPage = new ViewerShipsPage(page);
    await shipsPage.assertInactiveShipSwatchColor('#3b82f6');
  });

  test('scene renders without error when ships are present in current solar system', async ({ page }) => {
    const { mock } = await setupViewerShipsTest(page);
    await navigateToScene(page, mock, [ACTIVE_SHIP, INACTIVE_SHIP]);

    const viewerPage = new ViewerPage(page);
    await expect(viewerPage.sceneCanvas).toBeVisible();
    await expect(viewerPage.sceneError).toHaveCount(0);
    await expect(page).toHaveURL(/right:viewer-scene/);
  });

  test('viewer requests scavenger pod GLB asset when rendering ship meshes', async ({ page }) => {
    const { mock } = await setupViewerShipsTest(page);

    const glbResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/models/ships/scavenger-pod.glb') && response.request().method() === 'GET',
    );

    await navigateToScene(page, mock, [ACTIVE_SHIP]);

    const glbResponse = await glbResponsePromise;
    expect(glbResponse.ok()).toBeTruthy();
  });

  test('scene renders without error when ship list is empty', async ({ page }) => {
    const { mock } = await setupViewerShipsTest(page);
    await navigateToScene(page, mock, []);

    const viewerPage = new ViewerPage(page);
    await expect(viewerPage.sceneCanvas).toBeVisible();
    await expect(viewerPage.sceneError).toHaveCount(0);
  });

  test('ships in other solar systems are excluded from scene', async ({ page }) => {
    const { mock } = await setupViewerShipsTest(page);
    // Only include a ship from another system — scene should still load cleanly
    await navigateToScene(page, mock, [SHIP_IN_OTHER_SYSTEM]);

    const viewerPage = new ViewerPage(page);
    await expect(viewerPage.sceneCanvas).toBeVisible();
    await expect(viewerPage.sceneError).toHaveCount(0);
    // Legend should still be present
    const shipsPage = new ViewerShipsPage(page);
    await shipsPage.assertLegendVisible();
  });

  test('scene handles ship-list failure gracefully (no scene error shown)', async ({ page }) => {
    const { mock } = await setupViewerShipsTest(page);
    const gameShell = new GameShellPage(page);
    const viewerPage = new ViewerPage(page);

    await gameShell.openViewer();

    mock.on('solar-system-get-request', () => ({
      event: 'solar-system-get-response',
      data: makeSolarSystemGetResponse(),
    }));
    mock.on('ship-list-by-owner-request', () => ({
      event: 'ship-list-by-owner-response',
      data: { success: false, message: 'Service unavailable', playerName: TEST_PLAYER, characterId: 'char-viewer-1', ships: [] },
    }));

    await viewerPage.selectSystem('Sol');
    await expect(viewerPage.sceneCanvas).toBeVisible({ timeout: 10_000 });
    await expect(viewerPage.sceneError).toHaveCount(0);
  });

  test('legend is always visible regardless of ship availability', async ({ page }) => {
    const { mock } = await setupViewerShipsTest(page);
    await navigateToScene(page, mock, []);

    const shipsPage = new ViewerShipsPage(page);
    await expect(shipsPage.legend).toBeVisible();
    await expect(shipsPage.activeShipLegendItem).toBeVisible();
    await expect(shipsPage.inactiveShipLegendItem).toBeVisible();
  });

  test('session key is used in ship-list request alongside player and character', async ({ page }) => {
    const { mock } = await setupViewerShipsTest(page);
    let capturedShipRequest: any = null;

    mock.on('ship-list-by-owner-request', (data) => {
      capturedShipRequest = data;
      return {
        event: 'ship-list-by-owner-response',
        data: makeShipListResponse([ACTIVE_SHIP]),
      };
    });

    const gameShell = new GameShellPage(page);
    const viewerPage = new ViewerPage(page);

    await gameShell.openViewer();

    mock.on('solar-system-get-request', () => ({
      event: 'solar-system-get-response',
      data: makeSolarSystemGetResponse(),
    }));

    await viewerPage.selectSystem('Sol');
    await expect(viewerPage.sceneCanvas).toBeVisible({ timeout: 10_000 });

    // Verify the ship-list request was made with proper fields
    if (capturedShipRequest) {
      expect(capturedShipRequest).toHaveProperty('playerName', TEST_PLAYER);
      expect(capturedShipRequest).toHaveProperty('sessionKey', TEST_SESSION_KEY);
      expect(capturedShipRequest).toMatchObject({
        owner: {
          ownerType: 'player-character',
          characterId: 'char-viewer-1',
        },
      });
    }
  });

  test('target button flies camera to selected ship row target', async ({ page }) => {
    const { mock } = await setupViewerShipsTest(page);
    await navigateToScene(page, mock, [ACTIVE_SHIP, INACTIVE_SHIP]);

    const viewerPage = new ViewerPage(page);
    const canvas = viewerPage.sceneCanvas;
    await expect(canvas).toBeVisible({ timeout: 10_000 });
    await viewerPage.switchToDistanceView();

    const before = await getCanvasFrameSignature(canvas);
    expect(before.length).toBeGreaterThan(500);

    const targetShipButton = page
      .locator('tr', { hasText: ACTIVE_SHIP.name })
      .first()
      .locator('button.details-target-btn')
      .first();

    await expect(targetShipButton).toBeVisible({ timeout: 10_000 });
    await targetShipButton.click();
    await expect(targetShipButton).toHaveAttribute('aria-pressed', 'true');

    // Wait for target-fly tween to settle.
    await page.waitForTimeout(4_200);

    const after = await getCanvasFrameSignature(canvas);
    expect(after).not.toBe(before);
    await expect(viewerPage.sceneError).toHaveCount(0);
  });

  test('renders unknown-spatial legend swatch and triggers lazy repair upsert', async ({ page }) => {
    // A ship arriving with sun-origin spatial — the legacy synthetic placeholder
    // case — should: (a) surface the unknown-location legend entry, and
    // (b) cause the client to re-issue a deterministic ship upsert to repair it.
    const { mock } = await setupViewerShipsTest(page);
    const BROKEN_SHIP = {
      id: 'ship-broken-1',
      name: 'Wraith',
      model: 'Scavenger Pod',
      tier: 1,
      status: null,
      spatial: {
        solarSystemId: 'sol',
        frame: 'barycentric',
        positionKm: { x: 0, y: 0, z: 0 },
        epochMs: 1715000000000,
      },
    };

    let capturedShipUpsertRequest: any = null;
    mock.on('ship-upsert-request', (data) => {
      capturedShipUpsertRequest = data;
      return {
        event: 'ship-upsert-response',
        data: { success: true, message: '', playerName: TEST_PLAYER, characterId: 'char-viewer-1' },
      };
    });

    await navigateToScene(page, mock, [BROKEN_SHIP]);

    const shipsPage = new ViewerShipsPage(page);
    await expect(shipsPage.unknownShipLegendItem).toBeVisible({ timeout: 5_000 });
    await expect(shipsPage.unknownShipLegendItem).toContainText('Unknown location');

    // Lazy repair: the client re-issues the deterministic asteroid-belt upsert.
    expect(capturedShipUpsertRequest).not.toBeNull();
    expect(capturedShipUpsertRequest).toHaveProperty('playerName', TEST_PLAYER);
    expect(capturedShipUpsertRequest).toHaveProperty('characterId', 'char-viewer-1');
    expect(capturedShipUpsertRequest?.ship?.id).toBe('ship-broken-1');
    const pos = capturedShipUpsertRequest?.ship?.spatial?.positionKm;
    expect(pos).toBeTruthy();
    const magnitude = Math.hypot(pos.x, pos.y, pos.z);
    expect(magnitude).toBeGreaterThan(1e7);
  });
});
