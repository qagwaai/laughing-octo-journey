import { expect, test, type Page } from '@playwright/test';
import type { Mesh, MeshStandardMaterial, PerspectiveCamera, Scene } from 'three';
import type { MarketSummary } from '../../src/app/model/market-list';
import type { ViewerBody } from '../../src/app/model/solar-system-get';
import { setupViewerSceneTest, solarSystemGetResponse } from '../fixtures/viewer-scene-rendering-scenario';
import { GameShellPage } from '../page-objects/game-shell.page';
import { ViewerPage } from '../page-objects/viewer.page';

const marsStation: ViewerBody = {
  id: 'sol-mars-orbit',
  bodyType: 'station',
  stationKind: 'market',
  displayName: 'Mars Orbital Market',
  spatial: { solarSystemId: 'sol', frame: 'barycentric', positionKm: { x: 0, y: 0, z: 0 }, epochMs: 0 },
};
const genericStation: ViewerBody = {
  ...marsStation,
  id: 'another-mars-station',
  displayName: 'Other Mars Station',
  spatial: { ...marsStation.spatial, positionKm: { x: 149597870, y: 0, z: 0 } },
};

function stationMarket(body: ViewerBody): MarketSummary {
  return {
    marketId: body.id,
    solarSystemId: body.spatial.solarSystemId,
    marketName: body.displayName,
    siteType: 'station',
    siteName: body.displayName,
    spatial: { ...body.spatial, frame: 'barycentric' },
    trajectory: body.orbitalElements ? { kind: 'orbital-elements', orbit: body.orbitalElements } : undefined,
    priceMultiplier: 1,
    driftPercentPerHour: 0,
    restockIntervalMinutes: 60,
  };
}

async function openSystem(page: Page, bodies: ViewerBody[] = [], station = marsStation) {
  const { mock } = await setupViewerSceneTest(page);
  mock.on('solar-system-get-request', () => ({
    event: 'solar-system-get-response',
    data: solarSystemGetResponse(bodies),
  }));
  mock.on('market-list-by-location-request', () => ({
    event: 'market-list-by-location-response',
    data: { success: true, markets: [stationMarket(station), stationMarket(genericStation)] },
  }));
  await new GameShellPage(page).openViewer();
  const viewer = new ViewerPage(page);
  await viewer.selectSystem('Sol');
  await viewer.expectSceneLoaded();
  await viewer.switchToDistanceView();
  return { mock, viewer };
}

async function readScene(page: Page) {
  return page.evaluate(() => {
    const api = (window as Window & { ng: { getComponent: (element: Element) => unknown } }).ng;
    const canvas = document.querySelector('app-viewer-scene-page ngt-canvas, app-station-view-page ngt-canvas');
    if (!canvas) throw new Error('Viewer canvas is missing.');
    const component = api.getComponent(canvas) as { store: { snapshot: { scene: Scene; camera: PerspectiveCamera } } };
    const { scene, camera } = component.store.snapshot;
    let models = 0;
    let triangles = 0;
    let hoveredHighlight = false;
    let stationHeightPixels = 0;
    let stationCentered = false;
    let stationScreen: { x: number; y: number } | null = null;
    scene.traverse((object) => {
      if (object.name === 'dedicated-station-model') {
        models++;
        const center = object.getWorldPosition(object.position.clone()).project(camera);
        const bounds = canvas.getBoundingClientRect();
        stationCentered = Math.hypot(center.x, center.y) < 0.02;
        stationScreen = {
          x: bounds.x + ((center.x + 1) * bounds.width) / 2,
          y: bounds.y + ((1 - center.y) * bounds.height) / 2,
        };
        object.traverse((child) => {
          const mesh = child as Mesh;
          if (mesh.isMesh && mesh.geometry) {
            mesh.geometry.computeBoundingBox();
            const box = mesh.geometry.boundingBox;
            if (box) {
              const heights: number[] = [];
              for (const x of [box.min.x, box.max.x]) {
                for (const y of [box.min.y, box.max.y]) {
                  for (const z of [box.min.z, box.max.z]) {
                    heights.push(mesh.position.clone().set(x, y, z).applyMatrix4(mesh.matrixWorld).project(camera).y);
                  }
                }
              }
              stationHeightPixels = Math.max(
                stationHeightPixels,
                ((Math.max(...heights) - Math.min(...heights)) * bounds.height) / 2,
              );
            }
            triangles += (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3;
            const material = mesh.material as MeshStandardMaterial;
            if (material.emissive?.getHexString() === '8f0000') hoveredHighlight = true;
          }
        });
      }
    });
    return {
      models,
      triangles,
      genericPresent: !!scene.getObjectByName('Other Mars Station'),
      marsGenericPresent: !!scene.getObjectByName('Mars Orbital Market'),
      camera: camera.position.toArray(),
      cameraNear: camera.near,
      stationScreen,
      hoveredHighlight,
      stationHeightPixels,
      stationCentered,
    };
  });
}

test.describe('Station-specific viewer models', () => {
  test.setTimeout(120_000);

  test('frames an anchored market visibly with Mars and both moons present', async ({ page }, testInfo) => {
    const mars: ViewerBody = {
      id: 'sol-mars',
      bodyType: 'planet',
      displayName: 'Mars',
      surfaceArchetype: 'rocky',
      state: 'unscanned',
      physicalCatalog: { radiusKm: 3389.5 },
      spatial: { ...marsStation.spatial, positionKm: { x: 227923661, y: 0, z: 0 } },
    };
    const station: ViewerBody = {
      ...marsStation,
      spatial: { ...mars.spatial, positionKm: { x: 227923661, y: -3800, z: 0 } },
      orbitalElements: {
        anchorBodyId: mars.id,
        semiMajorAxisKm: 3800,
        eccentricity: 0.02,
        inclinationDeg: 0,
        longitudeOfAscendingNodeDeg: 0,
        argumentOfPeriapsisDeg: 0,
        meanAnomalyAtEpochDeg: 92,
        orbitalPeriodSec: 130000,
        epoch: '2026-01-01T00:00:00.000Z',
      },
    };
    const moons: ViewerBody[] = [9376, 23463].map((offset, index) => ({
      id: `mars-moon-${index}`,
      bodyType: 'moon',
      displayName: index === 0 ? 'Phobos' : 'Deimos',
      surfaceArchetype: 'rocky-moon',
      state: 'unscanned',
      physicalCatalog: { radiusKm: index === 0 ? 11.3 : 6.2 },
      spatial: { ...mars.spatial, positionKm: { x: 227923661 + (index === 0 ? offset : -offset), y: 0, z: 0 } },
      orbitalElements: { ...station.orbitalElements!, anchorBodyId: mars.id, semiMajorAxisKm: offset },
    }));
    await openSystem(page, [mars, ...moons], station);
    await expect(page.getByTestId('viewer-station-status')).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
    const target = page.locator('tr', { hasText: station.displayName }).locator('button.details-target-btn');
    await target.click();
    await expect(page.getByTestId('viewer-zoom-slider').locator('input')).toHaveValue('0', { timeout: 15_000 });
    await expect.poll(async () => (await readScene(page)).stationCentered).toBe(true);
    await expect.poll(async () => (await readScene(page)).stationHeightPixels).toBeGreaterThan(60);
    const panel = await page.getByTestId('viewer-info-panel').boundingBox();
    const center = (await readScene(page)).stationScreen;
    expect(panel).not.toBeNull();
    expect(center).not.toBeNull();
    expect(panel!.y).toBeGreaterThan(center!.y + (await readScene(page)).stationHeightPixels / 2 + 8);
    // Hover must reach the imported station, rather than the host or a moon.
    await expect
      .poll(async () => {
        const point = (await readScene(page)).stationScreen;
        if (!point) return false;
        await page.mouse.move(point.x, point.y);
        return readScene(page);
      })
      .toMatchObject({ hoveredHighlight: true });
    await page.getByTestId('viewer-inspect-target').click();
    await expect(page.getByTestId('viewer-body-inspector')).toBeVisible();
    await expect(page.getByTestId('viewer-inspector-orbit')).toContainText('sol-mars');
    const canvasHost = page.locator('app-viewer-scene-page ngt-canvas');
    await expect
      .poll(async () => {
        const host = await canvasHost.boundingBox();
        const canvas = await canvasHost.locator('canvas').boundingBox();
        return !!host && !!canvas && Math.abs(host.width - canvas.width) < 1;
      })
      .toBe(true);
    await expect.poll(async () => (await readScene(page)).stationCentered).toBe(true);
    await expect.poll(async () => (await readScene(page)).stationHeightPixels).toBeGreaterThan(60);
    const dockedPanel = await page.getByTestId('viewer-info-panel').boundingBox();
    const dockedStation = await readScene(page);
    expect(dockedPanel!.y).toBeGreaterThan(dockedStation.stationScreen!.y + dockedStation.stationHeightPixels / 2 + 8);
    expect((await readScene(page)).cameraNear).toBe(0.001);
    await page.screenshot({ path: testInfo.outputPath('station-target-framing.png') });
  });

  for (const quality of ['standard', 'low'] as const) {
    test(`uses the ${quality} model only for the registered station and opens its close-up`, async ({ page }) => {
      await page.addInitScript((quality) => {
        Object.defineProperty(navigator, 'hardwareConcurrency', {
          configurable: true,
          value: quality === 'standard' ? 8 : 4,
        });
      }, quality);
      const requests: string[] = [];
      const errors: string[] = [];
      page.on('request', (request) => {
        if (/station-.*\.glb/.test(request.url())) requests.push(request.url());
      });
      page.on('pageerror', (error) => errors.push(error.message));
      await openSystem(page);
      const status = page.getByTestId('viewer-station-status');
      await expect(status).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
      await expect(status).toHaveAttribute('data-quality', quality);
      await expect
        .poll(() => readScene(page))
        .toMatchObject({
          models: 1,
          triangles: quality === 'standard' ? 139330 : 74695,
          genericPresent: true,
          marsGenericPresent: false,
        });
      expect(requests).toHaveLength(1);
      expect(requests[0]).toContain(quality === 'standard' ? 'station-150k.glb' : 'station-75k.glb');

      const otherTarget = page.locator('tr', { hasText: 'Other Mars Station' }).locator('button.details-target-btn');
      await otherTarget.click();
      await expect.poll(async () => (await readScene(page)).cameraNear).toBe(0.1);
      await page.getByTestId('viewer-inspect-target').click();
      await expect(page.getByTestId('viewer-inspector-closeup')).toHaveCount(0);
      await page.getByTestId('viewer-inspector-close').click();
      const marsTarget = page.locator('tr', { hasText: 'Mars Orbital Market' }).locator('button.details-target-btn');
      await marsTarget.click();
      await expect(marsTarget).toHaveAttribute('aria-pressed', 'true');
      await expect
        .poll(async () => {
          const point = (await readScene(page)).stationScreen;
          if (!point) return false;
          await page.mouse.move(point.x, point.y);
          return (await readScene(page)).hoveredHighlight;
        })
        .toBe(true);
      const point = (await readScene(page)).stationScreen;
      if (!point) throw new Error('Station projection is missing.');
      await page.mouse.click(point.x, point.y);
      await expect(marsTarget).toHaveAttribute('aria-pressed', 'true');
      await page.getByTestId('viewer-inspect-target').click();
      await page.getByTestId('viewer-inspector-closeup').click();
      await expect(page).toHaveURL(/right:station-view\/sol\/sol-mars-orbit/);
      const closeup = page.getByTestId('station-view-status');
      await expect(closeup).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
      await expect(closeup).toHaveAttribute('data-quality', quality);
      await expect
        .poll(() => readScene(page))
        .toMatchObject({ models: 1, triangles: quality === 'standard' ? 139330 : 74695 });
      const before = (await readScene(page)).camera;
      const canvas = page.locator('app-station-view-page canvas').first();
      const box = await canvas.boundingBox();
      if (!box) throw new Error('Station close-up canvas has no bounds.');
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await page.mouse.down();
      await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.55, { steps: 6 });
      await page.mouse.up();
      await expect.poll(async () => (await readScene(page)).camera).not.toEqual(before);
      const orbitPosition = (await readScene(page)).camera;
      await page.mouse.wheel(0, -200);
      await expect.poll(async () => (await readScene(page)).camera).not.toEqual(orbitPosition);
      await page.getByRole('button', { name: 'Back to system viewer' }).click();
      await expect(page).toHaveURL(/right:viewer-scene\/sol/);
      await expect(status).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
      await expect.poll(() => readScene(page)).toMatchObject({ models: 1, genericPresent: true });
      expect(errors).toEqual([]);
    });
  }

  test('shows no replacement geometry while loading or after failure and retries the selected tier', async ({
    page,
  }) => {
    let releaseRequest!: () => void;
    const pending = new Promise<void>((resolve) => {
      releaseRequest = resolve;
    });
    await page.route('**/models/sol-mars-station-*.glb*', async (route) => {
      await pending;
      await route.abort('failed');
    });
    await openSystem(page);
    await expect(page.getByTestId('viewer-station-status')).toHaveAttribute('data-state', 'loading');
    expect(await readScene(page)).toMatchObject({ models: 0, marsGenericPresent: false, genericPresent: true });
    releaseRequest();
    await expect(page.getByTestId('viewer-station-status')).toHaveAttribute('data-state', 'error', { timeout: 30_000 });
    await expect(page.getByRole('alert')).toContainText('The station model could not be loaded.');
    expect(await readScene(page)).toMatchObject({ models: 0, marsGenericPresent: false, genericPresent: true });
    await page.unroute('**/models/sol-mars-station-*.glb*');
    await page.getByRole('button', { name: 'Retry station model' }).click();
    await expect(page.getByTestId('viewer-station-status')).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
    await expect.poll(() => readScene(page)).toMatchObject({ models: 1, genericPresent: true });
  });

  test('rehydrates a direct close-up from its market identifier, reports load failures, and rejects unknown stations', async ({
    page,
  }) => {
    const { mock } = await setupViewerSceneTest(page);
    const market = stationMarket(marsStation);
    mock.on('solar-system-get-request', () => ({
      event: 'solar-system-get-response',
      data: solarSystemGetResponse([]),
    }));
    mock.on('market-list-by-location-request', () => ({
      event: 'market-list-by-location-response',
      data: { success: true, markets: [market] },
    }));
    await page.route('**/models/sol-mars-station-*.glb*', (route) => route.abort('failed'));
    await page.goto('/splash(left:viewer//right:station-view/sol/sol-mars-orbit)');
    await expect(page.getByRole('heading', { name: 'Mars Orbital Market' })).toBeVisible();
    const status = page.getByTestId('station-view-status');
    await expect(status).toHaveAttribute('data-state', 'error', { timeout: 30_000 });
    expect((await readScene(page)).models).toBe(0);
    await page.unroute('**/models/sol-mars-station-*.glb*');
    await page.getByRole('button', { name: 'Retry station model' }).click();
    await expect(status).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
    await expect.poll(async () => (await readScene(page)).models).toBe(1);
    await page.goto('/splash(left:viewer//right:station-view/sol/another-mars-station)');
    await expect(page.getByTestId('station-view-error')).toContainText(
      'No dedicated model is available for this station.',
    );
    await expect(page.locator('app-station-view-page canvas')).toHaveCount(0);
  });
});

test.describe('Touch-accessible station close-ups', () => {
  test.use({ hasTouch: true, viewport: { width: 1180, height: 820 } });

  test('opens and leaves the station close-up using visible buttons', async ({ page }) => {
    await openSystem(page);
    await page.locator('tr', { hasText: 'Mars Orbital Market' }).locator('button.details-target-btn').tap();
    await expect(page.getByTestId('viewer-info-panel').getByRole('button', { name: 'Open close-up' })).toHaveCount(0);
    await page.getByTestId('viewer-inspect-target').tap();
    await page.getByRole('button', { name: 'Open close-up', exact: true }).tap();
    await expect(page).toHaveURL(/right:station-view\/sol\/sol-mars-orbit/);
    await expect(page.getByTestId('station-view-status')).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
    await page.getByRole('button', { name: 'Back to system viewer' }).tap();
    await new ViewerPage(page).expectSceneRoute();
  });
});
