import { expect, test } from '@playwright/test';
import type { Color, Mesh, PerspectiveCamera, Scene } from 'three';
import { SocketIOMock } from '../fixtures/socket-mock';
import {
  ACTIVE_SHIP,
  ALPHA_CENTAURI_SYSTEM,
  setupViewerListTest,
  SIRIUS_SYSTEM,
  SOL_SYSTEM,
  solarSystemListResponse,
} from '../fixtures/viewer-list-scenario';
import { loginViaUI, TEST_PLAYER, TEST_SESSION_KEY } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { LoginPage } from '../page-objects/login.page';
import { ViewerPage } from '../page-objects/viewer.page';

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Viewer — Solar System List', () => {
  test('loads and displays solar system list after navigation to viewer', async ({ page }) => {
    await setupViewerListTest(page, [SOL_SYSTEM, ALPHA_CENTAURI_SYSTEM, SIRIUS_SYSTEM]);
    const viewerPage = new ViewerPage(page);

    // Navigate to Viewer from the left menu
    await new GameShellPage(page).openViewer();

    // Wait for the system list to render
    const systemList = viewerPage.systemList;
    await expect(systemList).toHaveCount(1);

    // Verify all systems are displayed
    const items = page.locator('.solar-system-item');
    await expect(items).toHaveCount(3);
    await expect(viewerPage.systemItemById('cygnus-x1')).toHaveCount(0);
    await expect(page.getByTestId('viewer-result-count')).toHaveText('3 of 3 systems');
    await expect(page.getByTestId('viewer-load-more')).toHaveCount(0);

    // Verify Sol system displays (use specific span selector to avoid ambiguity)
    const solNameSpan = page.locator('.solar-system-item__name:has-text("Sol")');
    await expect(solNameSpan).toBeVisible();
    const solItemButton = solNameSpan.locator('..');
    await expect(solItemButton).toContainText('Distance (pc): 0.00');
    await expect(solItemButton).toContainText('G2V');

    // Verify Alpha Centauri system displays (use specific span selector)
    const alphaCentauriNameSpan = page.locator('.solar-system-item__name:has-text("Alpha Centauri")');
    await expect(alphaCentauriNameSpan).toBeVisible();
    const alphaCentauriItemButton = alphaCentauriNameSpan.locator('..');
    await expect(alphaCentauriItemButton).toContainText('Distance (pc): 1.30');

    // Verify Sirius system displays (use specific span selector)
    const siriusNameSpan = page.locator('.solar-system-item__name:has-text("Sirius")');
    await expect(siriusNameSpan).toBeVisible();
    const siriusItemButton = siriusNameSpan.locator('..');
    await expect(siriusItemButton).toContainText('Distance (pc): 2.60');
  });

  test('displays loading state while fetching solar systems', async ({ page }) => {
    const mock = new SocketIOMock(page);
    const gameShell = new GameShellPage(page);
    const viewerPage = new ViewerPage(page);
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
            missions: [
              {
                missionId: 'first-target',
                status: 'active',
              },
            ],
          },
        ],
      },
    }));

    await loginViaUI(page, mock);

    // Must join a game before viewer menu is enabled
    mock.on('game-join-request', () => null);
    mock.on('ship-list-by-owner-request', () => ({
      event: 'ship-list-by-owner-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        characterId: 'char-viewer-1',
        ships: [ACTIVE_SHIP],
      },
    }));
    const joinButton = gameShell.joinButton();
    await expect(joinButton).toBeVisible({ timeout: 10000 });
    await expect(joinButton).toBeEnabled({ timeout: 10000 });
    await gameShell.joinGame();
    await expect(page).toHaveURL(/left:game-main/, { timeout: 10000 });

    // Register the response handler but delay the response to catch the loading state
    let resolveResponse!: () => void;
    const delayedResponse = new Promise<void>((resolve) => {
      resolveResponse = resolve;
    });

    mock.on('solar-system-list-request', async () => {
      await delayedResponse;
      return {
        event: 'solar-system-list-response',
        data: solarSystemListResponse([SOL_SYSTEM]),
      };
    });

    // Navigate to Viewer and verify loading state is shown
    await gameShell.openViewer();

    // Confirm loading state before resolving the delayed response
    const loadingState = viewerPage.loadingState;
    await expect(loadingState).toHaveCount(1, { timeout: 5000 });

    // Resolve the delayed response
    resolveResponse();
    await expect(viewerPage.loadingState).toHaveCount(0);
    await expect(viewerPage.systemItemById('sol')).toBeVisible();
  });

  test('shows the empty state without injecting a local Cygnus X-1 entry', async ({ page }) => {
    await setupViewerListTest(page, []);
    const gameShell = new GameShellPage(page);
    const viewerPage = new ViewerPage(page);

    await gameShell.openViewer();

    await expect(viewerPage.emptyState).toBeVisible();
    await expect(viewerPage.systemItemById('cygnus-x1')).toHaveCount(0);
  });

  test('pages with Load more and resets to offset 0 when a filter changes', async ({ page }) => {
    const systems = Array.from({ length: 120 }, (_, index) => ({
      id: `sys-${String(index).padStart(3, '0')}`,
      displayName: `System ${String(index).padStart(3, '0')}`,
      source: 'procedural',
      distanceParsec: index / 10,
    }));
    const { mock } = await setupViewerListTest(page, systems);
    const requests: Record<string, unknown>[] = [];
    mock.on('solar-system-list-request', (request) => {
      requests.push(request as Record<string, unknown>);
      return { event: 'solar-system-list-response', data: solarSystemListResponse(systems) };
    });

    await new GameShellPage(page).openViewer();
    const items = page.locator('.solar-system-item');
    await expect(items).toHaveCount(50);
    await expect(page.getByTestId('viewer-result-count')).toHaveText('50 of 120 systems');

    await page.getByTestId('viewer-load-more').click();
    await expect(items).toHaveCount(100);
    await page.getByTestId('viewer-load-more').click();
    await expect(items).toHaveCount(120);
    await expect(page.getByTestId('viewer-load-more')).toHaveCount(0);
    expect(requests.map((request) => request['offset'])).toEqual([0, 50, 100]);
    expect(requests[0]).toEqual(expect.objectContaining({ limit: 50, maxDistanceParsec: 50, sort: 'distance' }));

    await page.getByTestId('viewer-sort').selectOption('name');
    await expect(items).toHaveCount(50);
    expect(requests.at(-1)).toEqual(expect.objectContaining({ offset: 0, sort: 'name' }));
  });

  test('searches beyond the default distance band with short queries', async ({ page }) => {
    const koi351 = {
      id: 'exo-koi-351',
      displayName: 'KOI-351',
      catalogName: 'Kepler-90',
      source: 'exoplanet-catalog',
      distanceParsec: 848.2,
      distanceApproximate: true,
      planetCount: 8,
    };
    const { mock } = await setupViewerListTest(page, [SOL_SYSTEM]);
    const requests: Record<string, unknown>[] = [];
    mock.on('solar-system-list-request', (request) => {
      const typed = request as Record<string, unknown>;
      requests.push(typed);
      return {
        event: 'solar-system-list-response',
        data: solarSystemListResponse(typed['search'] ? [koi351] : [SOL_SYSTEM]),
      };
    });

    await new GameShellPage(page).openViewer();
    await expect(page.locator('.solar-system-item')).toHaveCount(1);

    const search = page.getByTestId('viewer-search');
    await search.fill('KO');
    await expect(page.getByTestId('viewer-search-all-distances')).toBeVisible();
    await expect.poll(() => requests.at(-1)?.['search']).toBe('KO');
    await search.fill('KOI-351');
    await expect.poll(() => requests.at(-1)?.['search']).toBe('KOI-351');
    const koiItem = new ViewerPage(page).systemItemById('exo-koi-351');
    await expect(koiItem).toContainText('Kepler-90');
    await expect(koiItem).toContainText('\u2248848.20');
    await expect(page.getByTestId('viewer-max-distance')).toBeDisabled();

    const searchRequest = requests.at(-1)!;
    expect(searchRequest).toEqual(expect.objectContaining({ search: 'KOI-351', offset: 0 }));
    expect(searchRequest).not.toHaveProperty('maxDistanceParsec');
    expect(requests.filter((request) => request['search'] === 'KO')).toHaveLength(1);
  });

  test('shows contextual data credits, the snapshot date and discovery-first references', async ({
    page,
  }, testInfo) => {
    const snapshotDate = '2026-11-01';
    const cancri = {
      id: 'exo-55-cnc',
      displayName: '55 Cancri',
      catalogName: '55 Cnc',
      source: 'exoplanet-catalog',
      distanceParsec: 12.59,
      planetCount: 1,
      catalogSnapshotDate: snapshotDate,
    };
    const spatial = {
      solarSystemId: 'exo-55-cnc',
      frame: 'barycentric',
      positionKm: { x: 0, y: 0, z: 0 },
      epochMs: 1_761_408_000_000,
    };
    const star = {
      id: 'exo-star-55-cnc-a',
      bodyType: 'star',
      surfaceArchetype: 'star',
      displayName: '55 Cnc A',
      spectralClass: 'K0IV',
      parentBodyId: null,
      orbitalElements: null,
      spatial,
      state: 'active',
      composition: { material: 'stellar plasma', rarity: 'Common', textureColor: '#ffd2a1' },
    };
    const planet = {
      id: 'exo-55-cnc-b',
      bodyType: 'planet',
      planetType: 'hot-jupiter',
      surfaceArchetype: 'gas-giant',
      displayName: '55 Cnc b',
      parentBodyId: 'exo-star-55-cnc-a',
      orbitalElements: null,
      spatial: { ...spatial, positionKm: { x: 1.7e7, y: 0, z: 0 } },
      state: 'active',
      composition: { material: 'hydrogen', rarity: 'Common', textureColor: '#d9b38c' },
      discovery: {
        references: [
          { label: 'Butler et al. 1997', url: 'https://ui.adsabs.harvard.edu/abs/1997ApJ...474L.115B' },
          ...Array.from({ length: 6 }, (_, i) => ({ label: `Follow-up ${i + 1}`, url: `https://example.org/${i}` })),
        ],
      },
    };
    const { mock } = await setupViewerListTest(page, [cancri]);
    mock.on('solar-system-get-request', () => ({
      event: 'solar-system-get-response',
      data: { success: true, message: 'ok', solarSystem: cancri, stars: [star], bodies: [star, planet] },
    }));

    await new GameShellPage(page).openViewer();
    const item = new ViewerPage(page).systemItemById('exo-55-cnc');
    await expect(item.getByTestId('viewer-system-data-as-of')).toHaveText(`Data as of ${snapshotDate}`);
    await item.getByRole('button').click();
    await expect(page).toHaveURL(/right:viewer-scene\/exo-55-cnc/);

    await expect(page.getByTestId('viewer-data-as-of')).toHaveText(`Data as of ${snapshotDate}`);
    const about = page.getByTestId('viewer-about-data');
    await expect(about).not.toHaveAttribute('open', '');
    await expect(about).toHaveAttribute('data-credit-context', 'exoplanet');
    await about.locator('summary').click();
    await expect(about.locator('[data-credit-id="A1"]')).toBeVisible();
    await expect(about.locator('[data-credit-id="A10"]')).toHaveCount(0);
    await expect(about.locator('[data-credit-id="S1"]')).toHaveCount(0);
    await expect(about.getByTestId('viewer-data-limitations').locator('li')).toHaveCount(7);
    await page.getByTestId('viewer-info-panel').screenshot({ path: testInfo.outputPath('viewer-data-credits.png') });
    await page
      .locator('.details-type-header')
      .filter({ has: page.locator('.details-type-header__label', { hasText: /^Hot Jupiters$/ }) })
      .click();
    await page.locator('tr', { hasText: '55 Cnc b' }).first().locator('button.details-target-btn').click();
    await page.getByTestId('viewer-inspect-target').click();
    const references = page.getByTestId('viewer-inspector-references');
    await expect(references.locator('li')).toHaveCount(5);
    const discovery = references.locator('li').first();
    await expect(discovery).toHaveAttribute('data-reference-discovery', 'true');
    await expect(discovery.getByRole('link')).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(discovery.getByRole('link')).toHaveAttribute('target', '_blank');
    await references.getByTestId('viewer-references-toggle').click();
    await expect(references.locator('li')).toHaveCount(7);
    await page.getByTestId('viewer-body-inspector').screenshot({ path: testInfo.outputPath('viewer-references.png') });
  });

  test('requests the server-listed Cygnus system and renders its black-hole group with one companion', async ({
    page,
  }) => {
    const { mock } = await setupViewerListTest(page, [
      { id: 'cygnus-x1', displayName: 'Cygnus X-1', source: 'curated', distanceParsec: null, positionPc: null },
    ]);
    const requestedSystemIds: string[] = [];
    const blackHole = {
      id: 'cygnus-x1-black-hole',
      catalogId: 'cygnus-x1-black-hole',
      catalogIdentity: { namespace: 'cygnus-x1', key: 'black-hole' },
      bodyType: 'black-hole',
      surfaceArchetype: 'black-hole',
      displayName: 'Cygnus X-1',
      parentBodyId: null,
      orbitalElements: null,
      spatial: {
        solarSystemId: 'cygnus-x1',
        frame: 'barycentric',
        positionKm: { x: 0, y: 0, z: 0 },
        epochMs: 1_761_408_000_000,
      },
      state: 'active',
      composition: { material: 'black-hole', rarity: 'Common', textureColor: '#111827' },
      blackHoleProperties: {
        massSolar: 21.2,
        massUncertaintySolar: 2.2,
        distanceParsec: 2220,
        distanceUncertaintyParsec: 180,
        orbitalPeriodDays: 5.599829,
        relativeBinarySemimajorAxisAU: 0.244,
        eccentricity: 0.0189,
        inclinationDeg: 27.51,
        schwarzschildReferenceRadiusKm: 62.6,
        eventHorizonRadiusKm: null,
        visualAccretionDiskOuterRadiusKm: null,
        sourceReferences: [
          'Miller-Jones et al. 2021, Science 372, 1046, doi:10.1126/science.abb3363',
          'Orosz et al. 2011, ApJ 742, 84, doi:10.1088/0004-637X/742/2/84',
          'arXiv:2411.12507, wind-fed accretion context',
        ],
      },
    };
    const companion = {
      id: 'cygnus-x1-hd226868',
      catalogId: 'cygnus-x1-hd226868',
      catalogIdentity: { namespace: 'cygnus-x1', key: 'hd226868' },
      bodyType: 'star',
      surfaceArchetype: 'star',
      displayName: 'HD 226868',
      hygId: '97987',
      spectralClass: null,
      luminositySolar: null,
      physicalCatalog: {
        massSolar: 40.6,
        massUncertaintySolar: 7.7,
        meanRadiusKm: 15514110,
        meanTemperatureK: 31138,
      },
      parentBodyId: null,
      orbitalElements: null,
      spatial: {
        solarSystemId: 'cygnus-x1',
        frame: 'barycentric',
        positionKm: { x: 0, y: 0, z: 0 },
        epochMs: 1_761_408_000_000,
      },
      state: 'active',
      composition: { material: 'stellar plasma', rarity: 'Common', textureColor: '#fff2c0' },
    };
    mock.on('solar-system-get-request', (request) => {
      requestedSystemIds.push(String((request as { solarSystemId?: unknown }).solarSystemId));
      return {
        event: 'solar-system-get-response',
        data: {
          success: true,
          message: 'ok',
          solarSystem: {
            id: 'cygnus-x1',
            displayName: 'Cygnus X-1',
            source: 'curated',
            positionPc: null,
            distanceParsec: null,
          },
          stars: [companion],
          bodies: [blackHole, companion],
        },
      };
    });

    await new GameShellPage(page).openViewer();
    const viewerPage = new ViewerPage(page);
    await viewerPage.systemItemById('cygnus-x1').getByRole('button').click();

    await expect(page).toHaveURL(/right:viewer-scene\/cygnus-x1/);
    await page.locator('.details-type-header').filter({ hasText: 'Star' }).click();
    await page.locator('.details-type-header').filter({ hasText: 'Black holes' }).click();
    await expect(page.getByTestId('details-table-black-hole')).toContainText('Cygnus X-1');
    await expect(page.getByTestId('details-table-star').locator('tbody tr')).toHaveCount(1);
    await expect(page.getByTestId('details-table-black-hole').locator('tbody tr')).toHaveCount(1);
    await expect(page.getByTestId('viewer-black-hole-layout-note')).toBeVisible();
    await expect.poll(() => requestedSystemIds.length).toBeGreaterThanOrEqual(2);
    expect(requestedSystemIds).toEqual(['cygnus-x1', 'cygnus-x1']);
    await expect(page.locator('app-viewer-scene-page ngt-canvas canvas')).toBeVisible();
    const samplePoints = await page.evaluate(() => {
      const ng = Reflect.get(window, 'ng') as { getComponent: (element: Element | null) => unknown };
      const component = ng.getComponent(document.querySelector('app-viewer-scene-page ngt-canvas')) as {
        store: { snapshot: { scene: Scene; camera: PerspectiveCamera; invalidate: () => void } };
      };
      const { scene, camera, invalidate } = component.store.snapshot;
      const display = scene.getObjectByName('black-hole-image') as Mesh | undefined;
      if (!display) throw new Error('Viewer black-hole image unavailable.');
      display.scale.setScalar(6);
      scene.traverse(object => {
        if (Reflect.get(object, 'isMesh')) object.visible = object === display;
      });
      (scene.background as Color).setRGB(0.1, 0.3, 0.5);
      scene.updateMatrixWorld(true);
      const project = (x: number, y: number) => {
        const point = display.localToWorld(display.position.clone().set(x, y, 0)).project(camera);
        return { x: (point.x + 1) / 2, y: (1 - point.y) / 2 };
      };
      invalidate();
      return { corner: project(-4.2, -3.5), shadow: project(0, 0), outside: project(-8, -6) };
    });
    const png = await page.locator('app-viewer-scene-page ngt-canvas canvas').screenshot({
      style: 'app-viewer-scene-page { visibility: hidden; } app-viewer-scene-page canvas { visibility: visible; }',
    });
    const samples = await page.evaluate(async ({ png, samplePoints }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${png}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Background pixel sampler unavailable.');
      context.drawImage(image, 0, 0);
      const at = (point: { x: number; y: number }) => Array.from(context.getImageData(
        Math.round(point.x * image.width), Math.round(point.y * image.height), 1, 1,
      ).data).slice(0, 3);
      return {
        corner: at(samplePoints.corner), shadow: at(samplePoints.shadow), outside: at(samplePoints.outside),
      };
    }, { png: png.toString('base64'), samplePoints });
    expect(samples.corner).toEqual(samples.outside);
    expect(Math.max(...samples.outside)).toBeGreaterThan(50);
    expect(Math.max(...samples.shadow)).toBeLessThan(10);
  });

  test('displays error when system list request fails', async ({ page }) => {
    const mock = new SocketIOMock(page);
    const gameShell = new GameShellPage(page);
    const viewerPage = new ViewerPage(page);
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
            missions: [
              {
                missionId: 'first-target',
                status: 'active',
              },
            ],
          },
        ],
      },
    }));

    await loginViaUI(page, mock);

    // Must join a game before viewer menu is enabled
    mock.on('game-join-request', () => null);
    mock.on('ship-list-by-owner-request', () => ({
      event: 'ship-list-by-owner-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        characterId: 'char-viewer-1',
        ships: [ACTIVE_SHIP],
      },
    }));
    const joinButton = gameShell.joinButton();
    await expect(joinButton).toBeVisible({ timeout: 10000 });
    await expect(joinButton).toBeEnabled({ timeout: 10000 });
    await gameShell.joinGame();
    await expect(page).toHaveURL(/left:game-main/, { timeout: 10000 });

    mock.on('solar-system-list-request', () => ({
      event: 'solar-system-list-response',
      data: {
        success: false,
        message: 'Database connection error',
        playerName: TEST_PLAYER,
        solarSystems: [],
      },
    }));

    await gameShell.openViewer();

    const errorState = page.locator('[data-testid="viewer-error"]');
    await expect(errorState).toBeVisible();
    await expect(errorState).toContainText('Database connection error');
    await expect(page.getByTestId('viewer-retry')).toBeVisible();
    await expect(viewerPage.systemItemById('cygnus-x1')).toHaveCount(0);
  });

  test('navigates to scene view when system is selected', async ({ page }) => {
    const { mock } = await setupViewerListTest(page, [SOL_SYSTEM]);
    const gameShell = new GameShellPage(page);
    const viewerPage = new ViewerPage(page);

    await gameShell.openViewer();

    // Set up the scene response handler for when the user selects a system
    mock.on('solar-system-get-request', () => ({
      event: 'solar-system-get-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        solarSystemId: 'sol',
        solarSystem: SOL_SYSTEM,
        bodies: [],
      },
    }));

    // Select the Sol system
    await viewerPage.selectSystem('Sol');

    // Verify navigation to the scene view
    await viewerPage.expectSceneRoute();
  });

  test('[locale] displays viewer list in Italian locale', async ({ page }) => {
    const mock = new SocketIOMock(page);
    const gameShell = new GameShellPage(page);
    const loginPage = new LoginPage(page);
    const viewerPage = new ViewerPage(page);
    await mock.setup();

    // Register character-list handler
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
            missions: [
              {
                missionId: 'first-target',
                status: 'active',
              },
            ],
            preferredLocale: 'it',
          },
        ],
      },
    }));

    // Login with Italian locale by navigating to login with locale param
    const loginResponse = {
      success: true,
      message: 'Login successful',
      sessionKey: TEST_SESSION_KEY,
      playerId: 'player-id-001',
      preferredLocale: 'it',
    };

    mock.on('login', () => ({
      event: 'login-response',
      data: loginResponse,
    }));

    await page.goto('/(left:login)?locale=it');
    await mock.connected;

    await loginPage.playerNameInput.fill(TEST_PLAYER);
    await loginPage.passwordInput.fill('testpassword123');
    await loginPage.submitButton.click();

    mock.push('login-response', loginResponse);
    await expect(page).toHaveURL(/left:character-list/, { timeout: 10_000 });

    // Must join a game before viewer menu is enabled
    mock.on('game-join-request', () => null);
    mock.on('ship-list-by-owner-request', () => ({
      event: 'ship-list-by-owner-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        characterId: 'char-viewer-1',
        ships: [ACTIVE_SHIP],
      },
    }));
    const joinButton = gameShell.joinButton();
    await expect(joinButton).toBeVisible({ timeout: 10000 });
    await expect(joinButton).toBeEnabled({ timeout: 10000 });
    await gameShell.joinGame();
    await expect(page).toHaveURL(/left:game-main/, { timeout: 10000 });

    // Register solar system list handler
    mock.on('solar-system-list-request', () => ({
      event: 'solar-system-list-response',
      data: solarSystemListResponse([SOL_SYSTEM, ALPHA_CENTAURI_SYSTEM]),
    }));

    // Navigate to Viewer (use English label which is set first, more reliable)
    await gameShell.openViewer();

    // Verify system list displays
    const systemList = viewerPage.systemList;
    await expect(systemList).toBeVisible();

    // Check that system names are displayed (names are same in both locales)
    const solName = page.locator('.solar-system-item__name:has-text("Sol")');
    await expect(solName).toBeVisible();
  });
});
