import { expect, test } from '@playwright/test';
import {
  SPLASH_PLANET_BODY_ID,
  SPLASH_PLANET_QUERY_PARAM,
  SPLASH_PLANET_ROTATION,
} from '../../src/app/scene/planet/splash-planet-rotation';
import { SocketIOMock } from '../fixtures/socket-mock';

/** Pins the rotating splash planet so runs stay repeatable. */
function pinnedSplash(path: string, bodyId = SPLASH_PLANET_BODY_ID): string {
  return `${path}?${SPLASH_PLANET_QUERY_PARAM}=${encodeURIComponent(bodyId)}`;
}

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ page }) => {
  await new SocketIOMock(page).setup();
});

test('shows the scene immediately, loads one real tier, and retains intro controls', async ({ page }) => {
  const assets: string[] = [];
  const requests: string[] = [];
  const errors: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.endsWith('.glb')) assets.push(request.url());
    if (url.protocol.startsWith('http')) requests.push(request.url());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveURL(/\/knot\(left:intro\)/, { timeout: 4500 });
  await expect(page.getByRole('heading', { name: 'Welcome to Project Stellar' })).toBeVisible();
  await expect(page.locator('app-mining-splash-overlay section')).toHaveAttribute('data-state', 'ready');
  const tier = await page.locator('app-mining-splash-overlay section').getAttribute('data-quality');
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
  await expect(page.locator('app-mining-splash-overlay section')).toHaveAttribute('data-state', 'static');
  await expect(diagnostics).toContainText('Still image');
  await expect(page.locator('app-mining-splash-overlay img')).toBeVisible();
  await page.getByRole('button', { name: 'Load 3D scene' }).click();
  await expect(page.locator('app-mining-splash-overlay section')).toHaveAttribute('data-state', 'ready');
});

test('reports asset errors and allows retry without blocking login', async ({ page }) => {
  await page.route('**/asteroid-mining-rig.*.glb*', (route) => route.abort());
  await page.goto(pinnedSplash('/knot(left:login)'));
  await expect(page.locator('app-mining-splash-overlay section')).toHaveAttribute('data-state', 'error');
  await expect(page.getByLabel('3D model diagnostics')).not.toContainText('3D ready in');
  await expect(page.locator('app-login-page')).toBeVisible();
  await page.unroute('**/asteroid-mining-rig.*.glb*');
  await page.getByRole('button', { name: 'Load 3D scene' }).click();
  await expect(page.locator('app-mining-splash-overlay section')).toHaveAttribute('data-state', 'ready');
});

test('renders the splash planet with every third-party host blocked', async ({ page }) => {
  await page.route(/^https?:\/\/(?!localhost|127\.0\.0\.1)/, (route) => route.abort());
  const failures: string[] = [];
  page.on('requestfailed', (request) => failures.push(request.url()));
  await page.goto(pinnedSplash('/knot(left:login)'));
  await expect(page.locator('app-mining-splash-overlay section')).toHaveAttribute('data-state', 'ready');
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
  await page.goto(pinnedSplash('/knot(left:intro)'));
  await expect(page.locator('app-mining-splash-overlay section')).toHaveAttribute('data-state', 'ready');
  expect(
    consoleErrors.filter((text) => /Shader Error|not compiled|WebGLProgram|INVALID_OPERATION/i.test(text)),
  ).toEqual([]);
});

test('uses low quality on mobile with reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(pinnedSplash('/knot(left:intro)'));
  const overlay = page.locator('app-mining-splash-overlay section');
  await expect(overlay).toHaveAttribute('data-quality', 'low');
  await expect(overlay).toHaveAttribute('data-state', 'ready');
  await expect(page.getByLabel('3D model diagnostics')).toContainText('Low GLB (50k triangles)');
  await expect(page.getByLabel('3D model diagnostics')).toContainText(/3D ready in \d+\.\d{2} s/);
  await expect(overlay).toHaveAttribute('data-motion', 'still');
  await expect(page.getByRole('button', { name: 'Use still image' })).toBeVisible();
});

test('orbits with the mouse, then resumes cinematic drift from the selected angle', async ({ page }) => {
  await page.goto(pinnedSplash('/knot(left:intro)'));
  const overlay = page.locator('app-mining-splash-overlay section');
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

test('orbits by touch on a mobile viewport without enabling automatic reduced-motion drift', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(pinnedSplash('/knot(left:intro)'));
  const overlay = page.locator('app-mining-splash-overlay section');
  await expect(overlay).toHaveAttribute('data-state', 'ready');
  const bounds = await page.locator('ngt-canvas canvas').first().boundingBox();
  expect(bounds).not.toBeNull();
  const x = Math.round(bounds!.x + bounds!.width / 2);
  const y = Math.round(bounds!.y + bounds!.height / 2);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y, id: 1 }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: x + 75, y: y - 30, id: 1 }],
  });
  await expect(overlay).toHaveAttribute('data-motion', 'orbit');
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect(overlay).toHaveAttribute('data-motion', 'still', { timeout: 5500 });

  const beforePinch = await page.locator('ngt-canvas canvas').first().screenshot();
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
  expect(await page.locator('ngt-canvas canvas').first().screenshot()).not.toEqual(beforePinch);
  await cdp.detach();
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
  await page.goto(pinnedSplash('/knot(left:login)'));
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
  await expect(page).toHaveURL(/\/knot/);
  await expect(page.locator('app-mining-splash-overlay section')).toHaveAttribute('data-state', 'static');
  await expect(page.locator('app-mining-splash-overlay img')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Load 3D scene' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Welcome to Project Stellar' })).toBeVisible();
});

test('pins the splash planet from the query string', async ({ page }) => {
  await page.goto(pinnedSplash('/knot(left:intro)', 'nova-splash-world-07'));
  const overlay = page.locator('app-mining-splash-overlay section');
  await expect(overlay).toHaveAttribute('data-planet', 'nova-splash-world-07');
  await expect(page.getByLabel('3D model diagnostics')).toContainText('Planet nova-splash-world-07');
  await expect(overlay).toHaveAttribute('data-state', 'ready');
});

test('picks the splash planet from the rotation when not pinned', async ({ page }) => {
  await page.goto('/knot(left:intro)');
  const planet = await page.locator('app-mining-splash-overlay section').getAttribute('data-planet');
  expect(SPLASH_PLANET_ROTATION).toContain(planet);
});

test('switches between the 154k, 50k and still-image tiers on demand', async ({ page }) => {
  await page.goto(pinnedSplash('/knot(left:intro)'));
  const overlay = page.locator('app-mining-splash-overlay section');
  const diagnostics = page.getByLabel('3D model diagnostics');
  const labels = { standard: 'Standard GLB (154k triangles)', low: 'Low GLB (50k triangles)' } as const;
  const buttons = { standard: 'Load 154k triangles', low: 'Load 50k triangles' } as const;
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
