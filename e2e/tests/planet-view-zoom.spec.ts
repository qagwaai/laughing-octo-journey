import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setupPlanetViewZoomViewer } from '../fixtures/planet-view-zoom-scenario';
import { PlanetViewPage } from '../page-objects/planet-view.page';
import { ViewerPage } from '../page-objects/viewer.page';

async function enterPlanetViewViaInspector(page: Page, bodyId = 'earth'): Promise<void> {
  const viewerPage = new ViewerPage(page);
  await viewerPage.expectSceneLoaded();
  await viewerPage.switchToDistanceView();
  const name = bodyId === 'sol-saturn' ? 'Saturn' : bodyId === 'jupiter' ? 'Jupiter' : 'Earth';
  await page.locator('tr', { hasText: name }).locator('button.details-target-btn').click();
  await page.getByTestId('viewer-inspect-target').click();
  await page.getByTestId('viewer-inspector-closeup').click();

  await expect(page).toHaveURL(new RegExp(`right:planet-view/sol/${bodyId}`));
  await expect(new PlanetViewPage(page).header).toBeVisible({ timeout: 10_000 });
}

test.describe('Planet details zoom pattern', () => {
  test('renders canonical sol-saturn in the system and focused views without shader errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (/THREE\.WebGLProgram|shader error|INVALID_OPERATION/i.test(message.text())) errors.push(message.text());
    });
    await setupPlanetViewZoomViewer(page, [
      {
        id: 'sol-saturn',
        bodyType: 'planet',
        surfaceArchetype: 'gas-giant',
        displayName: 'Saturn',
        state: 'unscanned',
        spatial: {
          solarSystemId: 'sol',
          frame: 'barycentric',
          positionKm: { x: 1_426_984_169, y: 0, z: 0 },
          epochMs: 1715000000000,
        },
        physicalCatalog: { radiusKm: 60_268 },
      },
    ]);
    const readSaturn = () =>
      page.evaluate(() => {
        const ng = (window as Window & { ng?: { getComponent(node: Element): unknown } }).ng;
        for (const canvas of document.querySelectorAll('ngt-canvas')) {
          const component = ng?.getComponent(canvas) as
            { store?: { snapshot?: { scene?: import('three').Scene } } } | undefined;
          let state: { palette: string; rings: boolean; polarRatio: number; tilt: number } | null = null;
          component?.store?.snapshot?.scene?.traverse((object) => {
            const data = object.userData['gasGiant'] as { bodyId: string; palette: string; rings: boolean } | undefined;
            if (data?.bodyId === 'sol-saturn') {
              const planet = object.getObjectByName('gas-giant-planet')!;
              state = {
                palette: data.palette,
                rings: data.rings,
                polarRatio: planet.scale.y,
                tilt: planet.parent!.rotation.x,
              };
            }
          });
          if (state) return state;
        }
        return null;
      });
    await new ViewerPage(page).expectSceneLoaded();
    await expect.poll(readSaturn).toMatchObject({ palette: 'saturnian', rings: true });
    expect((await readSaturn())?.polarRatio).toBeCloseTo(54_364 / 60_268, 6);
    await enterPlanetViewViaInspector(page, 'sol-saturn');
    await expect(new PlanetViewPage(page).header).toContainText('Saturn');
    await expect.poll(readSaturn).toMatchObject({ palette: 'saturnian', rings: true });
    expect((await readSaturn())?.tilt).toBeCloseTo((26.73 * Math.PI) / 180, 6);
    expect(errors).toEqual([]);
  });
  for (const mode of ['viewer', 'planet-view'] as const) {
    test(`supports standard vertical slider interaction in ${mode}`, async ({ page }) => {
      const deprecations: string[] = [];
      page.on('console', (message) => {
        if (message.text().includes('slider-vertical')) deprecations.push(message.text());
      });

      // Exercise the production CSS without starting the unrelated WebGL scenes.
      const component = mode === 'viewer' ? 'viewer-scene' : 'planet-view';
      const css = await readFile(resolve('src', 'app', 'page', 'game', `${component}.css`), 'utf8');
      await page.setContent(`
        <style>${css}</style>
        <div class="${component}-zoom">
          <input type="range" min="0" max="100" step="1" aria-label="Zoom level">
        </div>
      `);

      const slider = page.getByRole('slider');
      await expect(slider).toBeVisible();
      await expect(slider).toHaveCSS('writing-mode', 'vertical-lr');
      await expect(slider).toHaveCSS('direction', 'rtl');

      await slider.focus();
      await slider.press('Home');
      await expect(slider).toHaveValue('0');
      await slider.press('ArrowUp');
      await expect(slider).toHaveValue('1');
      await slider.press('ArrowDown');
      await expect(slider).toHaveValue('0');
      await slider.press('End');
      await expect(slider).toHaveValue('100');

      const bounds = await slider.boundingBox();
      if (!bounds) throw new Error('Zoom slider is missing.');
      expect(bounds.height).toBeGreaterThan(bounds.width);
      const x = bounds.x + bounds.width / 2;
      const top = bounds.y + 10;
      const bottom = bounds.y + bounds.height - 10;
      await page.mouse.move(x, top);
      await page.mouse.down();
      await page.mouse.move(x, bottom, { steps: 5 });
      await page.mouse.up();
      await expect.poll(async () => Number(await slider.inputValue())).toBeLessThan(10);
      await page.mouse.move(x, bottom);
      await page.mouse.down();
      await page.mouse.move(x, top, { steps: 5 });
      await page.mouse.up();
      await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(90);
      expect(deprecations).toEqual([]);
    });
  }

  test('does not enter close-up on a planet right-click', async ({ page }) => {
    await setupPlanetViewZoomViewer(page);
    const viewer = new ViewerPage(page);
    await viewer.switchToDistanceView();
    await page.locator('tr', { hasText: 'Earth' }).locator('button.details-target-btn').click();
    await expect(page.getByTestId('viewer-zoom-slider').locator('input')).not.toHaveValue('100');
    const bounds = await viewer.sceneCanvas.boundingBox();
    if (!bounds) throw new Error('Viewer canvas is missing.');
    await page.clock.install();
    await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2, { button: 'right' });
    await page.clock.fastForward(1000);
    await viewer.expectSceneRoute();
    await page.getByTestId('viewer-inspect-target').click();
    await expect(page.getByRole('button', { name: 'Open close-up', exact: true })).toBeVisible();
  });

  test('supports focusing moons even when size metadata is missing', async ({ page }) => {
    await setupPlanetViewZoomViewer(page);
    await enterPlanetViewViaInspector(page);
    const planetViewPage = new PlanetViewPage(page);

    const focusMoonAlpha = planetViewPage.focusMoonButton('Moon Alpha');
    const focusMoonBeta = planetViewPage.focusMoonButton('Moon Beta');

    await expect(focusMoonAlpha).toBeVisible({ timeout: 10_000 });
    await expect(focusMoonBeta).toBeVisible({ timeout: 10_000 });

    await focusMoonBeta.click();
    await expect(planetViewPage.header).toContainText('Moon Beta');
    await expect(planetViewPage.panel).toContainText('— km');
  });

  test.describe('Touch-accessible planet close-ups', () => {
    test.use({ hasTouch: true, viewport: { width: 1180, height: 820 } });

    test('opens the inspected planet with a tap and returns with the visible back button', async ({ page }) => {
      await setupPlanetViewZoomViewer(page);
      const viewer = new ViewerPage(page);
      await viewer.switchToDistanceView();
      await page.locator('tr', { hasText: 'Earth' }).locator('button.details-target-btn').tap();
      await page.getByTestId('viewer-inspect-target').tap();
      // Changing the target must not change the inspector's action.
      await page.locator('tr', { hasText: 'Jupiter' }).locator('button.details-target-btn').tap();
      const open = page.getByRole('button', { name: 'Open close-up', exact: true });
      await expect(open).toBeVisible();
      await open.tap();
      await expect(page).toHaveURL(/right:planet-view\/sol\/earth/);
      await expect(new PlanetViewPage(page).header).toContainText('Earth');
      const back = page.getByRole('button', { name: 'Back to system viewer' });
      await expect(back).toBeVisible();
      await back.tap();
      await viewer.expectSceneRoute();
    });
  });

  test('preserves planet details interaction and right-click exit flow', async ({ page }) => {
    await setupPlanetViewZoomViewer(page);
    await enterPlanetViewViaInspector(page);
    const planetViewPage = new PlanetViewPage(page);

    await expect(planetViewPage.header).toContainText('Earth');
    await expect(planetViewPage.panel).toContainText('Zoom');

    const focusLunaButton = planetViewPage.focusMoonButton('Luna');
    await expect(focusLunaButton).toBeVisible({ timeout: 10_000 });
    await focusLunaButton.click();

    await expect(planetViewPage.header).toContainText('Luna');
    await expect(planetViewPage.panel).toContainText('18%');

    const canvas = planetViewPage.canvas;
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    const clickX = (box?.x ?? 0) + 20;
    const clickY = (box?.y ?? 0) + 20;
    await page.mouse.click(clickX, clickY, { button: 'right' });

    await new ViewerPage(page).expectSceneRoute();
  });

  test('renders a catalogue gas giant procedurally with scaled moons', async ({ page }) => {
    const shaderErrors: string[] = [];
    page.on('console', (message) => {
      if (/THREE\.WebGLProgram|shader error/i.test(message.text())) shaderErrors.push(message.text());
    });

    await setupPlanetViewZoomViewer(page);
    await enterPlanetViewViaInspector(page, 'jupiter');
    const planetViewPage = new PlanetViewPage(page);
    await expect(planetViewPage.header).toContainText('Jupiter');
    await expect(planetViewPage.focusMoonButton('Io')).toBeVisible({ timeout: 10_000 });

    const readGiant = () =>
      page.evaluate(() => {
        const ngApi = (window as Window & { ng?: { getComponent?: (node: Element) => unknown } }).ng;
        for (const canvas of Array.from(document.querySelectorAll('ngt-canvas'))) {
          const component = ngApi?.getComponent?.(canvas) as
            { store?: { snapshot?: { scene?: import('three').Scene } } } | undefined;
          const scene = component?.store?.snapshot?.scene;
          let giant: { bodyId: string } | null = null;
          let ioRadius: number | null = null;
          scene?.traverse((object) => {
            const data = object.userData?.['gasGiant'] as { bodyId: string } | undefined;
            if (data) giant = data;
            if (object.name === 'Io' && 'geometry' in object) {
              const geometry = (object as { geometry: { parameters?: { radius?: number } } }).geometry;
              ioRadius = geometry.parameters?.radius ?? null;
            }
          });
          if (giant) return { giant: giant as { bodyId: string }, ioRadius: ioRadius as number | null };
        }
        return null;
      });

    await expect.poll(async () => (await readGiant())?.giant.bodyId ?? null, { timeout: 15_000 }).toBe('jupiter');
    const state = await readGiant();
    // Io is drawn near true scale against Jupiter, not cube-root inflated.
    expect(state?.ioRadius).toBeGreaterThan(0.1);
    expect(state?.ioRadius).toBeLessThan(0.25);
    expect(shaderErrors).toEqual([]);
  });

  test('draws catalogue gas giants procedurally in the system view', async ({ page }) => {
    const shaderErrors: string[] = [];
    page.on('console', (message) => {
      if (/THREE\.WebGLProgram|shader error/i.test(message.text())) shaderErrors.push(message.text());
    });

    await setupPlanetViewZoomViewer(page);
    await new ViewerPage(page).expectSceneLoaded();

    const readSystemGiants = () =>
      page.evaluate(() => {
        const ngApi = (window as Window & { ng?: { getComponent?: (node: Element) => unknown } }).ng;
        const giants: string[] = [];
        for (const canvas of Array.from(document.querySelectorAll('ngt-canvas'))) {
          const component = ngApi?.getComponent?.(canvas) as
            { store?: { snapshot?: { scene?: import('three').Scene } } } | undefined;
          component?.store?.snapshot?.scene?.traverse((object) => {
            const data = object.userData?.['gasGiant'] as { bodyId: string } | undefined;
            if (data) giants.push(data.bodyId);
          });
        }
        return giants;
      });

    // Jupiter is a giant by catalogue radius; Earth stays a terran surface.
    await expect.poll(readSystemGiants, { timeout: 15_000 }).toEqual(['jupiter']);
    expect(shaderErrors).toEqual([]);
  });
});
