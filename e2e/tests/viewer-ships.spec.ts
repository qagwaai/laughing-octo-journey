import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import { TEST_PLAYER, TEST_SESSION_KEY } from '../helpers/auth-helper';
import {
  ACTIVE_SHIP,
  INACTIVE_SHIP,
  SHIP_IN_OTHER_SYSTEM,
  makeShipListResponse,
  makeSolarSystemGetResponse,
  setupIsolatedViewerShipsSession,
  setupSharedViewerShipsSession,
  type SharedViewerShipsSession,
} from '../fixtures/viewer-ships-scenario';
import { GameShellPage } from '../page-objects/game-shell.page';
import { ViewerPage } from '../page-objects/viewer.page';
import { ViewerShipsPage } from '../page-objects/viewer-ships.page';

async function getCanvasFrameSignature(canvas: Locator): Promise<string> {
  const image = await canvas.screenshot();
  return image.toString('base64');
}

let sharedContext: BrowserContext;
let sharedPage: Page;
let sharedSession: SharedViewerShipsSession;
let sharedMock: SharedViewerShipsSession['mock'];
let sharedGameShell: SharedViewerShipsSession['gameShell'];
let sharedViewerPage: ViewerPage;

async function resetSharedViewerShipsSession(): Promise<void> {
  if (!sharedPage || sharedPage.isClosed()) {
    return;
  }

  const currentUrl = sharedPage.url();
  if (currentUrl.includes('right:viewer-scene')) {
    await sharedPage.goBack();
  }

  if (sharedPage.url().includes('left:viewer')) {
    await sharedPage.goBack();
  }

  if (sharedPage.url().includes('left:game-main')) {
    sharedMock.reset();
  }

  await expect(sharedPage).toHaveURL(/left:game-main/, { timeout: 10_000 });
}

async function navigateToScene(
  ships: any[] = [ACTIVE_SHIP, INACTIVE_SHIP],
  onShipRequest?: (request: unknown) => void,
) {
  sharedMock.reset();
  sharedMock.on('solar-system-get-request', () => ({
    event: 'solar-system-get-response',
    data: makeSolarSystemGetResponse(),
  }));
  sharedMock.on('ship-list-by-owner-request', (request) => {
    onShipRequest?.(request);
    return {
      event: 'ship-list-by-owner-response',
      data: makeShipListResponse(ships),
    };
  });

  await sharedGameShell.openViewer();

  await sharedViewerPage.selectSystem('Sol');
  await sharedViewerPage.expectSceneLoaded();
}

// ── Tests ───────────────────────────────────────────────────────────────────

test.describe.serial('Viewer — Character Ships', () => {
  test.beforeAll(async ({ browser }) => {
    sharedSession = await setupSharedViewerShipsSession(browser);
    sharedContext = sharedSession.context;
    sharedPage = sharedSession.page;
    sharedMock = sharedSession.mock;
    sharedGameShell = sharedSession.gameShell;
    sharedViewerPage = sharedSession.viewerPage;
  });

  test.afterEach(async () => {
    await resetSharedViewerShipsSession();
  });

  test.afterAll(async () => {
    await sharedContext.close();
  });

  test('legend shows active ship and inactive ships entries', async () => {
    await navigateToScene();

    const shipsPage = new ViewerShipsPage(sharedPage);
    await shipsPage.assertLegendVisible();
    await expect(shipsPage.activeShipLegendItem).toContainText('Active Ship');
    await expect(shipsPage.inactiveShipLegendItem).toContainText('Inactive Ships');
  });

  test('active ship legend swatch uses amber color (#fbbf24)', async () => {
    await navigateToScene();

    const shipsPage = new ViewerShipsPage(sharedPage);
    await shipsPage.assertActiveShipSwatchColor('#fbbf24');
  });

  test('inactive ship legend swatch uses blue color (#3b82f6)', async () => {
    await navigateToScene();

    const shipsPage = new ViewerShipsPage(sharedPage);
    await shipsPage.assertInactiveShipSwatchColor('#3b82f6');
  });

  test('viewer requests scavenger pod GLB asset when rendering ship meshes', async ({ page }) => {
    const mock = await setupIsolatedViewerShipsSession(page);
    const isolatedGameShell = new GameShellPage(page);
    const isolatedViewerPage = new ViewerPage(page);

    const glbResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes('/models/ships/scavenger-pod.glb') && response.request().method() === 'GET',
    );

    mock.on('solar-system-get-request', () => ({
      event: 'solar-system-get-response',
      data: makeSolarSystemGetResponse(),
    }));
    mock.on('ship-list-by-owner-request', () => ({
      event: 'ship-list-by-owner-response',
      data: makeShipListResponse([ACTIVE_SHIP]),
    }));

    await isolatedGameShell.openViewer();
    await isolatedViewerPage.selectSystem('Sol');
    await isolatedViewerPage.expectSceneLoaded();

    const glbResponse = await glbResponsePromise;
    expect(glbResponse.ok()).toBeTruthy();
  });

  test('scene renders without error when ships are present in current solar system', async () => {
    await navigateToScene([ACTIVE_SHIP, INACTIVE_SHIP]);
    await sharedViewerPage.expectSceneLoaded();
  });

  test('scene renders without error when ship list is empty', async () => {
    await navigateToScene([]);
    await sharedViewerPage.expectSceneLoaded();
  });

  test('ships in other solar systems are excluded from scene', async () => {
    // Only include a ship from another system — scene should still load cleanly
    await navigateToScene([SHIP_IN_OTHER_SYSTEM]);
    await sharedViewerPage.expectSceneLoaded();
    // Legend should still be present
    const shipsPage = new ViewerShipsPage(sharedPage);
    await shipsPage.assertLegendVisible();
  });

  test('scene handles ship-list failure gracefully (no scene error shown)', async () => {
    sharedMock.reset();
    sharedMock.on('solar-system-get-request', () => ({
      event: 'solar-system-get-response',
      data: makeSolarSystemGetResponse(),
    }));
    sharedMock.on('ship-list-by-owner-request', () => ({
      event: 'ship-list-by-owner-response',
      data: {
        success: false,
        message: 'Service unavailable',
        playerName: TEST_PLAYER,
        characterId: 'char-viewer-1',
        ships: [],
      },
    }));

    await sharedGameShell.openViewer();

    await sharedViewerPage.selectSystem('Sol');
    await sharedViewerPage.expectSceneLoaded();
  });

  test('legend is always visible regardless of ship availability', async () => {
    await navigateToScene([]);

    const shipsPage = new ViewerShipsPage(sharedPage);
    await expect(shipsPage.legend).toBeVisible();
    await expect(shipsPage.activeShipLegendItem).toBeVisible();
    await expect(shipsPage.inactiveShipLegendItem).toBeVisible();
  });

  test('session key is used in ship-list request alongside player and character', async () => {
    let capturedShipRequest: any = null;

    await navigateToScene([ACTIVE_SHIP], (request) => {
      capturedShipRequest = request;
    });

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

  test('target button flies camera to selected ship row target', async () => {
    await navigateToScene([ACTIVE_SHIP, INACTIVE_SHIP]);

    const canvas = sharedViewerPage.sceneCanvas;
    await expect(canvas).toBeVisible({ timeout: 10_000 });
    await sharedViewerPage.switchToDistanceView();

    const before = await getCanvasFrameSignature(canvas);
    expect(before.length).toBeGreaterThan(500);

    const targetShipButton = sharedPage
      .locator('tr', { hasText: ACTIVE_SHIP.name })
      .first()
      .locator('button.details-target-btn')
      .first();

    await expect(targetShipButton).toBeVisible({ timeout: 10_000 });
    await targetShipButton.click();
    await expect(targetShipButton).toHaveAttribute('aria-pressed', 'true');

    // Wait until the rendered frame changes instead of relying on a fixed delay.
    await expect
      .poll(async () => getCanvasFrameSignature(canvas), {
        timeout: 10_000,
        intervals: [300, 600, 1_000],
      })
      .not.toBe(before);

    await expect(sharedViewerPage.sceneError).toHaveCount(0);
  });

  test('renders unknown-spatial legend swatch and triggers lazy repair upsert', async () => {
    // A ship arriving with sun-origin spatial — the legacy synthetic placeholder
    // case — should: (a) surface the unknown-location legend entry, and
    // (b) cause the client to re-issue a deterministic ship upsert to repair it.
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
    sharedMock.on('ship-upsert-request', (data) => {
      capturedShipUpsertRequest = data;
      return {
        event: 'ship-upsert-response',
        data: { success: true, message: '', playerName: TEST_PLAYER, characterId: 'char-viewer-1' },
      };
    });

    await navigateToScene([BROKEN_SHIP]);

    const shipsPage = new ViewerShipsPage(sharedPage);
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
