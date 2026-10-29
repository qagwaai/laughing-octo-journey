import { expect, test } from '@playwright/test';
import type { Camera, Mesh, MeshStandardMaterial, Scene } from 'three';
import type { ViewerBody } from '../../src/app/model/solar-system-get';
import { setupPlanetViewZoomViewer } from '../fixtures/planet-view-zoom-scenario';
import { SocketIOMock } from '../fixtures/socket-mock';
import {
  SOL_SYSTEM_BODIES,
  setupViewerSceneTest,
  solarSystemGetResponse,
} from '../fixtures/viewer-scene-rendering-scenario';
import { GameShellPage } from '../page-objects/game-shell.page';
import { PlanetViewPage } from '../page-objects/planet-view.page';
import { ViewerPage } from '../page-objects/viewer.page';

/**
 * Behaviour-level cover for the viewer's generated planet surfaces.
 *
 * The CPU/GPU parity spec compiles the shader through raw WebGL2, so it cannot
 * see failures in the way three.js delivers that shader. These tests drive the
 * real bake path in the real scenes instead.
 */

const SHADER_FAILURE = /Shader Error|not compiled|WebGLProgram|INVALID_OPERATION/i;

function collectRenderProblems(page: import('@playwright/test').Page): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    const type = message.type();
    if (type === 'error' || type === 'warning') {
      problems.push(message.text());
    }
  });
  page.on('pageerror', (error) => problems.push(error.message));
  return problems;
}

async function navigateToSystemScene(
  page: import('@playwright/test').Page,
  mock: SocketIOMock,
  bodies: ViewerBody[] = SOL_SYSTEM_BODIES,
) {
  const gameShell = new GameShellPage(page);
  const viewerPage = new ViewerPage(page);

  await gameShell.openViewer();
  mock.on('solar-system-get-request', () => ({
    event: 'solar-system-get-response',
    data: solarSystemGetResponse(bodies),
  }));
  await viewerPage.selectSystem('Sol');
  await viewerPage.expectSceneLoaded();
}

/**
 * Enters the planet detail view through the component's own request handler,
 * matching how planet-view-zoom.spec.ts reaches the same screen.
 */
async function enterPlanetViewViaSceneComponent(page: import('@playwright/test').Page, bodyId = 'earth') {
  await page.waitForFunction((bodyId) => {
    const ngApi = (window as Window & { ng?: { getComponent?: (node: Element) => unknown } }).ng;
    const host = document.querySelector('app-viewer-scene-page');
    if (!ngApi?.getComponent || !host) return false;

    const component = ngApi.getComponent(host) as {
      bodies?: () => Array<{ id: string }>;
      onPlanetViewRequest?: (body: unknown) => void;
    };
    if (typeof component?.bodies !== 'function' || typeof component?.onPlanetViewRequest !== 'function') {
      return false;
    }
    return component.bodies().some((body) => body.id === bodyId);
  }, bodyId);

  await page.evaluate((bodyId) => {
    const ngApi = (window as Window & { ng?: { getComponent?: (node: Element) => unknown } }).ng;
    const host = document.querySelector('app-viewer-scene-page');
    if (!ngApi?.getComponent || !host) {
      throw new Error('viewer scene component not available');
    }

    const component = ngApi.getComponent(host) as {
      bodies: () => Array<{ id: string }>;
      onPlanetViewRequest: (body: unknown) => void;
    };

    const body = component.bodies().find((body) => body.id === bodyId);
    if (!body) {
      throw new Error(`${bodyId} body not found`);
    }

    component.onPlanetViewRequest(body);
  }, bodyId);

  await expect(page).toHaveURL(new RegExp(`right:planet-view/sol/${bodyId}`));
}

function catalogBodies(): ViewerBody[] {
  return SOL_SYSTEM_BODIES.map((body: ViewerBody) => {
    if (!['earth', 'luna', 'mars'].includes(body.id)) return body;
    return {
      ...body,
      surfaceArchetype: body.id === 'earth' ? 'ocean' : body.surfaceArchetype,
      catalogIdentity: { namespace: 'sol', key: body.id },
    };
  });
}

function ioBody(): ViewerBody {
  return {
    id: 'io',
    bodyType: 'moon',
    surfaceArchetype: 'rocky-moon',
    state: 'unscanned',
    displayName: 'Io',
    catalogIdentity: { namespace: 'sol', key: 'io' },
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 778_121_700, y: 0, z: 0 },
      epochMs: 1715000000000,
    },
    physicalCatalog: { estimatedDiameterM: 3_643_000, radiusKm: 1821 },
  };
}

function atmosphereBodies(): ViewerBody[] {
  const venus: ViewerBody = {
    id: 'venus',
    bodyType: 'planet',
    surfaceArchetype: 'rocky',
    state: 'unscanned',
    displayName: 'Venus',
    catalogIdentity: { namespace: 'sol', key: 'venus' },
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 108_208_000, y: 0, z: 0 },
      epochMs: 1715000000000,
    },
    physicalCatalog: { estimatedDiameterM: 12_104_000, radiusKm: 6052 },
  };
  const titan: ViewerBody = {
    id: 'titan',
    bodyType: 'moon',
    surfaceArchetype: 'icy-moon',
    state: 'unscanned',
    displayName: 'Titan',
    catalogIdentity: { namespace: 'sol', key: 'titan' },
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 1_430_000_000, y: 0, z: 0 },
      epochMs: 1715000000000,
    },
    physicalCatalog: { estimatedDiameterM: 5_149_000, radiusKm: 2575 },
  };
  return [...SOL_SYSTEM_BODIES, venus, titan];
}

async function renderedSurface(page: import('@playwright/test').Page, name: string) {
  return page.evaluate((name) => {
    const ngApi = (window as Window & { ng?: { getComponent?: (node: Element) => unknown } }).ng;
    const canvas = document.querySelector('.viewer-scene-host ngt-canvas, .planet-view-host ngt-canvas');
    if (!ngApi?.getComponent || !canvas) return null;
    const component = ngApi.getComponent(canvas) as { store: { snapshot: { scene: Scene | null } } };
    const node = component.store.snapshot.scene?.getObjectByName(name);
    if (!node || node.type !== 'Mesh') return null;
    const material = (node as Mesh).material as MeshStandardMaterial;
    const imageWidth = (image: unknown): number | null =>
      typeof image === 'object' && image !== null && 'width' in image && typeof image.width === 'number'
        ? image.width
        : null;
    const albedoImage: unknown = material.map?.image;
    return {
      albedoWidth: imageWidth(albedoImage),
      normalWidth: imageWidth(material.normalMap?.image),
      roughnessMap: !!material.roughnessMap,
      color: material.color.getHexString(),
      emissive: material.emissive.getHexString(),
      emissiveIntensity: material.emissiveIntensity,
      hasTargetBracket: !!component.store.snapshot.scene?.getObjectByName('viewer-target-bracket'),
      source:
        typeof albedoImage === 'object' &&
        albedoImage !== null &&
        'src' in albedoImage &&
        typeof albedoImage.src === 'string'
          ? albedoImage.src
          : null,
    };
  }, name);
}

async function renderedAtmosphere(page: import('@playwright/test').Page, bodyId: string, displayName: string) {
  return page.evaluate(
    ({ bodyId, displayName }) => {
      const ngApi = (window as Window & { ng?: { getComponent?: (node: Element) => unknown } }).ng;
      const canvas = document.querySelector('.viewer-scene-host ngt-canvas, .planet-view-host ngt-canvas');
      if (!ngApi?.getComponent || !canvas) return null;
      const component = ngApi.getComponent(canvas) as { store: { snapshot: { scene: Scene | null } } };
      const scene = component.store.snapshot.scene;
      const layer = scene?.getObjectByName(`Atmosphere ${bodyId}`) as Mesh | undefined;
      const body = scene?.getObjectByName(displayName) as Mesh | undefined;
      const material = layer?.material as MeshStandardMaterial | undefined;
      const mapImage = material?.map?.image;
      const mapDimensions =
        typeof mapImage === 'object' &&
        mapImage !== null &&
        'width' in mapImage &&
        typeof mapImage.width === 'number' &&
        'height' in mapImage &&
        typeof mapImage.height === 'number'
          ? [mapImage.width, mapImage.height]
          : null;
      const bodyMaterial = body?.material as MeshStandardMaterial | undefined;
      return {
        layerFound: Boolean(layer),
        mapDimensions,
        bodyFound: Boolean(body),
        bodyMaterialVisible: bodyMaterial?.visible ?? null,
        hasMap: Boolean(material?.map),
      };
    },
    { bodyId, displayName },
  );
}

async function renderedIoCueCounts(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const ngApi = (window as Window & { ng?: { getComponent?: (node: Element) => unknown } }).ng;
    const canvas = document.querySelector('.viewer-scene-host ngt-canvas, .planet-view-host ngt-canvas');
    if (!ngApi?.getComponent || !canvas) return null;
    const component = ngApi.getComponent(canvas) as { store: { snapshot: { scene: Scene | null } } };
    const counts = { hotspots: 0, plumes: 0 };
    component.store.snapshot.scene?.traverse((object) => {
      if (object.name.startsWith('Io volcanic hotspot ')) counts.hotspots += 1;
      if (object.name.startsWith('Io volcanic plume ')) counts.plumes += 1;
    });
    return counts;
  });
}

async function setSystemBodyTarget(page: import('@playwright/test').Page, bodyId: string | null) {
  await page.evaluate((bodyId) => {
    const ngApi = (window as Window & { ng?: { getComponent?: (node: Element) => unknown } }).ng;
    const host = document.querySelector('app-viewer-scene-page');
    if (!ngApi?.getComponent || !host) throw new Error('viewer scene component is unavailable');

    const component = ngApi.getComponent(host) as {
      viewerTargetService: {
        target: (id: string) => void;
        clearTarget: () => void;
      };
    };
    if (bodyId) component.viewerTargetService.target(bodyId);
    else component.viewerTargetService.clearTarget();
  }, bodyId);
}

async function renderedBodyScreenPosition(page: import('@playwright/test').Page, displayName: string) {
  return page.evaluate(
    ({ displayName }) => {
      const ngApi = (window as Window & { ng?: { getComponent?: (node: Element) => unknown } }).ng;
      const canvas = document.querySelector('.viewer-scene-host ngt-canvas');
      if (!ngApi?.getComponent || !canvas) return null;

      const component = ngApi.getComponent(canvas) as {
        store: { snapshot: { scene: Scene | null; camera: Camera | null } };
      };
      const { scene, camera } = component.store.snapshot;
      const body = scene?.getObjectByName(displayName);
      if (!body || !camera) return null;

      const projected = body.getWorldPosition(body.position.clone()).project(camera);
      const bounds = canvas.getBoundingClientRect();
      return {
        x: bounds.left + ((projected.x + 1) / 2) * bounds.width,
        y: bounds.top + ((1 - projected.y) / 2) * bounds.height,
      };
    },
    { displayName },
  );
}

test.describe('viewer catalog planet surfaces', () => {
  test('provides software WebGL2 with capacity for the standard catalog tier', async ({ page }) => {
    await page.goto('/');
    const capabilities = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2');
      if (!gl) throw new Error('WebGL2 is unavailable; catalog rendering tests require software WebGL2');
      const debug = gl.getExtension('WEBGL_debug_renderer_info');
      const result = {
        renderer: debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : null,
        maxTextureSize: Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)),
      };
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return result;
    });
    expect(capabilities.renderer).toMatch(/SwiftShader/i);
    expect(capabilities.maxTextureSize).toBeGreaterThanOrEqual(4096);
  });

  test('loads only the exact approved previews, applies white terrain tint and Earth-only clouds', async ({ page }) => {
    const problems = collectRenderProblems(page);
    const requests: string[] = [];
    const albedoContentTypes: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/textures/sol/')) requests.push(request.url());
    });
    page.on('response', (response) => {
      if (response.url().match(/\/textures\/sol\/[^/]+\/[^/]+-preview-albedo\.webp$/)) {
        albedoContentTypes.push(response.headers()['content-type'] ?? '');
      }
    });
    const { mock } = await setupViewerSceneTest(page);
    await navigateToSystemScene(page, mock, catalogBodies());
    await expect.poll(async () => (await renderedSurface(page, 'Earth'))?.albedoWidth).toBe(512);
    await expect.poll(async () => (await renderedSurface(page, 'Luna'))?.albedoWidth).toBe(512);
    await expect.poll(async () => (await renderedSurface(page, 'Mars'))?.albedoWidth).toBe(512);
    await expect.poll(() => cloudTextureWidths(page)).toEqual([128]);
    expect(requests.map((url) => new URL(url).pathname).sort()).toEqual([
      '/textures/sol/earth-july-v3/earth-july-preview-albedo.webp',
      '/textures/sol/luna-v4/luna-preview-albedo.webp',
      '/textures/sol/mars-v3/mars-preview-albedo.webp',
    ]);
    expect(requests.every((url) => new URL(url).origin === new URL(page.url()).origin)).toBe(true);
    expect(albedoContentTypes).toEqual(['image/webp', 'image/webp', 'image/webp']);
    expect(await renderedSurface(page, 'Earth')).toMatchObject({ color: 'ffffff', emissive: '000000' });
    await page.getByTestId('viewer-surface-sources').locator('summary').click();
    await expect(page.getByTestId('viewer-surface-sources')).toContainText('NOAA GLOBE');
    await expect(page.getByTestId('viewer-surface-sources')).toContainText('on hold');
    expect(problems.filter((text) => SHADER_FAILURE.test(text))).toEqual([]);
  });

  test('renders Io albedo and static volcanic cues in overview and focused detail', async ({ page }) => {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => 4 }),
    );
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/textures/sol/io-v1/')) requests.push(new URL(request.url()).pathname);
    });
    const { mock } = await setupViewerSceneTest(page);
    await navigateToSystemScene(page, mock, [...catalogBodies(), ioBody()]);

    await expect.poll(async () => (await renderedSurface(page, 'Io'))?.albedoWidth).toBe(512);
    await expect.poll(() => renderedIoCueCounts(page)).toEqual({ hotspots: 4, plumes: 4 });
    await page.getByTestId('viewer-surface-sources').locator('summary').click();
    await expect(page.getByTestId('viewer-surface-sources')).toContainText(
      'U.S. Geological Survey Astrogeology Science Center',
    );
    await expect(page.getByTestId('viewer-surface-sources')).toContainText('illustrative, not current activity');

    await enterPlanetViewViaSceneComponent(page, 'io');
    await expect.poll(async () => (await renderedSurface(page, 'Io'))?.albedoWidth).toBe(2048);
    await expect.poll(() => renderedIoCueCounts(page)).toEqual({ hotspots: 4, plumes: 4 });
    expect(requests).toContain('/textures/sol/io-v1/io-preview-albedo.webp');
    expect(requests).toContain('/textures/sol/io-v1/io-low-albedo.webp');
    expect(requests.some((path) => path.includes('normal'))).toBe(false);
  });

  test('keeps catalog albedo tint neutral when targeted and in focused detail', async ({ page }) => {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => 4 }),
    );
    const { mock } = await setupViewerSceneTest(page);
    await navigateToSystemScene(page, mock, catalogBodies());

    await expect.poll(async () => (await renderedSurface(page, 'Earth'))?.albedoWidth).toBe(512);
    expect(await renderedSurface(page, 'Earth')).toMatchObject({
      color: 'ffffff',
      emissive: '000000',
      hasTargetBracket: false,
    });
    await setSystemBodyTarget(page, 'earth');
    await expect
      .poll(async () => renderedSurface(page, 'Earth'))
      .toMatchObject({
        color: 'ffffff',
        emissive: '000000',
        hasTargetBracket: true,
      });
    await expect(page.getByTestId('viewer-body-label')).toContainText('Earth');
    await expect(page.getByTestId('viewer-body-label')).toContainText('Targeted');
    await setSystemBodyTarget(page, null);
    await expect
      .poll(async () => renderedSurface(page, 'Earth'))
      .toMatchObject({
        color: 'ffffff',
        emissive: '000000',
        hasTargetBracket: false,
      });
    await expect(page.getByTestId('viewer-body-label')).toHaveCount(0);

    for (const bodyId of ['earth', 'luna', 'mars']) {
      const displayName = bodyId === 'luna' ? 'Luna' : bodyId[0].toUpperCase() + bodyId.slice(1);
      await enterPlanetViewViaSceneComponent(page, bodyId);
      await expect.poll(async () => (await renderedSurface(page, displayName))?.albedoWidth).toBe(2048);
      expect(await renderedSurface(page, displayName)).toMatchObject({ color: 'ffffff', emissive: '000000' });

      if (bodyId !== 'mars') {
        await page.goBack();
        await expect(page).toHaveURL(/right:viewer-scene\/sol/);
      }
    }
  });

  test('shows identity on hover for moons and stations and clears it on pointer-out', async ({ page }) => {
    const { mock } = await setupViewerSceneTest(page);
    await navigateToSystemScene(page, mock);

    const label = page.getByTestId('viewer-body-label');
    await expect.poll(async () => Boolean(await renderedBodyScreenPosition(page, 'Earth'))).toBe(true);
    const earthPosition = await renderedBodyScreenPosition(page, 'Earth');
    if (!earthPosition) throw new Error('Earth is not rendered in the viewer scene');
    await page.mouse.move(earthPosition.x, earthPosition.y);
    await expect(label).toContainText('Earth');

    await expect.poll(async () => Boolean(await renderedBodyScreenPosition(page, 'Luna'))).toBe(true);
    const lunaPosition = await renderedBodyScreenPosition(page, 'Luna');
    if (!lunaPosition) throw new Error('Luna is not rendered in the viewer scene');
    await page.mouse.move(lunaPosition.x, lunaPosition.y);
    await expect(label).toContainText('Luna');
    await expect(label).toContainText('moon');

    await expect.poll(async () => Boolean(await renderedBodyScreenPosition(page, 'Sol Market Alpha'))).toBe(true);
    const stationPosition = await renderedBodyScreenPosition(page, 'Sol Market Alpha');
    if (!stationPosition) throw new Error('Sol Market Alpha is not rendered in the viewer scene');
    await page.mouse.move(stationPosition.x, stationPosition.y);
    await expect(label).toContainText('Sol Market Alpha');
    await expect(label).toContainText('station');

    await page.mouse.move(stationPosition.x + 120, stationPosition.y + 100);
    await expect(label).toHaveCount(0);
  });

  test('renders static Venus and Titan atmospheres in overview and focused detail', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/textures/sol/atmospheres/')) requests.push(request.url());
    });
    const { mock } = await setupViewerSceneTest(page);
    await navigateToSystemScene(page, mock, atmosphereBodies());

    await expect
      .poll(async () => renderedAtmosphere(page, 'venus', 'Venus'))
      .toMatchObject({
        layerFound: true,
        mapDimensions: [2048, 1024],
        bodyFound: true,
      });
    await expect
      .poll(async () => renderedAtmosphere(page, 'titan', 'Titan'))
      .toMatchObject({
        mapDimensions: [256, 128],
      });
    await expect
      .poll(async () => renderedAtmosphere(page, 'venus', 'Venus'))
      .toMatchObject({
        bodyMaterialVisible: false,
        hasMap: true,
      });
    await expect
      .poll(async () => renderedAtmosphere(page, 'titan', 'Titan'))
      .toMatchObject({
        bodyMaterialVisible: false,
        hasMap: true,
      });
    await page.getByTestId('viewer-surface-sources').locator('summary').click();
    await expect(page.getByTestId('viewer-surface-sources')).toContainText('Solar System Scope texture, CC BY 4.0.');
    await expect(page.getByTestId('viewer-surface-sources')).toContainText(
      'Original static haze generated by this project',
    );
    await expect(page.getByTestId('viewer-surface-sources')).toContainText('Creative Commons Attribution 4.0');
    expect(requests).toContain(
      `${new URL(page.url()).origin}/textures/sol/atmospheres/venus-scope-v1/venus-atmosphere-2k.webp`,
    );

    for (const [bodyId, displayName, dimensions] of [
      ['venus', 'Venus', [4096, 2048]],
      ['titan', 'Titan', [512, 256]],
    ] as const) {
      await enterPlanetViewViaSceneComponent(page, bodyId);
      await expect
        .poll(async () => renderedAtmosphere(page, bodyId, displayName))
        .toMatchObject({
          mapDimensions: dimensions,
          bodyMaterialVisible: false,
          hasMap: true,
        });
      if (bodyId === 'venus') await page.goBack();
    }

    expect(requests).toContain(
      `${new URL(page.url()).origin}/textures/sol/atmospheres/venus-scope-v1/venus-atmosphere-4k.webp`,
    );
    expect(requests.some((url) => url.includes('/atmospheres/') && url.endsWith('.jpg'))).toBe(false);
  });

  test('loads only low detail on constrained policy, preserves Luna preview, and upgrades normal maps', async ({
    page,
  }) => {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => 4 }),
    );
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/textures/sol/')) requests.push(new URL(request.url()).pathname);
    });
    const { mock } = await setupViewerSceneTest(page);
    await navigateToSystemScene(page, mock, catalogBodies());
    await expect.poll(async () => (await renderedSurface(page, 'Earth'))?.albedoWidth).toBe(512);
    await enterPlanetViewViaSceneComponent(page);
    await expect.poll(async () => (await renderedSurface(page, 'Earth'))?.albedoWidth).toBe(2048);
    expect(await renderedSurface(page, 'Earth')).toMatchObject({
      normalWidth: 1024,
      roughnessMap: false,
      color: 'ffffff',
    });
    await expect.poll(async () => (await renderedSurface(page, 'Luna'))?.albedoWidth).toBe(512);
    await expect.poll(() => cloudTextureWidths(page)).toEqual([256]);
    expect(requests).toContain('/textures/sol/earth-july-v3/earth-july-low-normal.png');
    expect(requests.some((path) => path.includes('standard'))).toBe(false);
    expect(requests.some((path) => path.includes('luna-low') || path.includes('mars-low'))).toBe(false);
    await page.getByRole('button', { name: 'Focus Luna' }).click();
    await expect.poll(async () => (await renderedSurface(page, 'Luna'))?.albedoWidth).toBe(2048);
    expect(await renderedSurface(page, 'Luna')).toMatchObject({ normalWidth: 1024 });
    await expect.poll(() => cloudTextureWidths(page)).toEqual([]);
    await page.goBack();
    await expect(page).toHaveURL(/right:viewer-scene\/sol/);
    await expect.poll(async () => (await renderedSurface(page, 'Earth'))?.albedoWidth).toBe(512);
    await enterPlanetViewViaSceneComponent(page);
    await expect.poll(async () => (await renderedSurface(page, 'Earth'))?.albedoWidth).toBe(2048);
    await expect.poll(() => cloudTextureWidths(page)).toEqual([256]);
  });

  test('loads Mars standard detail without clouds and switches to low on full-window resize', async ({ page }) => {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => 8 }),
    );
    const { mock } = await setupViewerSceneTest(page);
    await navigateToSystemScene(page, mock, catalogBodies());
    await expect.poll(async () => (await renderedSurface(page, 'Mars'))?.albedoWidth).toBe(512);
    await enterPlanetViewViaSceneComponent(page, 'mars');
    await expect.poll(async () => (await renderedSurface(page, 'Mars'))?.albedoWidth).toBe(4096);
    expect(await renderedSurface(page, 'Mars')).toMatchObject({
      normalWidth: 2048,
      color: 'ffffff',
      emissive: '000000',
    });
    await expect.poll(() => cloudTextureWidths(page)).toEqual([]);
    await page.setViewportSize({ width: 767, height: 900 });
    await expect.poll(async () => (await renderedSurface(page, 'Mars'))?.albedoWidth).toBe(2048);
    expect(await renderedSurface(page, 'Mars')).toMatchObject({ normalWidth: 1024 });
  });

  test('retains recognizable preview on detail failure and retries into standard detail', async ({ page }) => {
    await page.addInitScript(() =>
      Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, get: () => 8 }),
    );
    const { mock } = await setupViewerSceneTest(page);
    await navigateToSystemScene(page, mock, catalogBodies());
    await expect.poll(async () => (await renderedSurface(page, 'Earth'))?.albedoWidth).toBe(512);
    let failures = 0;
    await page.route('**/textures/sol/earth-july-v3/earth-july-standard-normal.png', (route) => {
      failures += 1;
      return failures === 1 ? route.fulfill({ status: 503, body: 'temporary failure' }) : route.continue();
    });
    await enterPlanetViewViaSceneComponent(page);
    await expect(page.getByTestId('viewer-surface-error')).toBeVisible();
    expect(await renderedSurface(page, 'Earth')).toMatchObject({ albedoWidth: 512, normalWidth: null });
    await page.getByTestId('viewer-surface-retry').click();
    await expect.poll(async () => (await renderedSurface(page, 'Earth'))?.albedoWidth).toBe(4096);
    expect(await renderedSurface(page, 'Earth')).toMatchObject({ normalWidth: 2048, roughnessMap: false });
    await expect(page.getByTestId('viewer-surface-error')).toBeHidden();
    expect(failures).toBe(2);
  });

  test('shows a neutral placeholder and explicit retry when initial catalog imagery fails', async ({ page }) => {
    let fail = true;
    const surfaceRequests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/textures/sol/')) surfaceRequests.push(new URL(request.url()).pathname);
    });
    await page.route('**/textures/sol/luna-v4/luna-preview-albedo.webp', (route) =>
      fail ? route.fulfill({ status: 404, body: 'missing fixture' }) : route.continue(),
    );
    const { mock } = await setupViewerSceneTest(page);
    await navigateToSystemScene(page, mock, catalogBodies());
    await expect(page.getByTestId('viewer-surface-error')).toBeVisible();
    expect(await renderedSurface(page, 'Luna')).toMatchObject({ albedoWidth: null, color: '555b65' });
    expect(surfaceRequests).toContain('/textures/sol/luna-v4/luna-preview-albedo.webp');
    expect(surfaceRequests.some((path) => path.endsWith('.jpg'))).toBe(false);
    fail = false;
    await page.getByTestId('viewer-surface-retry').click();
    await expect.poll(async () => (await renderedSurface(page, 'Luna'))?.albedoWidth).toBe(512);
    await expect(page.getByTestId('viewer-surface-error')).toBeHidden();
  });
});

/**
 * Waits until the bake queue has actually drained with surfaces resident.
 *
 * Asserting only that the progress indicator is hidden is not enough: right
 * after the scene loads the queue has not been filled yet, so the indicator is
 * legitimately hidden and the assertion passes without a single bake having
 * run. Polling the cache itself is what makes these tests non-vacuous.
 */
async function waitForSurfacesBaked(page: import('@playwright/test').Page, minimum = 1) {
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const ngApi = (window as Window & { ng?: { getComponent?: (node: Element) => unknown } }).ng;
          // The progress component exists in both the system and detail views
          // and holds the same root-provided cache, so it is the one probe that
          // works from either screen.
          const host = document.querySelector('app-planet-surface-progress');
          if (!ngApi?.getComponent || !host) return -1;
          const component = ngApi.getComponent(host) as {
            planetTextures?: { ready: () => ReadonlyMap<string, unknown>; pending: () => number };
          };
          const cache = component?.planetTextures;
          if (!cache) return -1;
          return cache.pending() === 0 ? cache.ready().size : 0;
        }),
      { timeout: 20_000 },
    )
    .toBeGreaterThanOrEqual(minimum);

  await expect(page.getByTestId('viewer-surface-progress')).toBeHidden();
}

async function cloudTextureWidths(page: import('@playwright/test').Page): Promise<number[]> {
  return page.evaluate(() => {
    const ngApi = (window as Window & { ng?: { getComponent?: (node: Element) => unknown } }).ng;
    const canvas = document.querySelector('ngt-canvas');
    if (!ngApi?.getComponent || !canvas) throw new Error('Planet canvas is unavailable');
    const component = ngApi.getComponent(canvas) as { store: { snapshot: { scene: Scene | null } } };
    const widths: number[] = [];
    // The canvas briefly has no scene while the system view hands over to the planet view.
    const scene = component.store.snapshot.scene;
    if (!scene) return widths;
    scene.traverse((node) => {
      if (node.type !== 'Mesh') return;
      const material = (node as Mesh).material as MeshStandardMaterial;
      const image: unknown = material.map?.image;
      if (
        material.transparent &&
        material.opacity === 0.7 &&
        typeof image === 'object' &&
        image !== null &&
        'width' in image &&
        typeof image.width === 'number' &&
        image.width > 0
      ) {
        widths.push(image.width);
      }
    });
    return widths;
  });
}

test.describe('viewer procedural planet surfaces', () => {
  for (const archetype of ['icy-moon', 'rocky-moon'] as const) {
    for (const focused of ['earth', 'luna']) {
      test(`renders ${archetype} overview and ${focused === 'luna' ? 'focused relief' : 'companion moon'} without clouds`, async ({
        page,
      }, testInfo) => {
        const problems = collectRenderProblems(page);
        const { mock } = await setupViewerSceneTest(page);
        const bodies = SOL_SYSTEM_BODIES.map((body: ViewerBody) =>
          body.id === 'luna' ? { ...body, surfaceArchetype: archetype } : body,
        );
        await navigateToSystemScene(page, mock, bodies);
        await waitForSurfacesBaked(page, 3);
        await expect.poll(() => renderedSurface(page, 'Luna')).toMatchObject({ albedoWidth: 256 });
        await expect.poll(() => cloudTextureWidths(page)).toEqual([128, 128]);
        await enterPlanetViewViaSceneComponent(page, focused);
        await expect(new PlanetViewPage(page).header).toBeVisible();
        await waitForSurfacesBaked(page);
        await expect
          .poll(() => renderedSurface(page, 'Luna'))
          .toMatchObject(
            focused === 'luna' ? { albedoWidth: 2048, normalWidth: 1024, roughnessMap: true } : { albedoWidth: 256 },
          );
        await expect.poll(() => cloudTextureWidths(page)).toEqual(focused === 'luna' ? [] : [256]);
        if (focused === 'luna') await page.screenshot({ path: testInfo.outputPath(`${archetype}-detail.png`) });
        expect(
          problems.filter((text) => SHADER_FAILURE.test(text) || text.includes(`No dedicated ${archetype} renderer`)),
        ).toEqual([]);
      });
    }
  }

  test('bakes system-view surfaces through three.js without shader errors', async ({ page }) => {
    const problems = collectRenderProblems(page);
    const { mock } = await setupViewerSceneTest(page);

    await navigateToSystemScene(page, mock);

    // Sol's fixture has two planets and a moon; the star and station are not
    // texturable, so three surfaces is the full expected set.
    await waitForSurfacesBaked(page, 3);

    await expect.poll(() => cloudTextureWidths(page)).toEqual([128, 128]);
    expect(problems.filter((text) => SHADER_FAILURE.test(text))).toEqual([]);
  });

  test('reports surface generation progress and then hides the indicator', async ({ page }) => {
    const { mock } = await setupViewerSceneTest(page);

    // The indicator can come and go faster than a poll interval, so record its
    // appearance with an observer instead of trying to catch it mid-flight.
    await page.evaluate(() => {
      const state = { seen: false };
      (window as unknown as Record<string, unknown>).__surfaceIndicatorSeen = state;
      const check = () => {
        if (document.querySelector('[data-testid="viewer-surface-progress"]')) {
          state.seen = true;
        }
      };
      check();
      new MutationObserver(check).observe(document.body, { childList: true, subtree: true });
    });

    await navigateToSystemScene(page, mock);
    await waitForSurfacesBaked(page, 3);

    const everShown = await page.evaluate(
      () => (window as unknown as { __surfaceIndicatorSeen: { seen: boolean } }).__surfaceIndicatorSeen.seen,
    );
    expect(everShown).toBe(true);
  });

  test('generates surfaces without contacting any external host', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      // localhost covers both the app origin and the mocked socket.io backend.
      if (url.protocol.startsWith('http') && !/^(localhost|127\.0\.0\.1)$/.test(url.hostname)) {
        external.push(request.url());
      }
    });

    const { mock } = await setupViewerSceneTest(page);
    await navigateToSystemScene(page, mock);
    await waitForSurfacesBaked(page, 3);

    expect(external).toEqual([]);
  });

  test('bakes the detail view without shader errors after focusing a planet', async ({ page }) => {
    const problems = collectRenderProblems(page);
    await setupPlanetViewZoomViewer(page);
    await enterPlanetViewViaSceneComponent(page);

    await expect(new PlanetViewPage(page).header).toBeVisible({ timeout: 10_000 });
    await waitForSurfacesBaked(page);

    await expect.poll(() => cloudTextureWidths(page)).toContain(256);
    expect(problems.filter((text) => SHADER_FAILURE.test(text))).toEqual([]);
  });
});
