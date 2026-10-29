import { expect, test } from '@playwright/test';
import type { BufferGeometry, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, ShaderMaterial } from 'three';
import {
  SPLASH_PLANET_BODY_ID,
  SPLASH_PLANET_QUERY_PARAM,
  SPLASH_PLANET_ROTATION,
} from '../../src/app/scene/planet/splash-planet-rotation';
import { SocketIOMock } from '../fixtures/socket-mock';
import { expectStationHabitatMotion } from '../helpers/station-habitat-helper';

/** Pins the rotating splash planet so runs stay repeatable. */
function pinnedSplash(path: string, bodyId = SPLASH_PLANET_BODY_ID): string {
  return `${path}?${SPLASH_PLANET_QUERY_PARAM}=${encodeURIComponent(bodyId)}`;
}

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ page }) => {
  await new SocketIOMock(page).setup();
});

for (const bodyId of [SPLASH_PLANET_BODY_ID, 'nova-splash-giant-05', 'nova-splash-star-g']) {
  test(`shows the scene immediately, loads one real tier, and retains intro controls (${bodyId})`, async ({ page }) => {
    const assets: string[] = [];
    const requests: string[] = [];
    const errors: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (url.pathname.endsWith('.glb')) assets.push(request.url());
      if (url.protocol.startsWith('http')) requests.push(request.url());
    });
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(pinnedSplash('/', bodyId));
    await expect(page).toHaveURL(/\/splash\(left:intro\)/, { timeout: 4500 });
    await expect(page.getByRole('heading', { name: 'Welcome to Project Stellar' })).toBeVisible();
    const overlay = page.locator('app-splash-overlay section');
    const expectReady = async () => {
      // Reloading real GLB textures and shaders can be slower under software WebGL.
      await expect(overlay).toHaveAttribute('data-state', /^(ready|error)$/, { timeout: 30_000 });
      await expect(overlay).toHaveAttribute('data-state', 'ready');
    };
    await expectReady();
    const tier = await page.locator('app-splash-overlay section').getAttribute('data-quality');
    const diagnostics = page.getByLabel('3D model diagnostics');
    await expect(diagnostics).toContainText(
      tier === 'standard' ? 'Standard GLB (154k triangles)' : 'Low GLB (50k triangles)',
    );
    await expect(diagnostics).toContainText(/3D ready in \d+\.\d{2} s/);
    expect(assets.filter((url) => /asteroid-mining-rig\.(standard|low)\.glb/.test(url))).toHaveLength(1);
    expect(assets.some((url) => /Asteroid_Mining_Rig_/.test(url))).toBe(false);
    // The planet surface is generated at runtime, so the splash must reach no third-party host.
    const origin = new URL(page.url()).origin;
    expect(requests.filter((url) => !url.startsWith(origin))).toEqual([]);
    expect(errors).toEqual([]);
    await page.getByRole('button', { name: 'Use still image' }).click();
    await expect(page.locator('app-splash-overlay section')).toHaveAttribute('data-state', 'static');
    await expect(diagnostics).toContainText('Still image');
    await expect(page.locator('app-splash-overlay img')).toBeVisible();
    await page.getByRole('button', { name: 'Load 3D scene' }).click();
    await expectReady();
    expect(errors).toEqual([]);
  });
}

test('reports asset errors and allows retry without blocking login', async ({ page }) => {
  await page.route('**/asteroid-mining-rig.*.glb*', (route) => route.abort());
  await page.goto(pinnedSplash('/splash(left:login)'));
  await expect(page.locator('app-splash-overlay section')).toHaveAttribute('data-state', 'error');
  await expect(page.getByLabel('3D model diagnostics')).not.toContainText('3D ready in');
  await expect(page.locator('app-login-page')).toBeVisible();
  await page.unroute('**/asteroid-mining-rig.*.glb*');
  await page.getByRole('button', { name: 'Load 3D scene' }).click();
  await expect(page.locator('app-splash-overlay section')).toHaveAttribute('data-state', 'ready');
});

test('renders the splash planet with every third-party host blocked', async ({ page }) => {
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (route) => route.abort());
  const failures: string[] = [];
  page.on('requestfailed', (request) => failures.push(request.url()));
  await page.goto(pinnedSplash('/splash(left:login)'));
  await expect(page.locator('app-splash-overlay section')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('app-login-page')).toBeVisible();
  expect(failures).toEqual([]);
});

test('bakes the planet shader through three.js without GPU compile errors', async ({ page }) => {
  // The raw-WebGL2 parity spec compiles the shader sources directly, so it cannot
  // catch three.js-specific breakage (for example its RawShaderMaterial preamble
  // displacing the `#version` directive). This drives the real bake path instead.
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') consoleErrors.push(message.text());
  });

  await page.goto(pinnedSplash('/splash(left:intro)'));
  await expect(page.locator('app-splash-overlay section')).toHaveAttribute('data-state', 'ready');
  expect(
    consoleErrors.filter((text) => /Shader Error|not compiled|WebGLProgram|INVALID_OPERATION/i.test(text)),
  ).toEqual([]);
});

test('renders the opt-in Cygnus X-1 prototype and swaps back without shader errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (/Shader Error|not compiled|WebGLProgram|INVALID_OPERATION/i.test(message.text())) errors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(pinnedSplash('/splash(left:login)', 'demo-cygnus-x1'));
  const overlay = page.locator('app-splash-overlay section');
  await expect(overlay).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  await expect(overlay).toHaveAttribute('data-planet-kind', 'black-hole');
  await expect(page.getByTestId('splash-black-hole-note')).toContainText('Schwarzschild');
  await expect(page.getByLabel('3D model diagnostics')).toContainText('Black-hole ray pass');
  const canvas = page.locator('ngt-canvas canvas').first();
  const blackHoleImage = await canvas.screenshot();
  const colors = await page.evaluate(async (png) => {
    const image = new Image();
    image.src = `data:image/png;base64,${png}`;
    await image.decode();
    const sample = document.createElement('canvas');
    sample.width = image.width;
    sample.height = image.height;
    const context = sample.getContext('2d');
    if (!context) throw new Error('Image sampling context unavailable.');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    let warm = 0;
    let blue = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i],
        g = pixels[i + 1],
        b = pixels[i + 2];
      if (r > 70 && r > b * 1.5 && g > 30) warm++;
      if (b > 100 && b > r * 1.25 && g > 50) blue++;
    }
    return { warm, blue };
  }, blackHoleImage.toString('base64'));
  expect(colors.warm).toBeGreaterThan(200);
  expect(colors.blue).toBeGreaterThan(10);
  expect(await canvas.screenshot()).toEqual(blackHoleImage);
  await page.getByRole('combobox', { name: 'Body type' }).selectOption('sol');
  await page.getByRole('combobox', { name: 'Body', exact: true }).selectOption('sol-mars');
  await expect(overlay).toHaveAttribute('data-planet', 'sol-mars');
  await expect(page.getByTestId('splash-current-body')).not.toContainText('loading');
  expect(await canvas.screenshot()).not.toEqual(blackHoleImage);
  await page.getByRole('combobox', { name: 'Body type' }).selectOption('black-hole');
  await expect(overlay).toHaveAttribute('data-planet-kind', 'black-hole');
  await expect(page.getByTestId('splash-current-body')).not.toContainText('loading');
  await expect(page.locator('app-login-page')).toBeVisible();
  const nextQuality = (await overlay.getAttribute('data-quality')) === 'standard' ? 'low' : 'standard';
  await page
    .getByRole('button', { name: nextQuality === 'low' ? 'Load Low ray pass' : 'Load Standard ray pass' })
    .click();
  await expect(overlay).toHaveAttribute('data-quality', nextQuality);
  await expect(overlay).toHaveAttribute('data-state', 'ready');
  await expect(page.getByLabel('3D model diagnostics')).toContainText(
    nextQuality === 'low' ? '320 x 267' : '640 x 533',
  );
  expect(errors).toEqual([]);
});

test('keeps the Cygnus companion photosphere luminous across small camera orbits', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(pinnedSplash('/splash(left:login)', 'demo-cygnus-x1'));
  await expect(page.locator('app-splash-overlay section')).toHaveAttribute('data-state', 'ready');
  const canvas = page.locator('ngt-canvas canvas').first();
  for (const angle of [0, 0.18, 0.18, -0.54]) {
    const center = await page.evaluate((angle) => {
      const ng = Reflect.get(window, 'ng') as { getComponent: (element: Element | null) => unknown };
      const component = ng.getComponent(document.querySelector('ngt-canvas')) as {
        store: { snapshot: { scene: Scene; camera: PerspectiveCamera; invalidate: () => void } };
      };
      const { scene, camera, invalidate } = component.store.snapshot;
      const companion = scene.getObjectByName('cygnus-x1-companion');
      if (!companion) throw new Error('Companion missing.');
      camera.position.applyAxisAngle(camera.up.clone().set(0, 1, 0), angle);
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();
      scene.updateMatrixWorld(true);
      const projected = companion.getWorldPosition(companion.position.clone()).project(camera);
      invalidate();
      return { x: (projected.x + 1) / 2, y: (1 - projected.y) / 2 };
    }, angle);
    expect(center.x).toBeGreaterThan(0);
    expect(center.x).toBeLessThan(1);
    const png = await canvas.screenshot({ style: 'app-splash-overlay { visibility: hidden !important; }' });
    const brightness = await page.evaluate(async ({ png, center }) => {
      const image = new Image();
      image.src = `data:image/png;base64,${png}`;
      await image.decode();
      const sample = document.createElement('canvas');
      sample.width = image.width;
      sample.height = image.height;
      const context = sample.getContext('2d');
      if (!context) throw new Error('Photosphere pixel sampling unavailable.');
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(Math.round(center.x * image.width) - 2, Math.round(center.y * image.height) - 2, 5, 5).data;
      let blue = 0;
      for (let i = 2; i < pixels.length; i += 4) blue += pixels[i];
      return blue / 25;
    }, { png: png.toString('base64'), center });
    expect(brightness).toBeGreaterThan(100);
  }
});

test('toggles companion wind without changing the disk and freezes it for reduced motion', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (/Shader Error|not compiled|WebGLProgram|INVALID_OPERATION/i.test(message.text())) errors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(pinnedSplash('/splash(left:login)', 'demo-cygnus-x1'));
  const overlay = page.locator('app-splash-overlay section');
  await expect(overlay).toHaveAttribute('data-state', 'ready');
  const toggle = page.getByRole('checkbox', { name: 'Stellar wind (cinematic)' });
  await expect(toggle).not.toBeChecked();
  const canvas = page.locator('ngt-canvas canvas').first();
  const capture = () => canvas.screenshot({ style: 'app-splash-overlay { visibility: hidden !important; }' });
  const without = await capture();
  await toggle.check();
  await expect.poll(capture).not.toEqual(without);
  const withWind = await capture();
  expect(await capture()).toEqual(withWind);
  const difference = await page.evaluate(async ([before, after]) => {
    const images = await Promise.all([before, after].map(async (png) => {
      const image = new Image();
      image.src = `data:image/png;base64,${png}`;
      await image.decode();
      const sample = document.createElement('canvas');
      sample.width = image.width;
      sample.height = image.height;
      const context = sample.getContext('2d');
      if (!context) throw new Error('Wind pixel sampling unavailable.');
      context.drawImage(image, 0, 0);
      return { pixels: context.getImageData(0, 0, image.width, image.height).data, width: image.width, height: image.height };
    }));
    const [a, b] = images;
    let changed = 0, minX = a.width, minY = a.height, maxX = 0, maxY = 0;
    for (let i = 0; i < a.pixels.length; i += 4) {
      if (a.pixels[i] === b.pixels[i] && a.pixels[i + 1] === b.pixels[i + 1] && a.pixels[i + 2] === b.pixels[i + 2]) continue;
      const x = (i / 4) % a.width, y = Math.floor(i / 4 / a.width);
      changed++;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    return { changed, fraction: changed / (a.width * a.height), widthFraction: (maxX - minX) / a.width, heightFraction: (maxY - minY) / a.height };
  }, [without.toString('base64'), withWind.toString('base64')]);
  expect(difference.changed).toBeGreaterThan(10);
  expect(difference.fraction).toBeLessThan(0.01);
  expect(difference.widthFraction).toBeLessThan(0.25);
  expect(difference.heightFraction).toBeLessThan(0.25);
  await toggle.uncheck();
  await expect.poll(capture).toEqual(without);
  await toggle.check();
  const nextQuality = (await overlay.getAttribute('data-quality')) === 'standard' ? 'low' : 'standard';
  await page.getByRole('button', { name: nextQuality === 'low' ? 'Load Low ray pass' : 'Load Standard ray pass' }).click();
  await expect(overlay).toHaveAttribute('data-state', 'ready');
  await expect(toggle).toBeChecked();
  const nextTier = await capture();
  await toggle.uncheck();
  await expect.poll(capture).not.toEqual(nextTier);
  const windTime = () => page.evaluate(() => {
    const ng = Reflect.get(window, 'ng') as { getComponent: (element: Element | null) => unknown };
    const component = ng.getComponent(document.querySelector('ngt-canvas')) as {
      store: { snapshot: { scene: Scene } };
    };
    const wind = component.store.snapshot.scene.getObjectByName('cygnus-x1-stellar-wind') as Mesh<BufferGeometry, ShaderMaterial> | undefined;
    if (!wind) throw new Error('Companion wind missing.');
    return Number(wind.material.uniforms['uTime'].value);
  });
  const frozenTime = await windTime();
  await toggle.check();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await expect.poll(windTime).toBeGreaterThan(frozenTime + 0.1);
  await page.getByRole('combobox', { name: 'Body type', exact: true }).selectOption('sol');
  await expect(toggle).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('hides foreground choices for Cygnus X-1 and restores the selected model for other bodies', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(pinnedSplash('/splash(left:login)', 'demo-cygnus-x1'));
  const overlay = page.locator('app-splash-overlay section');
  await expect(overlay).toHaveAttribute('data-state', 'ready');
  const foreground = page.getByRole('combobox', { name: 'Foreground', exact: true });
  await expect(foreground).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Body type', exact: true }).selectOption('sol');
  await expect(foreground).toBeVisible();
  await foreground.selectOption('station');
  await expect(overlay).toHaveAttribute('data-state', 'ready');
  await page.getByRole('combobox', { name: 'Body type', exact: true }).selectOption('black-hole');
  await expect(foreground).toHaveCount(0);
  await page.getByRole('combobox', { name: 'Body type', exact: true }).selectOption('sol');
  await expect(foreground).toHaveValue('station');
  await expect(page.locator('app-login-page')).toBeVisible();
});

test('reports missing HDR support for the Cygnus X-1 prototype without blocking login', async ({ page }) => {
  await page.addInitScript(() => {
    const original = WebGL2RenderingContext.prototype.getExtension;
    WebGL2RenderingContext.prototype.getExtension = function (name: string) {
      return name === 'EXT_color_buffer_float' ? null : original.call(this, name);
    };
  });
  await page.goto(pinnedSplash('/splash(left:login)', 'demo-cygnus-x1'));
  await expect(page.locator('app-splash-overlay section')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('app-login-page')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Load 3D scene' })).toBeVisible();
});

test('keeps splash starfield pixels across the left and right sky after orbit and resize', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(pinnedSplash('/splash', 'nova-splash-homeworld'));
  await expect(page.locator('app-splash-overlay section')).toHaveAttribute('data-state', 'ready');
  for (const [width, height, station] of [
    [1200, 800, false],
    [600, 900, true],
  ] as const) {
    await page.setViewportSize({ width, height });
    if (station) {
      await page.getByRole('combobox', { name: 'Foreground', exact: true }).selectOption('station');
      await expect(page.locator('app-splash-overlay section')).toHaveAttribute('data-state', 'ready');
    }
    await page.evaluate(() => {
      const ng = Reflect.get(window, 'ng') as { getComponent: (element: Element | null) => unknown };
      const component = ng.getComponent(document.querySelector('ngt-canvas')) as {
        store: { snapshot: { scene: Scene; invalidate: () => void } };
      };
      const { scene, invalidate } = component.store.snapshot;
      const field = scene.getObjectByName('splash-starfield');
      if (!field) throw new Error('Splash starfield missing.');
      // Isolate the sky to measure coverage without counting foreground pixels or occlusion.
      scene.traverse((object) => {
        if (Reflect.get(object, 'isMesh') || Reflect.get(object, 'isPoints')) object.visible = object === field;
      });
      invalidate();
    });
    const canvas = page.locator('ngt-canvas canvas').first();
    for (let orbit = 0; orbit < 2; orbit++) {
      if (orbit) {
        const box = await canvas.boundingBox();
        if (!box) throw new Error('Splash canvas missing.');
        await page.mouse.move(box.x + box.width * 0.35, box.y + box.height * 0.35);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.45, { steps: 8 });
        await page.mouse.up();
      }
      const png = await canvas.screenshot({ style: 'app-splash-overlay { visibility: hidden !important; }' });
      const canvasBounds = await canvas.boundingBox();
      const skyBounds = await page.locator('app-splash-overlay section').boundingBox();
      if (!canvasBounds || !skyBounds) throw new Error('Splash sky bounds unavailable.');
      const quadrants = await page.evaluate(
        async ({ base64, canvasBounds, skyBounds }) => {
          const image = new Image();
          image.src = `data:image/png;base64,${base64}`;
          await image.decode();
          const sample = document.createElement('canvas');
          const scale = image.width / canvasBounds.width;
          sample.width = Math.round(skyBounds.width * scale);
          sample.height = Math.round(skyBounds.height * scale);
          const context = sample.getContext('2d');
          if (!context) throw new Error('Starfield pixel sampling unavailable.');
          context.drawImage(
            image,
            (skyBounds.x - canvasBounds.x) * scale,
            (skyBounds.y - canvasBounds.y) * scale,
            sample.width,
            sample.height,
            0,
            0,
            sample.width,
            sample.height,
          );
          const data = context.getImageData(0, 0, sample.width, sample.height).data;
          const counts = [0, 0, 0, 0];
          for (let y = 0; y < sample.height; y++) {
            for (let x = 0; x < sample.width; x++) {
              const index = (y * sample.width + x) * 4;
              if (data[index] > 70 && data[index + 1] > 70 && data[index + 2] > 70) {
                counts[(x >= sample.width / 2 ? 1 : 0) + (y >= sample.height / 2 ? 2 : 0)]++;
              }
            }
          }
          return counts;
        },
        { base64: png.toString('base64'), canvasBounds, skyBounds },
      );
      expect(Math.min(...quadrants)).toBeGreaterThan(25);
      expect(Math.max(...quadrants) / Math.min(...quadrants)).toBeLessThan(2.5);
    }
  }
});

test('renders repeatable terran clouds and updates them with the splash controls', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(pinnedSplash('/splash(left:intro)'));
  const overlay = page.locator('app-splash-overlay section');
  await expect(overlay).toHaveAttribute('data-state', 'ready');
  const canvas = page.locator('ngt-canvas canvas').first();
  const withClouds = await canvas.screenshot();
  await page.getByRole('checkbox', { name: 'Terran clouds' }).uncheck();
  await expect(page.getByRole('slider', { name: /Cloud coverage/ })).toBeDisabled();
  await expect.poll(async () => canvas.screenshot()).not.toEqual(withClouds);
  const withoutClouds = await canvas.screenshot();
  await page.getByRole('checkbox', { name: 'Terran clouds' }).check();
  await expect.poll(async () => canvas.screenshot()).not.toEqual(withoutClouds);
  const defaultCoverage = await canvas.screenshot();
  await page.getByRole('slider', { name: /Cloud coverage/ }).fill('0');
  await expect.poll(async () => canvas.screenshot()).not.toEqual(defaultCoverage);
  const noCoverage = await canvas.screenshot();
  await page.getByRole('slider', { name: /Cloud coverage/ }).fill('70');
  await expect.poll(async () => canvas.screenshot()).not.toEqual(noCoverage);
  const thinCoverage = await canvas.screenshot();
  await page.getByRole('combobox', { name: 'Cloud style' }).selectOption('thick');
  await expect(page.getByRole('slider', { name: /Cloud coverage/ })).toHaveValue('98');
  await expect.poll(async () => canvas.screenshot()).not.toEqual(thinCoverage);
  const thickCoverage = await canvas.screenshot();
  await page.getByRole('slider', { name: /Cloud coverage/ }).fill('0');
  await expect.poll(async () => canvas.screenshot()).not.toEqual(thickCoverage);
  await page.getByRole('combobox', { name: 'Cloud style' }).selectOption('thin');
  await expect(page.getByRole('slider', { name: /Cloud coverage/ })).toHaveValue('70');
  await page.getByRole('combobox', { name: 'Cloud style' }).selectOption('thick');
  await expect(page.getByRole('slider', { name: /Cloud coverage/ })).toHaveValue('0');
});

test('adjusts storm activity independently of cloud coverage', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(pinnedSplash('/splash(left:intro)'));
  await expect(page.locator('app-splash-overlay section')).toHaveAttribute('data-state', 'ready');
  const canvas = page.locator('ngt-canvas canvas').first();
  const coverage = page.getByRole('slider', { name: /Cloud coverage/ });
  const activity = page.getByRole('slider', { name: /Storm activity/ });
  await page.getByRole('combobox', { name: 'Cloud style' }).selectOption('thick');
  await expect(activity).toHaveValue('60');
  await expect(page.getByText('Storm activity: 60%')).toBeVisible();
  const defaultActivity = await canvas.screenshot();
  await activity.fill('0');
  await expect(page.getByText('Storm activity: 0%')).toBeVisible();
  await expect.poll(async () => canvas.screenshot()).not.toEqual(defaultActivity);
  const calm = await canvas.screenshot();
  await activity.fill('100');
  await expect.poll(async () => canvas.screenshot()).not.toEqual(calm);
  await expect(coverage).toHaveValue('98');
  await page.getByRole('combobox', { name: 'Cloud style' }).selectOption('thin');
  await expect(activity).toHaveValue('100');
  await page.getByRole('checkbox', { name: 'Terran clouds' }).uncheck();
  await expect(activity).toBeDisabled();
});

for (const style of ['thin', 'thick'] as const) {
  test(`keeps ${style} clouds moving while orbit controls pause camera drift`, async ({ page }) => {
    const clockStart = new Date('2026-01-01T00:00:00Z');
    await page.clock.install({ time: clockStart });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(pinnedSplash('/splash(left:intro)'));
    const overlay = page.locator('app-splash-overlay section');
    await expect(overlay).toHaveAttribute('data-state', 'ready');
    await page.getByRole('combobox', { name: 'Cloud style' }).selectOption(style);
    // A deadline beyond the test timeout avoids a browser round-trip timestamp race.
    await page.clock.pauseAt(clockStart.getTime() + 60 * 60 * 1000);
    const cloudAngle = () =>
      page.evaluate(
        (expectedOpacity) => {
          const ngApi = (window as Window & { ng?: { getComponent?: (node: Element) => unknown } }).ng;
          const canvas = document.querySelector('ngt-canvas');
          if (!ngApi?.getComponent || !canvas) throw new Error('Splash canvas is unavailable');
          const component = ngApi.getComponent(canvas) as { store: { snapshot: { scene: Scene } } };
          let angle: number | undefined;
          component.store.snapshot.scene.traverse((node) => {
            if (node.type !== 'Mesh') return;
            const mesh = node as Mesh;
            const material = mesh.material as MeshStandardMaterial;
            const image: unknown = material.map?.image;
            if (
              material.transparent &&
              material.opacity === expectedOpacity &&
              typeof image === 'object' &&
              image !== null &&
              'width' in image &&
              typeof image.width === 'number' &&
              image.width >= 256
            ) {
              angle = mesh.rotation.y;
            }
          });
          if (angle === undefined) throw new Error('Cloud mesh is unavailable');
          return angle;
        },
        style === 'thick' ? 1 : 0.7,
      );
    const expectCloudMotion = async () => {
      const start = await cloudAngle();
      // Each jump fires one frame; multiple jumps respect the production delta clamp.
      for (let frame = 0; frame < 10; frame++) await page.clock.fastForward(50);
      expect(await cloudAngle()).toBeGreaterThan(start + 0.003);
    };
    await expectCloudMotion();
    const bounds = await page.locator('ngt-canvas canvas').first().boundingBox();
    expect(bounds).not.toBeNull();
    const x = bounds!.x + bounds!.width / 2;
    const y = bounds!.y + bounds!.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 100, y - 40, { steps: 8 });
    await page.clock.fastForward(50);
    await expect(overlay).toHaveAttribute('data-motion', 'orbit');
    await expectCloudMotion();
    await expect(overlay).toHaveAttribute('data-motion', 'orbit');
    await page.mouse.up();
  });
}

test('rotates storm texture locally even when the cloud shell is still', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(pinnedSplash('/splash(left:intro)'));
  await expect(page.locator('app-splash-overlay section')).toHaveAttribute('data-state', 'ready');
  await page.getByRole('combobox', { name: 'Cloud style' }).selectOption('thick');
  await page.evaluate(() => {
    const ngApi = (window as Window & { ng?: { getComponent?: (node: Element) => unknown } }).ng;
    const canvas = document.querySelector('ngt-canvas');
    if (!ngApi?.getComponent || !canvas) throw new Error('Splash canvas is unavailable');
    const component = ngApi.getComponent(canvas) as { store: { snapshot: { scene: Scene; invalidate: () => void } } };
    let found = false;
    component.store.snapshot.scene.traverse((node) => {
      if (node.type !== 'Mesh') return;
      const material = (node as Mesh).material as MeshStandardMaterial;
      if (material.customProgramCacheKey() !== 'planet-cloud-storms-v1') return;
      found = true;
      const compile = material.onBeforeCompile;
      material.onBeforeCompile = (shader, renderer) => {
        compile(shader, renderer);
        (window as Window & { cloudStormTime?: { value: number } }).cloudStormTime = shader.uniforms[
          'cloudStormTime'
        ] as { value: number };
      };
      material.customProgramCacheKey = () => 'planet-cloud-storms-v1-test';
      material.needsUpdate = true;
    });
    if (!found) throw new Error('No cloud storm material in the splash scene');
    component.store.snapshot.invalidate();
  });
  await page.waitForFunction(() => (window as Window & { cloudStormTime?: { value: number } }).cloudStormTime);
  const renderAt = (angle: number) =>
    page.evaluate(async (value) => {
      const clock = (window as Window & { cloudStormTime?: { value: number } }).cloudStormTime;
      const ngApi = (window as Window & { ng?: { getComponent?: (node: Element) => unknown } }).ng;
      const canvas = document.querySelector('ngt-canvas');
      if (!clock || !canvas || !ngApi?.getComponent) throw new Error('Storm shader is unavailable');
      const component = ngApi.getComponent(canvas) as { store: { snapshot: { invalidate: () => void } } };
      clock.value = value;
      component.store.snapshot.invalidate();
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    }, angle);
  const canvas = page.locator('ngt-canvas canvas').first();
  await renderAt(0);
  const still = await canvas.screenshot();
  await renderAt(0);
  expect(await canvas.screenshot()).toEqual(still);
  await renderAt(Math.PI / 2);
  expect(await canvas.screenshot()).not.toEqual(still);
});

test('uses low quality on mobile with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(pinnedSplash('/splash(left:intro)'));
  const overlay = page.locator('app-splash-overlay section');
  await expect(overlay).toHaveAttribute('data-quality', 'low');
  await expect(overlay).toHaveAttribute('data-state', 'ready');
  await expect(page.getByLabel('3D model diagnostics')).toContainText('Low GLB (50k triangles)');
  await expect(page.getByLabel('3D model diagnostics')).toContainText(/3D ready in \d+\.\d{2} s/);
  await expect(overlay).toHaveAttribute('data-motion', 'still');
  await expect(page.getByRole('button', { name: 'Use still image' })).toBeVisible();
});

test('orbits with the mouse, then resumes cinematic drift from the selected angle', async ({ page }) => {
  await page.goto(pinnedSplash('/splash(left:intro)'));
  const overlay = page.locator('app-splash-overlay section');
  await expect(overlay).toHaveAttribute('data-state', 'ready');
  await expect(overlay).toHaveAttribute('data-motion', 'drift');
  await expect(overlay).toContainText('Drag or swipe to orbit');
  const canvas = page.locator('ngt-canvas canvas').first();
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  const x = bounds!.x + bounds!.width / 2;
  const y = bounds!.y + bounds!.height / 2;
  const before = await canvas.screenshot();
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 130, y - 50, { steps: 8 });
  await expect(overlay).toHaveAttribute('data-motion', 'orbit');
  await page.mouse.up();
  expect(await canvas.screenshot()).not.toEqual(before);
  await expect(overlay).toHaveAttribute('data-motion', 'drift', { timeout: 5500 });
  await expect(overlay).toHaveAttribute('data-state', 'ready');
});

test.describe('Mobile splash gestures', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('orbits by touch on a mobile viewport without enabling automatic reduced-motion drift', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(pinnedSplash('/splash(left:intro)'));
    const overlay = page.locator('app-splash-overlay section');
    await expect(overlay).toHaveAttribute('data-state', 'ready');
    await expect(overlay).toHaveAttribute('data-motion', 'still');
    await page.getByRole('button', { name: 'Show all right', exact: true }).tap();
    const canvas = page.locator('ngt-canvas canvas').first();
    const bounds = await canvas.boundingBox();
    expect(bounds).not.toBeNull();
    const x = Math.round(bounds!.x + bounds!.width / 2);
    // Keep both gestures above the body/cloud controls and away from the splitter.
    const y = Math.round(bounds!.y + bounds!.height / 4);
    expect(
      await canvas.evaluate(
        (element, points) => points.every((point) => document.elementFromPoint(point.x, point.y) === element),
        [
          { x, y },
          { x: x + 75, y: y - 30 },
          { x: x - 25, y },
          { x: x + 25, y },
          { x: x - 65, y },
          { x: x + 65, y },
        ],
      ),
    ).toBe(true);
    const beforeOrbit = await canvas.screenshot();
    const cdp = await page.context().newCDPSession(page);
    try {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x, y, id: 1 }],
      });
      await expect(overlay).toHaveAttribute('data-motion', 'orbit');
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: x + 75, y: y - 30, id: 1 }],
      });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect(overlay).toHaveAttribute('data-motion', 'still', { timeout: 5500 });
      expect(await canvas.screenshot()).not.toEqual(beforeOrbit);

      const beforePinch = await canvas.screenshot();
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [
          { x: x - 25, y, id: 1 },
          { x: x + 25, y, id: 2 },
        ],
      });
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          { x: x - 65, y, id: 1 },
          { x: x + 65, y, id: 2 },
        ],
      });
      await expect(overlay).toHaveAttribute('data-motion', 'orbit');
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await expect(overlay).toHaveAttribute('data-motion', 'still', { timeout: 5500 });
      expect(await canvas.screenshot()).not.toEqual(beforePinch);
    } finally {
      await cdp.detach();
    }
  });
});

test('keeps a chosen static view when a pending asset request fails later', async ({ page }) => {
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/asteroid-mining-rig.*.glb*', async (route) => {
    await released;
    await route.abort();
  });
  await page.goto(pinnedSplash('/splash(left:login)'));
  await expect(page.locator('section[data-state="loading"] progress')).toBeVisible();
  await page.getByRole('button', { name: 'Use still image' }).click();
  release();
  await expect(page.locator('section[data-state="static"]')).toBeVisible();
  await expect(page.locator('app-login-page')).toBeVisible();
  await page.unroute('**/asteroid-mining-rig.*.glb*');
});

test('uses a static poster when WebGL2 is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'WebGL2RenderingContext', { value: undefined, configurable: true });
  });
  await page.goto('/');
  await expect(page).toHaveURL(/\/splash/);
  await expect(page.locator('app-splash-overlay section')).toHaveAttribute('data-state', 'static');
  await expect(page.locator('app-splash-overlay img')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Load 3D scene' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Welcome to Project Stellar' })).toBeVisible();
});

test('pins the splash planet from the query string', async ({ page }) => {
  await page.goto(pinnedSplash('/splash(left:intro)', 'nova-splash-world-07'));
  const overlay = page.locator('app-splash-overlay section');
  await expect(overlay).toHaveAttribute('data-planet', 'nova-splash-world-07');
  await expect(page.getByLabel('3D model diagnostics')).toContainText('Planet nova-splash-world-07');
  await expect(overlay).toHaveAttribute('data-state', 'ready');
});

test('switches foreground models while preserving the selected background body', async ({ page }) => {
  const requestedAssets: string[] = [];
  const errors: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('.glb')) requestedAssets.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(pinnedSplash('/splash', 'sol-mars'));
  const overlay = page.locator('app-splash-overlay section');
  const foreground = page.getByRole('combobox', { name: 'Foreground', exact: true });
  await expect(overlay).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  await expect(foreground).toHaveValue('asteroid-mining-rig');
  await page.getByRole('combobox', { name: 'Body type', exact: true }).selectOption('sol');
  await page.getByRole('combobox', { name: 'Body', exact: true }).selectOption('sol-earth');
  await expect(page.getByTestId('splash-current-body')).toHaveText('Showing: Earth');

  await foreground.selectOption('station');
  await expect(overlay).toHaveAttribute('data-model', 'station');
  await expect(overlay).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  await expect(foreground).toHaveValue('station');
  const initialQuality = await overlay.getAttribute('data-quality');
  const initialCandidate = initialQuality === 'standard' ? '150k' : '75k';
  expect(requestedAssets.at(-1)).toContain(`sol-mars-station-${initialCandidate}.glb`);
  await expect(overlay).toHaveAttribute('data-planet', 'sol-earth');
  await expect(page.getByRole('combobox', { name: 'Body type', exact: true })).toHaveValue('sol');
  await expect(page.getByRole('combobox', { name: 'Body', exact: true })).toHaveValue('sol-earth');

  const nextTriangles = initialQuality === 'standard' ? '74,695' : '139,330';
  const nextTier = initialQuality === 'standard' ? 'Low' : 'Standard';
  await page.getByRole('button', { name: `Load ${nextTier} (${nextTriangles} triangles)`, exact: true }).click();
  await expect(overlay).toHaveAttribute('data-triangles', nextTriangles.replace(',', ''));
  await expect(overlay).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  expect(requestedAssets.at(-1)).toContain(`sol-mars-station-${initialQuality === 'standard' ? '75k' : '150k'}.glb`);
  const finalQuality = initialQuality === 'standard' ? 'low' : 'standard';

  await foreground.selectOption('asteroid-mining-rig');
  await expect(overlay).toHaveAttribute('data-model', 'asteroid-mining-rig');
  await expect(overlay).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  await expect(overlay).toHaveAttribute('data-quality', finalQuality);
  await expect(overlay).toHaveAttribute('data-planet', 'sol-earth');
  await expect(page.getByRole('combobox', { name: 'Body type', exact: true })).toHaveValue('sol');
  await expect(page.getByRole('combobox', { name: 'Body', exact: true })).toHaveValue('sol-earth');
  expect(requestedAssets.at(-1)).toContain(`asteroid-mining-rig.${finalQuality}.glb`);
  await page.getByRole('button', { name: 'Use still image' }).click();
  await expect(overlay.locator('img')).toHaveAttribute('src', /models\/mining-splash-poster\.webp/);
  expect(errors).toEqual([]);
});

test('loads the market-specific station pair and its isolated static fallback', async ({ page }) => {
  const requestedAssets: string[] = [];
  page.on('request', (request) => requestedAssets.push(request.url()));
  await page.goto('/splash?market=sol-mars-orbit');
  const overlay = page.locator('app-splash-overlay section');
  await expect(overlay).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  await expect(overlay).toHaveAttribute('data-market', 'sol-mars-orbit');
  await expect(overlay).toHaveAttribute('data-model', 'station');
  await expect(overlay).toHaveAttribute('data-planet', 'sol-mars');
  await expect(overlay).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await expect(overlay.locator('img')).toHaveCount(0);
  const quality = await overlay.getAttribute('data-quality');
  const initialCandidate = quality === 'standard' ? '150k' : '75k';
  const initialTriangles = quality === 'standard' ? '139330' : '74695';
  await expect(overlay).toHaveAttribute('data-triangles', initialTriangles);
  expect(requestedAssets.some((url) => url.includes(`sol-mars-station-${initialCandidate}.glb?v=`))).toBe(true);
  expect(requestedAssets.some((url) => /sol-mars-station-poster\.webp\?v=/.test(url))).toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const canvas = document.querySelector('app-root ngt-canvas');
        if (!canvas) throw new Error('Splash canvas is missing.');
        const api = (window as Window & { ng: { getComponent: (element: Element) => unknown } }).ng;
        const component = api.getComponent(canvas) as {
          store: { snapshot: { scene: Scene; camera: PerspectiveCamera } };
        };
        const { scene, camera } = component.store.snapshot;
        const planet = scene.getObjectByName('sol-mars') as Mesh | undefined;
        const ring = scene.getObjectByName('HabitatRing');
        if (!planet || !ring) throw new Error('Mars or the station is missing.');
        const center = planet.getWorldPosition(planet.position.clone());
        const projected = center.clone().project(camera);
        planet.geometry.computeBoundingSphere();
        const scale = planet.getWorldScale(planet.scale.clone());
        const radius = planet.geometry.boundingSphere!.radius * Math.max(scale.x, scale.y, scale.z);
        const forward = camera.getWorldDirection(camera.position.clone());
        const planetDepth = center.sub(camera.position).dot(forward);
        const stationDepth = ring.getWorldPosition(ring.position.clone()).sub(camera.position).dot(forward);
        return {
          planetInView: Math.abs(projected.x) < 1 && Math.abs(projected.y) < 1 && projected.z > -1 && projected.z < 1,
          planetBehindStation: planetDepth - radius > stationDepth,
        };
      }),
    )
    .toEqual({ planetInView: true, planetBehindStation: true });
  await expectStationHabitatMotion(page, 'app-root ngt-canvas');

  await page.getByRole('button', { name: 'Use still image' }).click();
  await expect(overlay).toHaveAttribute('data-state', 'static');
  await expect(overlay).toHaveCSS('background-color', 'rgb(4, 9, 20)');
  await expect(page.locator('app-splash-overlay img')).toHaveAttribute('src', /sol-mars-station-poster\.webp/);
});

for (const path of ['/knot', '/knot(left:intro)']) {
  test(`redirects legacy ${path} links while preserving queries, fragment and outlets`, async ({ page }) => {
    await page.goto(`${path}?market=sol-mars-orbit&splashPlanet=sol-earth#preview`);
    await expect.poll(() => new URL(page.url()).pathname).toBe(path.replace('/knot', '/splash'));
    const url = new URL(page.url());
    expect(url.pathname).toBe(path.replace('/knot', '/splash'));
    expect(url.searchParams.get('market')).toBe('sol-mars-orbit');
    expect(url.searchParams.get('splashPlanet')).toBe('sol-earth');
    expect(url.hash).toBe('#preview');
    const overlay = page.locator('app-splash-overlay section');
    await expect(overlay).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
    await expect(overlay).toHaveAttribute('data-model', 'station');
    await expect(overlay).toHaveAttribute('data-planet', 'sol-earth');
    if (path.includes('left:intro')) {
      await expect(page.getByRole('heading', { name: 'Welcome to Project Stellar' })).toBeVisible();
    }
  });
}

/** Reads the splash gas giant's identity from the live three.js scene. */
async function readSplashGasGiant(page: import('@playwright/test').Page): Promise<unknown> {
  return page.evaluate(() => {
    const ng = (window as unknown as { ng: { getComponent: (el: Element | null) => unknown } }).ng;
    const canvas = ng.getComponent(document.querySelector('ngt-canvas')) as {
      store: { snapshot: { scene: Scene } };
    };
    let found: unknown = null;
    canvas.store.snapshot.scene.traverse((object) => {
      if (object.name === 'gas-giant') found = object.userData['gasGiant'];
    });
    return found;
  });
}

test('renders canonical sol-saturn, selects it in Sol, and survives quality and body swaps', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (/THREE\.WebGLProgram|shader error|INVALID_OPERATION/i.test(message.text())) errors.push(message.text());
  });

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(pinnedSplash('/splash(left:intro)', 'sol-saturn'));
  const overlay = page.locator('app-splash-overlay section');
  await expect(overlay).toHaveAttribute('data-state', 'ready');
  await expect(overlay).toHaveAttribute('data-planet-kind', 'sol');
  const canonical = { bodyId: 'sol-saturn', palette: 'saturnian', rings: true };
  await expect.poll(() => readSplashGasGiant(page)).toEqual(canonical);
  await expect(page.getByRole('combobox', { name: 'Giant palette' })).toHaveCount(0);
  await expect(page.getByTestId('splash-body-credit')).toContainText('NASA');
  await page.getByRole('button', { name: /Load (Low|Standard)/ }).click();
  await expect(overlay).toHaveAttribute('data-state', 'ready');
  await expect.poll(() => readSplashGasGiant(page)).toEqual(canonical);
  await page.getByRole('combobox', { name: 'Body type' }).selectOption('sol');
  for (let swap = 0; swap < 3; swap++) {
    await page.locator('#splash-body').selectOption('sol-mars');
    await expect(overlay).toHaveAttribute('data-planet', 'sol-mars');
    await expect.poll(() => readSplashGasGiant(page)).toBeNull();
    await page.locator('#splash-body').selectOption('sol-saturn');
    await expect.poll(() => readSplashGasGiant(page)).toEqual(canonical);
  }
  expect(errors).toEqual([]);
});

test('renders a pinned gas giant with its own controls and no shader errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') consoleErrors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(pinnedSplash('/splash(left:intro)', 'nova-splash-giant-05'));
  const overlay = page.locator('app-splash-overlay section');
  await expect(overlay).toHaveAttribute('data-state', 'ready');
  await expect(overlay).toHaveAttribute('data-planet-kind', 'gas-giant');
  await expect(page.getByRole('checkbox', { name: 'Terran clouds' })).toHaveCount(0);
  await expect(page.getByRole('slider', { name: /Storm activity/ })).toBeVisible();
  await expect
    .poll(() => readSplashGasGiant(page))
    .toEqual({
      bodyId: 'nova-splash-giant-05',
      palette: 'saturnian',
      rings: true,
    });

  const canvas = page.locator('ngt-canvas canvas').first();
  const seeded = await canvas.screenshot();
  await page.getByRole('combobox', { name: 'Giant palette' }).selectOption('ice');
  await page.getByRole('combobox', { name: 'Rings' }).selectOption('off');
  await expect
    .poll(() => readSplashGasGiant(page))
    .toEqual({
      bodyId: 'nova-splash-giant-05',
      palette: 'ice',
      rings: false,
    });
  await expect.poll(async () => canvas.screenshot()).not.toEqual(seeded);
  expect(
    consoleErrors.filter((text) => /Shader Error|not compiled|WebGLProgram|INVALID_OPERATION/i.test(text)),
  ).toEqual([]);
});

test('previews an unlisted body as a gas giant with splashKind', async ({ page }) => {
  await page.goto(`${pinnedSplash('/splash(left:intro)', 'preview-me')}&splashKind=gas-giant`);
  const overlay = page.locator('app-splash-overlay section');
  await expect(overlay).toHaveAttribute('data-state', 'ready');
  await expect(overlay).toHaveAttribute('data-planet-kind', 'gas-giant');
  await expect.poll(() => readSplashGasGiant(page)).toMatchObject({ bodyId: 'preview-me' });
});

/** Reads the splash star's identity from the live three.js scene. */
async function readSplashStar(page: import('@playwright/test').Page): Promise<unknown> {
  return page.evaluate(() => {
    const ng = (window as unknown as { ng: { getComponent: (el: Element | null) => unknown } }).ng;
    const canvas = ng.getComponent(document.querySelector('ngt-canvas')) as {
      store: { snapshot: { scene: Scene } };
    };
    let found: unknown = null;
    canvas.store.snapshot.scene.traverse((object) => {
      if (object.name === 'star') found = object.userData['star'];
    });
    return found;
  });
}

test('renders a pinned star with its spectral class, flare control and no shader errors', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') consoleErrors.push(message.text());
  });
  await page.goto(pinnedSplash('/splash(left:intro)', 'nova-splash-star-g'));
  const overlay = page.locator('app-splash-overlay section');
  await expect(overlay).toHaveAttribute('data-state', 'ready');
  await expect(overlay).toHaveAttribute('data-planet-kind', 'star');
  await expect(page.getByTestId('splash-star-class')).toContainText('G2V');
  await expect(page.getByRole('checkbox', { name: 'Terran clouds' })).toHaveCount(0);
  const flare = page.getByRole('slider', { name: /Flare activity/ });
  await expect(flare).toBeVisible();
  await expect
    .poll(() => readSplashStar(page))
    .toMatchObject({
      bodyId: 'nova-splash-star-g',
      letter: 'G',
      subtype: 2,
      luminosityClass: 'V',
    });
  await flare.fill('100');
  await expect(flare).toHaveValue('100');

  const starClass = page.getByRole('combobox', { name: 'Star class' });
  await expect(starClass).toHaveValue('seeded');
  await starClass.selectOption('M4V');
  await expect(page.getByTestId('splash-star-class')).toContainText('M4V');
  await expect
    .poll(() => readSplashStar(page))
    .toMatchObject({
      bodyId: 'nova-splash-star-g',
      letter: 'M',
      subtype: 4,
      luminosityClass: 'V',
    });
  await starClass.selectOption('seeded');
  await expect(page.getByTestId('splash-star-class')).toContainText('G2V');
  await expect.poll(() => readSplashStar(page)).toMatchObject({ letter: 'G', subtype: 2 });
  expect(
    consoleErrors.filter((text) => /Shader Error|not compiled|WebGLProgram|INVALID_OPERATION/i.test(text)),
  ).toEqual([]);
});

test('previews an unlisted body as a star with splashKind and splashSpectralClass', async ({ page }) => {
  await page.goto(`${pinnedSplash('/splash(left:intro)', 'preview-star')}&splashKind=star&splashSpectralClass=K5III`);
  const overlay = page.locator('app-splash-overlay section');
  await expect(overlay).toHaveAttribute('data-state', 'ready');
  await expect(overlay).toHaveAttribute('data-planet-kind', 'star');
  await expect(page.getByTestId('splash-star-class')).toContainText('K5III');
  await expect
    .poll(() => readSplashStar(page))
    .toMatchObject({
      bodyId: 'preview-star',
      letter: 'K',
      subtype: 5,
      luminosityClass: 'III',
    });
});

test('picks the splash planet from the rotation when not pinned', async ({ page }) => {
  await page.goto('/splash(left:intro)');
  const planet = await page.locator('app-splash-overlay section').getAttribute('data-planet');
  expect(SPLASH_PLANET_ROTATION.map((entry) => entry.id)).toContain(planet);
});

/** Names of the scene objects that identify the displayed splash body. */
async function readSplashBodyNames(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() => {
    const ng = (window as unknown as { ng: { getComponent: (el: Element | null) => unknown } }).ng;
    const canvas = ng.getComponent(document.querySelector('ngt-canvas')) as {
      store: { snapshot: { scene: Scene } };
    };
    const names: string[] = [];
    canvas.store.snapshot.scene.traverse((object) => {
      if (
        object.name === 'star' ||
        object.name === 'gas-giant' ||
        object.name.startsWith('sol-') ||
        object.name.startsWith('nova-splash-icy-moon-') ||
        object.name.startsWith('nova-splash-rocky-moon-')
      ) {
        names.push(object.name);
      }
    });
    return names;
  });
}

/** Resolves once the scene shows the body named by `data-planet` (procedural terran bodies have no named root). */
async function expectSplashBodySettled(page: import('@playwright/test').Page): Promise<string> {
  const overlay = page.locator('app-splash-overlay section');
  let settled = '';
  await expect
    .poll(
      async () => {
        const id = (await overlay.getAttribute('data-planet')) ?? '';
        const names = await readSplashBodyNames(page);
        settled = id;
        if (id.startsWith('sol-')) return names.length === 1 && names[0] === id;
        if (id.includes('-icy-moon-') || id.includes('-rocky-moon-')) return names.length === 1 && names[0] === id;
        if (id.includes('-star-')) return names.length === 1 && names[0] === 'star';
        if (id.includes('-giant-')) return names.length === 1 && names[0] === 'gas-giant';
        return names.length === 0;
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  return settled;
}

for (const kind of ['icy-moon', 'rocky-moon'] as const) {
  test(`selects ${kind} without Terran clouds or reloading the rig`, async ({ page }, testInfo) => {
    const bodyId = `nova-splash-${kind}-01`;
    const errors: string[] = [];
    const glbs: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (/Shader Error|not compiled|WebGLProgram|INVALID_OPERATION/i.test(message.text())) errors.push(message.text());
    });
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.endsWith('.glb')) glbs.push(request.url());
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(pinnedSplash('/splash(left:intro)'));
    const overlay = page.locator('app-splash-overlay section');
    await expect(overlay).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
    await page.getByRole('combobox', { name: 'Body type' }).selectOption(kind);
    await page.getByRole('combobox', { name: 'Body', exact: true }).selectOption(bodyId);
    await expect(overlay).toHaveAttribute('data-planet-kind', kind);
    await expect.poll(() => readSplashBodyNames(page)).toEqual([bodyId]);
    await expect(page.getByTestId('splash-current-body')).toContainText(
      kind === 'icy-moon' ? 'Icy moon 01' : 'Rocky moon 01',
    );
    await expect(page.getByRole('checkbox', { name: 'Terran clouds' })).toHaveCount(0);
    const hasNormal = (await overlay.getAttribute('data-quality')) === 'standard';
    await expect
      .poll(() =>
        page.evaluate((bodyId) => {
          const ng = (window as Window & { ng?: { getComponent: (element: Element) => unknown } }).ng;
          const canvas = document.querySelector('ngt-canvas');
          if (!ng || !canvas) return null;
          const component = ng.getComponent(canvas) as { store: { snapshot: { scene: Scene } } };
          const moon = component.store.snapshot.scene.getObjectByName(bodyId) as Mesh | undefined;
          const material = moon?.material as MeshStandardMaterial | undefined;
          return {
            map: !!material?.map,
            normal: !!material?.normalMap,
            material: !!material?.roughnessMap,
            children: moon?.children.length,
          };
        }, bodyId),
      )
      .toMatchObject({ map: true, normal: hasNormal, material: true, children: 0 });
    await page.screenshot({ path: testInfo.outputPath(`${kind}-splash.png`) });
    expect(glbs).toHaveLength(1);
    expect(errors).toEqual([]);
  });

  test(`pins and shuffles ${kind} at low splash quality without a cloud shell`, async ({ page }) => {
    const glbs: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).pathname.endsWith('.glb')) glbs.push(request.url());
    });
    await page.setViewportSize({ width: 700, height: 800 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const bodyId = `nova-splash-${kind}-01`;
    await page.goto(pinnedSplash('/splash(left:intro)', bodyId));
    const overlay = page.locator('app-splash-overlay section');
    await expect(overlay).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
    await expect(overlay).toHaveAttribute('data-quality', 'low');
    await expect.poll(() => readSplashBodyNames(page)).toEqual([bodyId]);
    await expect(page.getByRole('checkbox', { name: 'Terran clouds' })).toHaveCount(0);
    const category = page.getByRole('combobox', { name: 'Body type' });
    await category.selectOption(kind);
    await expect(overlay).not.toHaveAttribute('data-planet', bodyId);
    const currentId = await expectSplashBodySettled(page);
    await page.getByRole('button', { name: 'Shuffle' }).click();
    await expect(overlay).not.toHaveAttribute('data-planet', currentId);
    expect(await expectSplashBodySettled(page)).not.toBe(currentId);
    await expect(overlay).toHaveAttribute('data-planet-kind', kind);
    expect(glbs).toHaveLength(1);
    await category.selectOption('terran');
    await expect(page.getByRole('checkbox', { name: 'Terran clouds' })).toBeVisible();
  });
}

test('swaps the splash body in place from the overlay picker without reloading the rig', async ({ page }) => {
  const consoleErrors: string[] = [];
  const glbRequests: string[] = [];
  const requests: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') consoleErrors.push(message.text());
  });
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('.glb')) glbRequests.push(request.url());
    if (url.protocol.startsWith('http')) requests.push(request.url());
  });
  await page.goto(pinnedSplash('/splash(left:intro)'));
  const overlay = page.locator('app-splash-overlay section');
  await expect(overlay).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  const category = page.getByRole('combobox', { name: 'Body type' });
  await expect(category).toHaveValue('random');
  await expect(page.getByRole('combobox', { name: 'Body', exact: true })).toHaveCount(0);

  await category.selectOption('star');
  await expect(overlay).toHaveAttribute('data-planet-kind', 'star');
  const body = page.getByRole('combobox', { name: 'Body', exact: true });
  await body.selectOption('nova-splash-star-g');
  await expect(overlay).toHaveAttribute('data-planet', 'nova-splash-star-g');
  await expect(page.getByTestId('splash-star-class')).toContainText('G2V');
  await expect.poll(() => readSplashBodyNames(page)).toEqual(['star']);

  await category.selectOption('sol');
  await body.selectOption('sol-mars');
  await expect(overlay).toHaveAttribute('data-planet', 'sol-mars');
  await expect(page.getByTestId('splash-current-body')).toContainText('Mars');
  await expect(page.getByTestId('splash-body-credit')).toContainText('Viking');
  await expect(page.getByRole('checkbox', { name: 'Terran clouds' })).toHaveCount(0);
  await expect.poll(() => readSplashBodyNames(page), { timeout: 30_000 }).toEqual(['sol-mars']);

  await body.selectOption('sol-earth');
  await expect.poll(() => readSplashBodyNames(page), { timeout: 30_000 }).toEqual(['sol-earth']);
  await expect(page.getByRole('checkbox', { name: 'Terran clouds' })).toBeVisible();

  await page.getByRole('button', { name: 'Shuffle' }).click();
  await expect(overlay).toHaveAttribute('data-planet-kind', 'sol');
  await expect(overlay).not.toHaveAttribute('data-planet', 'sol-earth');
  expect(await expectSplashBodySettled(page)).toMatch(/^sol-/);
  await expect(page.getByTestId('splash-body-error')).toHaveCount(0);

  await expect(overlay).toHaveAttribute('data-state', 'ready');
  expect(glbRequests).toHaveLength(1);
  const origin = new URL(page.url()).origin;
  expect(requests.filter((url) => !url.startsWith(origin))).toEqual([]);
  expect(
    consoleErrors.filter((text) => /Shader Error|not compiled|WebGLProgram|INVALID_OPERATION/i.test(text)),
  ).toEqual([]);
});

test('keeps the previous splash body when a picked body fails to load', async ({ page }) => {
  await page.route('**/textures/sol/**', (route) => route.abort());
  await page.goto(pinnedSplash('/splash(left:intro)'));
  const overlay = page.locator('app-splash-overlay section');
  await expect(overlay).toHaveAttribute('data-state', 'ready', { timeout: 30_000 });
  await page.getByRole('combobox', { name: 'Body type' }).selectOption('sol');
  // Switching category draws a random Sol body; procedural Titan can still load, the rest are blocked.
  const displayed = await expectSplashBodySettled(page);
  const target = displayed === 'sol-luna' ? 'sol-mars' : 'sol-luna';
  await page.getByRole('combobox', { name: 'Body', exact: true }).selectOption(target);
  await expect(page.getByTestId('splash-body-error')).toBeVisible({ timeout: 30_000 });
  await expect(overlay).toHaveAttribute('data-planet', displayed);
  await expect(overlay).toHaveAttribute('data-state', 'ready');
});

test('switches between the 154k, 50k and still-image tiers on demand', async ({ page }) => {
  await page.goto(pinnedSplash('/splash(left:intro)'));
  const overlay = page.locator('app-splash-overlay section');
  const diagnostics = page.getByLabel('3D model diagnostics');
  const labels = { standard: 'Standard GLB (154k triangles)', low: 'Low GLB (50k triangles)' } as const;
  const buttons = { standard: 'Load Standard (154,757 triangles)', low: 'Load Low (50,239 triangles)' } as const;
  const other = (tier: 'standard' | 'low') => (tier === 'standard' ? 'low' : 'standard');
  await expect(overlay).toHaveAttribute('data-state', 'ready');
  const initial = (await overlay.getAttribute('data-quality')) as 'standard' | 'low';
  await expect(page.getByRole('button', { name: buttons[initial] })).toHaveCount(0);

  await page.getByRole('button', { name: buttons[other(initial)] }).click();
  await expect(overlay).toHaveAttribute('data-quality', other(initial));
  await expect(overlay).toHaveAttribute('data-state', 'ready');
  await expect(diagnostics).toContainText(labels[other(initial)]);
  await expect(page.getByRole('button', { name: buttons[other(initial)] })).toHaveCount(0);

  await page.getByRole('button', { name: 'Use still image' }).click();
  await expect(overlay).toHaveAttribute('data-state', 'static');
  await expect(diagnostics).toContainText('Still image');
  await expect(page.getByRole('button', { name: 'Load 3D scene' })).toBeVisible();
  await page.getByRole('button', { name: buttons[initial] }).click();
  await expect(overlay).toHaveAttribute('data-quality', initial);
  await expect(overlay).toHaveAttribute('data-state', 'ready');
  await expect(diagnostics).toContainText(labels[initial]);
});
