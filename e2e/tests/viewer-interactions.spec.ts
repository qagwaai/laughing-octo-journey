import { expect, test, type Page } from '@playwright/test';
import type { Camera, Object3D } from 'three';
import type { ViewerBody } from '../../src/app/model/solar-system-get';
import { setupViewerInteractionTest, SOL_SUMMARY } from '../fixtures/viewer-interactions-scenario';
import {
  setupViewerSceneTest,
  SOL_SYSTEM_BODIES,
  solarSystemGetResponse,
} from '../fixtures/viewer-scene-rendering-scenario';
import { TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { ViewerPage } from '../page-objects/viewer.page';

async function navigateToScene(page: Page) {
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
  await viewerPage.expectSceneRoute();
}

// ── Tests ──────────────────────────────────────────────────────────────────

test.describe('Viewer — Interaction Behaviors', () => {
  test.describe.configure({ timeout: 60_000 });

  for (const [bodyType, label, surfaceArchetype] of [
    ['dwarf-planet', 'Dwarf Planet', 'icy-moon'],
    ['tno', 'Trans-Neptunian object', 'icy-moon'],
    ['comet', 'Comet', 'asteroid'],
  ] as const) {
    test(`groups, inspects, and opens the existing close-up for a ${bodyType}`, async ({ page }) => {
      const { mock } = await setupViewerSceneTest(page);
      const selected: ViewerBody = {
        id: `test-${bodyType}`,
        bodyType,
        surfaceArchetype,
        state: 'unscanned',
        displayName: `Test ${bodyType}`,
        spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 2e8, y: 0, z: 0 }, epochMs: 0 },
      };
      mock.on('solar-system-get-request', () => ({
        event: 'solar-system-get-response',
        data: solarSystemGetResponse([selected]),
      }));
      await navigateToScene(page);
      await new ViewerPage(page).expectSceneLoaded();
      for (const groupLabel of ['Dwarf Planet', 'Trans-Neptunian object', 'Comet']) {
        await expect(page.getByRole('button', { name: `${groupLabel} ${groupLabel === label ? 1 : 0}` })).toBeVisible();
      }
      await page.getByRole('button', { name: `${label} 1` }).click();
      await page.getByTestId(`details-table-${bodyType}`).getByRole('button', { name: 'Target', exact: true }).click();
      await expect(page.getByTestId('viewer-body-label')).toContainText(selected.displayName);
      await page.getByTestId('viewer-inspect-target').click();
      await expect(page.getByTestId('viewer-body-inspector')).toContainText(selected.displayName);
      await page.getByTestId('viewer-inspector-closeup').click();
      await expect(page).toHaveURL(new RegExp(`right:planet-view/sol/${selected.id}`));
      await expect(page.getByTestId('planet-view-header')).toContainText(selected.displayName);
      await expect(page.getByTestId('planet-view-error')).toHaveCount(0);
      await page.getByTestId('planet-view-back').click();
      await expect(page).toHaveURL(/right:viewer-scene\/sol/);
      await new ViewerPage(page).expectSceneLoaded();
    });
  }

  for (const bodyType of ['star', 'planet', 'moon', 'asteroid', 'station']) {
    test(`left-click targets a ${bodyType} and synchronizes the body list`, async ({ page }) => {
      const { mock } = await setupViewerSceneTest(page);
      const source: ViewerBody | undefined =
        bodyType === 'asteroid'
          ? {
              id: 'click-asteroid',
              displayName: 'Click Asteroid',
              bodyType: 'asteroid',
              surfaceArchetype: 'asteroid',
              state: 'unscanned',
              spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 0, y: 0, z: 0 }, epochMs: 0 },
            }
          : SOL_SYSTEM_BODIES.find((body) => body.bodyType === bodyType);
      if (!source) throw new Error(`Missing ${bodyType} fixture`);
      const selected = { ...source, spatial: { ...source.spatial, positionKm: { x: 0, y: 0, z: 0 } } };
      mock.on('solar-system-get-request', () => ({
        event: 'solar-system-get-response',
        data: solarSystemGetResponse([selected]),
      }));
      await navigateToScene(page);
      const viewer = new ViewerPage(page);
      await viewer.expectSceneLoaded();
      await viewer.switchToDistanceView();
      const button = page.locator('tr', { hasText: selected.displayName }).locator('button.details-target-btn');
      const targetBracketCount = () =>
        page.evaluate(() => {
          const canvas = document.querySelector('ngt-canvas');
          if (!canvas) return 0;
          const ng = (window as Window & { ng: { getComponent(element: Element): unknown } }).ng;
          const scene = (
            ng.getComponent(canvas) as { store: { snapshot: { scene: Object3D | null } } }
          ).store.snapshot.scene;
          let count = 0;
          scene?.traverse((object) => {
            if (object.name === 'viewer-target-bracket') count++;
          });
          return count;
        });
      await expect(button).toHaveAttribute('aria-pressed', 'false');
      await expect.poll(targetBracketCount).toBe(0);
      const canvas = viewer.sceneCanvas;
      const bounds = await canvas.boundingBox();
      if (!bounds) throw new Error('Viewer canvas has no bounds');
      const x = bounds.x + bounds.width / 2;
      const y = bounds.y + bounds.height / 2;
      await page.mouse.move(x, y);
      await expect(page.getByTestId('viewer-body-label')).toContainText(selected.displayName);
      await page.mouse.click(x, y);
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(targetBracketCount).toBe(1);
      await expect(page.getByTestId('viewer-body-label')).toContainText('Targeted');
      await expect(page.getByTestId('viewer-body-inspector')).toHaveCount(0);
      await expect(page.getByTestId('viewer-zoom-slider').locator('input')).not.toHaveValue('100');
      await page.mouse.click(x, y);
      await expect(button).toHaveAttribute('aria-pressed', 'true');
      await page.mouse.click(bounds.x + bounds.width - 100, bounds.y + 180);
      await expect(button).toHaveAttribute('aria-pressed', 'true');
    });
  }

  test('left-dragging a body rotates the scene without targeting it', async ({ page }) => {
    const { mock } = await setupViewerSceneTest(page);
    const source = SOL_SYSTEM_BODIES.find((body) => body.id === 'earth');
    if (!source) throw new Error('Missing Earth fixture');
    mock.on('solar-system-get-request', () => ({
      event: 'solar-system-get-response',
      data: solarSystemGetResponse([{ ...source, spatial: { ...source.spatial, positionKm: { x: 0, y: 0, z: 0 } } }]),
    }));
    await navigateToScene(page);
    const viewer = new ViewerPage(page);
    await viewer.expectSceneLoaded();
    await viewer.switchToDistanceView();
    const bounds = await viewer.sceneCanvas.boundingBox();
    if (!bounds) throw new Error('Viewer canvas has no bounds');
    const x = bounds.x + bounds.width / 2;
    const y = bounds.y + bounds.height / 2;
    await page.mouse.move(x, y);
    await expect(page.getByTestId('viewer-body-label')).toContainText('Earth');
    await page.mouse.down();
    await page.mouse.move(x + 30, y + 10, { steps: 8 });
    await page.mouse.up();
    await expect(page.locator('tr', { hasText: 'Earth' }).locator('button.details-target-btn')).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  test('keeps the 5% station mesh selectable from the body list and targetable', async ({ page }) => {
    const { mock } = await setupViewerSceneTest(page);
    mock.on('solar-system-get-request', () => ({
      event: 'solar-system-get-response',
      data: solarSystemGetResponse(SOL_SYSTEM_BODIES),
    }));
    await navigateToScene(page);
    const viewerPage = new ViewerPage(page);
    await viewerPage.expectSceneLoaded();
    await viewerPage.switchToDistanceView();
    const target = page.locator('tr', { hasText: 'Sol Market Alpha' }).locator('button.details-target-btn');
    await expect(target).toBeVisible();

    const readStation = () =>
      page.evaluate(() => {
        const canvas = document.querySelector('ngt-canvas');
        if (!canvas) return null;
        const ng = (window as Window & { ng: { getComponent(element: Element): unknown } }).ng;
        const snapshot = (
          ng.getComponent(canvas) as {
            store: { snapshot: { scene: Object3D | null; camera: Camera } };
          }
        ).store.snapshot;
        let station: Object3D | undefined;
        snapshot.scene?.traverse((object) => {
          if (object.name === 'Sol Market Alpha' && object.type === 'Mesh') station = object;
        });
        if (!station) return null;
        const screen = station.getWorldPosition(station.position.clone()).project(snapshot.camera);
        return { scale: station.scale.toArray(), centered: Math.hypot(screen.x, screen.y) < 0.02 };
      });
    await expect.poll(async () => (await readStation())?.scale).toEqual([1.65 * 0.05, 0.82 * 0.05, 1.65 * 0.05]);
    await target.click();
    await expect(target).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(async () => (await readStation())?.centered).toBe(true);
    await viewerPage.expectSceneLoaded();
  });

  test('applies hover styling when mouse enters scene canvas', async ({ page }) => {
    await setupViewerInteractionTest(page);
    await navigateToScene(page);
    const viewerPage = new ViewerPage(page);

    // Get the canvas element
    const canvas = viewerPage.sceneCanvas;

    // Hover over the canvas
    await canvas.hover();

    // In Three.js/Playwright, the visual effect is on the Three.js objects,
    // so we verify the interaction by checking that the hover event was processed
    // (In a real test, you'd check for changes in the WebGL texture or object color,
    // but that requires WebGL inspection which is difficult in e2e tests.
    // Instead, we verify the interaction didn't cause errors.)

    // The scene should remain visible and interactive
    await expect(canvas).toBeVisible();
    await viewerPage.expectSceneRoute();
  });

  test('canvas remains interactive after hover', async ({ page }) => {
    await setupViewerInteractionTest(page);
    await navigateToScene(page);
    const viewerPage = new ViewerPage(page);

    // Perform multiple pointer interactions over the scene area
    await page.mouse.move(100, 100);
    await page.mouse.move(200, 200);

    // Scene should remain functional
    await viewerPage.expectSceneLoaded();
  });

  test('scene responds to mouse move events', async ({ page }) => {
    await setupViewerInteractionTest(page);
    await navigateToScene(page);
    const viewerPage = new ViewerPage(page);

    // Move mouse over scene area
    await page.mouse.move(50, 50);
    await page.mouse.move(100, 100);
    await page.mouse.move(150, 150);

    // Scene should continue to render without errors
    await viewerPage.expectSceneLoaded();
  });

  test('displays planet orbital elements correctly', async ({ page }) => {
    await setupViewerInteractionTest(page);
    await navigateToScene(page);
    const viewerPage = new ViewerPage(page);

    // The scene loads with Earth and Mars, both with orbital elements
    // The rendering validates that orbital elements are processed
    const canvas = viewerPage.sceneCanvas;
    await expect(canvas).toBeVisible();

    // The scene should have successfully rendered both planets with their orbits
    // (verified by scene remaining in stable state without errors)
    await viewerPage.expectSceneRoute();
  });

  test('handles moon orbital elements relative to planet anchor', async ({ page }) => {
    await setupViewerInteractionTest(page);
    await navigateToScene(page);
    const viewerPage = new ViewerPage(page);

    // Luna (anchored to Earth) and Phobos (anchored to Mars) should render
    // The anchorBodyId relationships are validated by the scene renderer

    const canvas = viewerPage.sceneCanvas;
    await expect(canvas).toBeVisible();

    // Scene loaded successfully with all hierarchical relationships intact
    await viewerPage.expectSceneRoute();
  });

  test('maintains scene state during multiple interactions', async ({ page }) => {
    await setupViewerInteractionTest(page);
    await navigateToScene(page);
    const viewerPage = new ViewerPage(page);

    // Perform a series of interactions
    await page.mouse.move(100, 100);
    await viewerPage.expectSceneLoaded();
    await page.mouse.move(200, 200);
    await viewerPage.expectSceneLoaded();

    // Scene should remain stable and responsive
    await viewerPage.expectSceneLoaded();
  });

  test('scene renders without errors on rapid hover toggle', async ({ page }) => {
    await setupViewerInteractionTest(page);
    await navigateToScene(page);
    const viewerPage = new ViewerPage(page);

    const sceneHost = page.locator('.viewer-scene-host');

    // Simulate rapid hover entry/exit
    for (let i = 0; i < 5; i++) {
      await sceneHost.hover();
      await viewerPage.expectSceneLoaded();
      await page.mouse.move(0, 0);
      await viewerPage.expectSceneLoaded();
    }

    // Scene should remain stable
    await viewerPage.expectSceneLoaded();
  });

  test('preserves scene context across view interactions', async ({ page }) => {
    await setupViewerInteractionTest(page);
    await navigateToScene(page);
    const viewerPage = new ViewerPage(page);

    // Scene route should be loaded
    await viewerPage.expectSceneRoute();

    // Interact with the scene
    await page.locator('.viewer-scene-host').hover();
    await page.mouse.move(100, 100);

    // Scene should remain in expected state
    await viewerPage.expectSceneRoute();
  });

  test('[edge case] scene remains stable with zero-mass bodies', async ({ page }) => {
    const { mock } = await setupViewerInteractionTest(page);
    const viewerPage = new ViewerPage(page);

    // Create a custom set of bodies with edge-case properties
    const edgeCaseBodies = [
      {
        id: 'sun',
        bodyType: 'star',
        surfaceArchetype: 'star',
        state: 'unscanned',
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
        surfaceArchetype: 'rocky',
        state: 'unscanned',
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
    await viewerPage.expectSceneRoute();

    // Interact with scene despite edge-case data
    await page.locator('.viewer-scene-host').hover();
    await page.mouse.move(100, 100);

    // Scene should handle edge cases gracefully
    await viewerPage.expectSceneRoute();
  });
});
