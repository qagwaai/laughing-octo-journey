import { expect, test, type Page } from '@playwright/test';
import { setupPlanetViewZoomViewer } from '../fixtures/planet-view-zoom-scenario';
import { PlanetViewPage } from '../page-objects/planet-view.page';
import { ViewerPage } from '../page-objects/viewer.page';

async function enterPlanetViewViaSceneComponent(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const ngApi = (
      window as Window & {
        ng?: { getComponent?: (node: Element) => unknown };
      }
    ).ng;
    const host = document.querySelector('app-viewer-scene-page');
    if (!ngApi?.getComponent || !host) {
      return false;
    }

    const component = ngApi.getComponent(host) as {
      bodies?: () => Array<{ id: string }>;
      onPlanetViewRequest?: (body: unknown) => void;
    };

    if (typeof component?.bodies !== 'function' || typeof component?.onPlanetViewRequest !== 'function') {
      return false;
    }

    return component.bodies().some((body) => body.id === 'earth');
  });

  await page.evaluate(() => {
    const ngApi = (
      window as Window & {
        ng?: { getComponent?: (node: Element) => unknown };
      }
    ).ng;
    const host = document.querySelector('app-viewer-scene-page');
    if (!ngApi?.getComponent || !host) {
      throw new Error('viewer scene component not available');
    }

    const component = ngApi.getComponent(host) as {
      bodies: () => Array<{ id: string }>;
      onPlanetViewRequest: (body: unknown) => void;
    };

    const earth = component.bodies().find((body) => body.id === 'earth');
    if (!earth) {
      throw new Error('earth body not found');
    }

    component.onPlanetViewRequest(earth);
  });

  await expect(page).toHaveURL(/right:planet-view\/sol\/earth/);
  await expect(new PlanetViewPage(page).header).toBeVisible({ timeout: 10_000 });
}

test.describe('Planet details zoom pattern', () => {
  test('supports focusing moons even when size metadata is missing', async ({ page }) => {
    await setupPlanetViewZoomViewer(page);
    await enterPlanetViewViaSceneComponent(page);
    const planetViewPage = new PlanetViewPage(page);

    const focusMoonAlpha = planetViewPage.focusMoonButton('Moon Alpha');
    const focusMoonBeta = planetViewPage.focusMoonButton('Moon Beta');

    await expect(focusMoonAlpha).toBeVisible({ timeout: 10_000 });
    await expect(focusMoonBeta).toBeVisible({ timeout: 10_000 });

    await focusMoonBeta.click();
    await expect(planetViewPage.header).toContainText('Moon Beta');
    await expect(planetViewPage.panel).toContainText('— km');
  });

  test('preserves planet details interaction and right-click exit flow', async ({ page }) => {
    await setupPlanetViewZoomViewer(page);
    await enterPlanetViewViaSceneComponent(page);
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
});
