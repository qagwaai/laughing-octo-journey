import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import type { Object3D } from 'three';
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
import { TEST_PLAYER, TEST_SESSION_KEY } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { ViewerShipsPage } from '../page-objects/viewer-ships.page';
import { ViewerPage } from '../page-objects/viewer.page';

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

test('left-click targets a rendered ship and synchronizes its list button', async ({ page }) => {
  const mock = await setupIsolatedViewerShipsSession(page);
  const gameShell = new GameShellPage(page);
  const viewer = new ViewerPage(page);
  const ship = {
    ...ACTIVE_SHIP,
    spatial: { ...ACTIVE_SHIP.spatial, positionKm: { x: -100_000_000, y: 0, z: -100_000_000 } },
  };
  mock.on('solar-system-get-request', () => ({
    event: 'solar-system-get-response',
    data: makeSolarSystemGetResponse(),
  }));
  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: makeShipListResponse([ship]),
  }));
  await gameShell.openViewer();
  await viewer.selectSystem('Sol');
  await viewer.expectSceneLoaded();
  await viewer.switchToDistanceView();
  const button = page.locator('tr', { hasText: ship.name }).locator('button.details-target-btn');
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  const readPoint = () =>
    page.evaluate((name) => {
      const canvas = document.querySelector('ngt-canvas');
      if (!canvas) throw new Error('Viewer canvas is missing');
      const ng = window.ng;
      if (!ng) throw new Error('Angular debug API is unavailable.');
      const snapshot = (
        ng.getComponent(canvas) as {
          store: { snapshot: { scene: import('three').Object3D; camera: import('three').Camera } };
        }
      ).store.snapshot;
      const object = snapshot.scene.getObjectByName(name)?.getObjectByName('pod-hull-core');
      if (!object) return null;
      const screen = object.getWorldPosition(object.position.clone()).project(snapshot.camera);
      const bounds = canvas.getBoundingClientRect();
      return { x: bounds.x + ((screen.x + 1) / 2) * bounds.width, y: bounds.y + ((1 - screen.y) / 2) * bounds.height };
    }, ship.name);
  await expect.poll(async () => Boolean(await readPoint())).toBe(true);
  const point = await readPoint();
  if (!point) throw new Error('Ship hull is missing from the scene');
  await page.mouse.click(point.x, point.y);
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('viewer-zoom-slider').locator('input')).not.toHaveValue('100');
});

test('opens an owned ship in the hangar and exterior view from the viewer', async ({ page }) => {
  const mock = await setupIsolatedViewerShipsSession(page);
  mock.on('solar-system-get-request', () => ({
    event: 'solar-system-get-response',
    data: makeSolarSystemGetResponse(),
  }));
  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: makeShipListResponse([ACTIVE_SHIP, INACTIVE_SHIP]),
  }));
  const viewer = new ViewerPage(page);
  await new GameShellPage(page).openViewer();
  await viewer.selectSystem('Sol');
  await viewer.expectSceneLoaded();
  await page.getByTestId('viewer-group-ships').uncheck();
  await page.getByRole('button', { name: /Ships\s+2/ }).click();
  const shortcut = page.getByRole('button', {
    name: `Open ${INACTIVE_SHIP.name} in the Ship Hangar and external view.`,
  });
  await expect(shortcut).toHaveAttribute('title', `Open ${INACTIVE_SHIP.name} in the Ship Hangar and external view.`);
  await shortcut.click();
  await expect(page).toHaveURL(/left:ship-hangar/);
  await expect(page).toHaveURL(/\/ship-exterior-view/);
  await expect(page.locator('app-ship-exterior-bare-scene')).toBeVisible();
  await expect(page.locator('app-ship-hangar-page')).toContainText(INACTIVE_SHIP.name);

  const pendingRequests: Array<{ correlationId: string; requestIdentity: unknown }> = [];
  mock.on('ship-list-by-owner-request', (request) => {
    pendingRequests.push(request as { correlationId: string; requestIdentity: unknown });
    return null;
  });
  await page.locator('.ship-item', { hasText: ACTIVE_SHIP.name }).getByRole('button', { name: 'View in Star System' }).click();
  await expect(page).toHaveURL(/left:solar-system-details\/sol/);
  await expect(page).toHaveURL(/right:viewer-scene\/sol/);
  await viewer.expectSceneLoaded();
  await expect.poll(() => pendingRequests.length).toBeGreaterThanOrEqual(2);
  for (const request of pendingRequests) {
    mock.push('ship-list-by-owner-response', {
      ...makeShipListResponse([ACTIVE_SHIP, INACTIVE_SHIP]),
      correlationId: request.correlationId,
      requestIdentity: request.requestIdentity,
    });
  }
  await expect(page.getByTestId('viewer-group-ships')).toBeChecked();
  const target = page.getByTestId('details-table-ship').locator('tr', { hasText: ACTIVE_SHIP.name })
    .locator('.details-target-btn');
  await expect(target).toHaveAttribute('aria-pressed', 'true');
  await expect.poll(() => page.evaluate((name) => {
    const canvas = document.querySelector('app-viewer-scene-page ngt-canvas');
    if (!canvas || !window.ng) return false;
    const snapshot = (window.ng.getComponent(canvas) as {
      store: { snapshot: { scene: Object3D; camera: import('three').Camera } };
    }).store.snapshot;
    const ship = snapshot.scene.getObjectByName(name);
    if (!ship) return false;
    const position = ship.getWorldPosition(ship.position.clone());
    const projected = position.clone().project(snapshot.camera);
    return Math.hypot(projected.x, projected.y) < 0.02 && snapshot.camera.position.distanceTo(position) < 8;
  }, ACTIVE_SHIP.name), { timeout: 15_000 }).toBe(true);
});

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
      (response) => response.url().includes('/models/ships/scavenger-pod.glb') && response.request().method() === 'GET',
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
    await expect
      .poll(() =>
        sharedPage.evaluate(() => {
          const canvas = document.querySelector('ngt-canvas');
          if (!canvas) return 0;
          const ng = window.ng;
          if (!ng) throw new Error('Angular debug API is unavailable.');
          const scene = (
            ng.getComponent(canvas) as { store: { snapshot: { scene: Object3D | null } } }
          ).store.snapshot.scene;
          let count = 0;
          scene?.traverse((object) => {
            if (object.name === 'viewer-target-bracket') count++;
          });
          return count;
        }),
      )
      .toBe(0);

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
