import { expect, test } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { registerViewerSolarSystemList } from '../fixtures/viewer-fixture-helpers';
import { SOL_SUMMARY, SOL_SYSTEM_BODIES, solarSystemGetResponse } from '../fixtures/viewer-scene-rendering-scenario';
import { loginViaUI, openLoginAndWaitForSocket, TEST_PASSWORD, TEST_PLAYER, TEST_SESSION_KEY } from '../helpers/auth-helper';
import { ViewerPage } from '../page-objects/viewer.page';

test.describe('Public Settings', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('preserves the graph setting through login without reloading the application', async ({ page }) => {
    const mock = new SocketIOMock(page);
    await mock.setup();
    mock.on('login', () => ({
      event: 'login-response',
      data: { success: true, message: '', sessionKey: TEST_SESSION_KEY, playerId: 'player-id-001' },
    }));
    await openLoginAndWaitForSocket(page, mock);
    const settingsButton = page.getByRole('button', { name: 'Settings', exact: true });
    await settingsButton.click();
    const checkbox = page.getByRole('checkbox', { name: 'Show 3d performance graphs', exact: true });
    await checkbox.check();
    await expect(page.locator('app-root')).toHaveClass(/show-render-stats/);
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await page.locator('#playerName').fill(TEST_PLAYER);
    await page.locator('#password').fill(TEST_PASSWORD);
    await page.locator('#password').press('Enter');
    await expect(page).toHaveURL(/left:character-list/);
    await expect(page.locator('app-root')).toHaveClass(/show-render-stats/);
    await settingsButton.click();
    await expect(checkbox).toBeChecked();
    await page.getByRole('button', { name: 'Logout', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm Logout', exact: true }).click();
    await expect(page).toHaveURL(/left:login/);
    await expect(page.locator('app-root')).not.toHaveClass(/show-render-stats/);
  });

  test('offers a discreet gear on public pages and returns without replacing the scene', async ({ page }) => {
    await new SocketIOMock(page).setup();
    for (const route of ['intro', 'login', 'registration']) {
      await page.goto(`/splash(left:${route})#public-settings`);
      const scene = await page.locator('#app-right-panel ngt-canvas').elementHandle();
      const gear = page.getByRole('button', { name: 'Settings', exact: true });
      await expect(gear.locator('svg')).toBeAttached();
      await gear.click();
      await expect(page).toHaveURL(/splash\(left:settings\)#public-settings/);
      await expect(page.locator('app-guarded-left-menu')).toHaveCount(0);
      await expect(page.locator('app-character-ship-badge')).toHaveCount(0);
      const checkbox = page.getByRole('checkbox', { name: 'Show 3d performance graphs', exact: true });
      await expect(checkbox).not.toBeChecked();
      await checkbox.check();
      await expect(page.locator('.stats canvas').first()).toBeVisible();
      expect(await scene?.evaluate((element) => element.isConnected)).toBe(true);
      await page.getByRole('button', { name: 'Back', exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`left:${route}\\)#public-settings`));
      await gear.click();
      await expect(checkbox).toBeChecked();
      await checkbox.uncheck();
    }
    await page.goto('/splash(left:settings)');
    await expect(page.getByRole('checkbox', { name: 'Show 3d performance graphs' })).not.toBeChecked();
    await page.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(page).toHaveURL(/left:login/);
  });
});

test('keeps a single graph overlay when a viewer scene mounts and Settings leaves it in place', async ({ page }) => {
  const mock = new SocketIOMock(page);
  await mock.setup();
  registerViewerSolarSystemList(mock, { solarSystems: [SOL_SUMMARY] });
  mock.on('solar-system-get-request', () => ({
    event: 'solar-system-get-response',
    data: solarSystemGetResponse(SOL_SYSTEM_BODIES),
  }));
  await loginViaUI(page, mock);
  await page.goto('/splash(left:settings)');
  const checkbox = page.getByRole('checkbox', { name: 'Show 3d performance graphs', exact: true });
  await checkbox.check();
  await expect(page.locator('app-root > .stats canvas').first()).toBeVisible();
  await page.getByRole('button', { name: 'Viewer', exact: true }).click();
  const viewer = new ViewerPage(page);
  await viewer.selectSystem('Sol');
  await viewer.expectSceneLoaded();
  await expect(viewer.sceneContainer.locator('.stats canvas').first()).toBeVisible();
  await expect(page.locator('app-root > .stats canvas').first()).toBeHidden();
  await expect(page.locator('.stats:has(canvas:visible)')).toHaveCount(1);
  const sceneCanvas = await viewer.sceneCanvas.elementHandle();

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page).toHaveURL(/left:settings.*right:viewer-scene/);
  expect(await sceneCanvas?.evaluate((element) => element.isConnected)).toBe(true);
  await expect(checkbox).toBeChecked();
  await checkbox.uncheck();
  await expect(page.locator('.stats:has(canvas:visible)')).toHaveCount(0);
});

for (const primary of ['splash', 'ship-exterior-view']) {
  test(`Settings controls session-only graphs without replacing the ${primary} scene`, async ({ page }) => {
    const mock = new SocketIOMock(page);
    await mock.setup();
    await loginViaUI(page, mock);
    await page.goto(`/${primary}(left:stellar-initiation)`);

    const settingsButton = page.getByRole('button', { name: 'Settings', exact: true });
    await expect(settingsButton.locator('svg')).toBeAttached();
    const menuButtons = page.locator('app-guarded-left-menu nav > button');
    await expect(menuButtons.nth(-2)).toHaveAttribute('aria-label', 'Settings');
    await expect(menuButtons.last()).toHaveAttribute('aria-label', 'Logout');
    const scene = page.locator(primary === 'splash' ? '#app-right-panel ngt-canvas' : 'app-ship-exterior-bare-scene');
    await expect(scene).toBeAttached();
    const sceneElement = await scene.elementHandle();

    await settingsButton.click();
    await expect(page).toHaveURL(new RegExp(`${primary}\\(left:settings\\)`));
    expect(await sceneElement?.evaluate((element) => element.isConnected)).toBe(true);
    const checkbox = page.getByRole('checkbox', { name: 'Show 3d performance graphs', exact: true });
    await expect(checkbox).not.toBeChecked();
    const visibleGraphs = page.locator('.stats:has(canvas:visible)');
    await expect(visibleGraphs).toHaveCount(0);

    await checkbox.check();
    await expect(visibleGraphs).toHaveCount(1);
    await page.getByRole('button', { name: 'Stellar Initiation', exact: true }).click();
    await expect(page).toHaveURL(/left:stellar-initiation/);
    await settingsButton.click();
    await expect(checkbox).toBeChecked();
    await expect(visibleGraphs).toHaveCount(1);
    expect(await sceneElement?.evaluate((element) => element.isConnected)).toBe(true);
    await checkbox.uncheck();
    await expect(visibleGraphs).toHaveCount(0);
    await checkbox.check();
    await page.reload();
    await expect(checkbox).not.toBeChecked();
    await expect(visibleGraphs).toHaveCount(0);

    await checkbox.check();
    await page.getByRole('button', { name: 'Logout', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm Logout', exact: true }).click();
    await expect(page).toHaveURL(/left:login/);
    await expect(page.locator('app-root')).not.toHaveClass(/show-render-stats/);
    await expect(visibleGraphs).toHaveCount(0);
  });
}
