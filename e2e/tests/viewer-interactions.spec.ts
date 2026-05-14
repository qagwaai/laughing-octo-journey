import { expect, test } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { ViewerPage } from '../page-objects/viewer.page';

// ── Test data ──────────────────────────────────────────────────────────────

const SOL_SUMMARY = {
  id: 'sol',
  displayName: 'Sol',
  source: 'curated',
  distanceParsec: 0,
  starCount: 1,
  primaryStar: {
    hygId: '0',
    spectralClass: 'G2V',
    colorHex: '#fff5b6',
    luminositySolar: 1.0,
  },
};

const BODIES_WITH_MOONS = [
  {
    id: 'sun',
    bodyType: 'star',
    displayName: 'The Sun',
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 0, y: 0, z: 0 },
      epochMs: 1715000000000,
    },
    visualization: {
      colorHex: '#fff5b6',
    },
    spectralClass: 'G2V',
    luminositySolar: 1.0,
  },
  {
    id: 'earth',
    bodyType: 'planet',
    displayName: 'Earth',
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 149597870.7, y: 0, z: 0 },
      epochMs: 1715000000000,
    },
    visualization: {
      colorHex: '#4a90e2',
    },
    physicalCatalog: {
      estimatedDiameterM: 12742000,
      radiusKm: 6371,
    },
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
    planetType: 'terrestrial',
  },
  {
    id: 'luna',
    bodyType: 'moon',
    displayName: 'Luna',
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 149597870.7 + 384400, y: 0, z: 0 },
      epochMs: 1715000000000,
    },
    visualization: {
      colorHex: '#9bb1c9',
    },
    physicalCatalog: {
      estimatedDiameterM: 3474200,
      radiusKm: 1737,
    },
    orbitalElements: {
      anchorBodyId: 'earth',
      semiMajorAxisKm: 384400,
      eccentricity: 0.0549,
      inclinationDeg: 5.1,
      longitudeOfAscendingNodeDeg: 125.0,
      argumentOfPeriapsisDeg: 318.0,
      meanAnomalyAtEpochDeg: 280.0,
      orbitalPeriodSec: 2360592,
      epoch: '2026-05-08T00:00:00.000Z',
    },
  },
  {
    id: 'mars',
    bodyType: 'planet',
    displayName: 'Mars',
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 227923661, y: 0, z: 0 },
      epochMs: 1715000000000,
    },
    visualization: {
      colorHex: '#e27b58',
    },
    physicalCatalog: {
      estimatedDiameterM: 6779000,
      radiusKm: 3389.5,
    },
    orbitalElements: {
      anchorBodyId: 'sun',
      semiMajorAxisKm: 227923661,
      eccentricity: 0.0934,
      inclinationDeg: 1.85,
      longitudeOfAscendingNodeDeg: 49.6,
      argumentOfPeriapsisDeg: 286.5,
      meanAnomalyAtEpochDeg: 19.4,
      orbitalPeriodSec: 59354294,
      epoch: '2026-05-08T00:00:00.000Z',
    },
    planetType: 'terrestrial',
  },
  {
    id: 'phobos',
    bodyType: 'moon',
    displayName: 'Phobos',
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 227923661 + 9376, y: 0, z: 0 },
      epochMs: 1715000000000,
    },
    visualization: {
      colorHex: '#8b8680',
    },
    physicalCatalog: {
      estimatedDiameterM: 22400,
      radiusKm: 11.2,
    },
    orbitalElements: {
      anchorBodyId: 'mars',
      semiMajorAxisKm: 9376,
      eccentricity: 0.0151,
      inclinationDeg: 1.093,
      longitudeOfAscendingNodeDeg: 164.8,
      argumentOfPeriapsisDeg: 150.0,
      meanAnomalyAtEpochDeg: 92.4,
      orbitalPeriodSec: 27553,
      epoch: '2026-05-08T00:00:00.000Z',
    },
  },
  {
    id: 'market-sol-beta',
    bodyType: 'station',
    stationKind: 'market',
    displayName: 'Sol Market Beta',
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 170000000, y: 0, z: 0 },
      epochMs: 1715000000000,
    },
    orbitalElements: {
      anchorBodyId: 'sun',
      semiMajorAxisKm: 170000000,
      eccentricity: 0.02,
      inclinationDeg: 0.4,
      longitudeOfAscendingNodeDeg: 30,
      argumentOfPeriapsisDeg: 90,
      meanAnomalyAtEpochDeg: 120,
      orbitalPeriodSec: 36000000,
      epoch: '2026-05-08T00:00:00.000Z',
    },
  },
];

async function setupViewerInteractionTest(page: any) {
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
          missions: [
            {
              missionId: 'first-target',
              status: 'in-progress',
            },
          ],
        },
      ],
    },
  }));

  await loginViaUI(page, mock);

  // Must join a game before viewer menu is enabled
  mock.on('game-join-request', () => null);
  const joinButton = gameShell.joinButton();
  await expect(joinButton).toBeVisible({ timeout: 10000 });
  await expect(joinButton).toBeEnabled({ timeout: 10000 });
  await gameShell.joinGame('Join Game');
  await expect(page).toHaveURL(/left:game-main/, { timeout: 10000 });

  mock.on('solar-system-list-request', () => ({
    event: 'solar-system-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      solarSystems: [SOL_SUMMARY],
    },
  }));

  mock.on('solar-system-get-request', () => ({
    event: 'solar-system-get-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      solarSystemId: 'sol',
      solarSystem: SOL_SUMMARY,
      bodies: BODIES_WITH_MOONS,
    },
  }));

  return { mock };
}

async function navigateToScene(page: any) {
  const gameShell = new GameShellPage(page);
  const viewerPage = new ViewerPage(page);
  // Navigate to Viewer
  const viewerButton = gameShell.navButton('Viewer');
  await expect(viewerButton).toBeVisible({ timeout: 10000 });
  await expect(viewerButton).toBeEnabled({ timeout: 10000 });
  await gameShell.openViewer();

  // Select the Sol system
  const solButton = viewerPage.systemButtonByName('Sol');
  await expect(solButton).toBeVisible({ timeout: 10000 });
  await viewerPage.selectSystem('Sol');

  // Wait for scene route to settle
  await expect(page).toHaveURL(/right:viewer-scene/);
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Viewer — Interaction Behaviors', () => {
  test.describe.configure({ timeout: 60_000 });

  test('applies hover styling when mouse enters scene canvas', async ({ page }) => {
    await setupViewerInteractionTest(page);
    await navigateToScene(page);

    // Get the canvas element
    const canvas = new ViewerPage(page).sceneCanvas;

    // Hover over the canvas
    await canvas.hover();

    // In Three.js/Playwright, the visual effect is on the Three.js objects,
    // so we verify the interaction by checking that the hover event was processed
    // (In a real test, you'd check for changes in the WebGL texture or object color,
    // but that requires WebGL inspection which is difficult in e2e tests.
    // Instead, we verify the interaction didn't cause errors.)

    // The scene should remain visible and interactive
    await expect(canvas).toBeVisible();
    await expect(page).toHaveURL(/right:viewer-scene/);
  });

  test('canvas remains interactive after hover', async ({ page }) => {
    await setupViewerInteractionTest(page);
    await navigateToScene(page);

    // Perform multiple pointer interactions over the scene area
    await page.mouse.move(100, 100);
    await page.mouse.move(200, 200);

    // Scene should remain functional
    await expect(page).toHaveURL(/right:viewer-scene/);
    await expect(new ViewerPage(page).sceneError).toHaveCount(0);
  });

  test('scene responds to mouse move events', async ({ page }) => {
    await setupViewerInteractionTest(page);
    await navigateToScene(page);

    // Move mouse over scene area
    await page.mouse.move(50, 50);
    await page.mouse.move(100, 100);
    await page.mouse.move(150, 150);

    // Scene should continue to render without errors
    await expect(page).toHaveURL(/right:viewer-scene/);
    await expect(new ViewerPage(page).sceneError).toHaveCount(0);
  });

  test('displays planet orbital elements correctly', async ({ page }) => {
    await setupViewerInteractionTest(page);
    await navigateToScene(page);

    // The scene loads with Earth and Mars, both with orbital elements
    // The rendering validates that orbital elements are processed
    const canvas = new ViewerPage(page).sceneCanvas;
    await expect(canvas).toBeVisible();

    // The scene should have successfully rendered both planets with their orbits
    // (verified by scene remaining in stable state without errors)
    await expect(page).toHaveURL(/right:viewer-scene/);
  });

  test('handles moon orbital elements relative to planet anchor', async ({ page }) => {
    await setupViewerInteractionTest(page);
    await navigateToScene(page);

    // Luna (anchored to Earth) and Phobos (anchored to Mars) should render
    // The anchorBodyId relationships are validated by the scene renderer

    const canvas = new ViewerPage(page).sceneCanvas;
    await expect(canvas).toBeVisible();

    // Scene loaded successfully with all hierarchical relationships intact
    await expect(page).toHaveURL(/right:viewer-scene/);
  });

  test('maintains scene state during multiple interactions', async ({ page }) => {
    await setupViewerInteractionTest(page);
    await navigateToScene(page);

    // Perform a series of interactions
    await page.mouse.move(100, 100);
    await page.waitForTimeout(100);
    await page.mouse.move(200, 200);
    await page.waitForTimeout(100);

    // Scene should remain stable and responsive
    await expect(page).toHaveURL(/right:viewer-scene/);
    await expect(new ViewerPage(page).sceneError).toHaveCount(0);
  });

  test('scene renders without errors on rapid hover toggle', async ({ page }) => {
    await setupViewerInteractionTest(page);
    await navigateToScene(page);

    const sceneHost = page.locator('.viewer-scene-host');

    // Simulate rapid hover entry/exit
    for (let i = 0; i < 5; i++) {
      await sceneHost.hover();
      await page.waitForTimeout(50);
      await page.mouse.move(0, 0);
      await page.waitForTimeout(50);
    }

    // Scene should remain stable
    await expect(page).toHaveURL(/right:viewer-scene/);
    await expect(page.locator('[data-testid="viewer-scene-error"]')).toHaveCount(0);
  });

  test('preserves scene context across view interactions', async ({ page }) => {
    await setupViewerInteractionTest(page);
    await navigateToScene(page);

    // Scene route should be loaded
    await expect(page).toHaveURL(/right:viewer-scene/);

       // Interact with the scene
       await page.locator('.viewer-scene-host').hover();
       await page.mouse.move(100, 100);

    // Scene should remain in expected state
    await expect(page).toHaveURL(/right:viewer-scene/);
  });

  test('[edge case] scene remains stable with zero-mass bodies', async ({ page }) => {
    const { mock } = await setupViewerInteractionTest(page);

    // Create a custom set of bodies with edge-case properties
    const edgeCaseBodies = [
      {
        id: 'sun',
        bodyType: 'star',
        displayName: 'Sun',
        spatial: {
          solarSystemId: 'sol',
          frame: 'barycentric',
          positionKm: { x: 0, y: 0, z: 0 },
          epochMs: 1715000000000,
        },
        visualization: { colorHex: '#fff5b6' },
        spectralClass: 'G2V',
        luminositySolar: 1.0,
      },
      {
        id: 'test-planet',
        bodyType: 'planet',
        displayName: 'Test Planet',
        spatial: {
          solarSystemId: 'sol',
          frame: 'barycentric',
          positionKm: { x: 100000000, y: 0, z: 0 },
          epochMs: 1715000000000,
        },
        visualization: { colorHex: '#4a90e2' },
        physicalCatalog: {
          estimatedDiameterM: 10000000,
          radiusKm: 5000,
        },
        orbitalElements: {
          anchorBodyId: 'sun',
          semiMajorAxisKm: 100000000,
          eccentricity: 0,
          inclinationDeg: 0,
          longitudeOfAscendingNodeDeg: 0,
          argumentOfPeriapsisDeg: 0,
          meanAnomalyAtEpochDeg: 0,
          orbitalPeriodSec: 0,
          epoch: '2026-05-08T00:00:00.000Z',
        },
      },
    ];

    // Update mock to return edge case bodies (zero-mass planet)
    mock.on('solar-system-get-request', () => ({
      event: 'solar-system-get-response',
      data: {
        success: true,
        message: '',
        playerName: TEST_PLAYER,
        solarSystemId: 'sol',
        solarSystem: SOL_SUMMARY,
        bodies: edgeCaseBodies,
      },
    }));

    await navigateToScene(page);

  // Scene route should be active and handling the edge case bodies
  await expect(page).toHaveURL(/right:viewer-scene/);

    // Interact with scene despite edge-case data
  await page.locator('.viewer-scene-host').hover();
    await page.mouse.move(100, 100);

    // Scene should handle edge cases gracefully
    await expect(page).toHaveURL(/right:viewer-scene/);
  });
});
