import { expect, test, type Page } from '@playwright/test';
import { setupPlanetViewZoomViewer } from '../fixtures/planet-view-zoom-scenario';
import { PlanetViewPage } from '../page-objects/planet-view.page';
import { ViewerPage } from '../page-objects/viewer.page';

async function enterPlanetViewViaSceneComponent(page: Page, bodyId = 'earth'): Promise<void> {
  const viewerPage = new ViewerPage(page);
  await viewerPage.expectSceneLoaded();

  await page.waitForFunction((targetId) => {
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
      solarSystemId?: () => string | null;
      isPlanetTransitioning?: () => boolean;
    };

    if (
      typeof component?.bodies !== 'function' ||
      typeof component?.onPlanetViewRequest !== 'function' ||
      typeof component?.solarSystemId !== 'function' ||
      typeof component?.isPlanetTransitioning !== 'function'
    ) {
      return false;
    }

    return (
      component.solarSystemId() === 'sol' &&
      !component.isPlanetTransitioning() &&
      component.bodies().some((body) => body.id === targetId)
    );
  }, bodyId);

  await page.evaluate((targetId) => {
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
      isPlanetTransitioning: () => boolean;
    };

    const target = component.bodies().find((body) => body.id === targetId);
    if (!target) {
      throw new Error(`${targetId} body not found`);
    }

    component.onPlanetViewRequest(target);
    if (!component.isPlanetTransitioning()) {
      throw new Error('planet transition was not started');
    }
  }, bodyId);

  await expect(page).toHaveURL(new RegExp(`right:planet-view/sol/${bodyId}`));
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

  test('renders a catalogue gas giant procedurally with scaled moons', async ({ page }) => {
    const shaderErrors: string[] = [];
    page.on('console', (message) => {
      if (/THREE\.WebGLProgram|shader error/i.test(message.text())) shaderErrors.push(message.text());
    });

    await setupPlanetViewZoomViewer(page);
    await enterPlanetViewViaSceneComponent(page, 'jupiter');
    const planetViewPage = new PlanetViewPage(page);
    await expect(planetViewPage.header).toContainText('Jupiter');
    await expect(planetViewPage.focusMoonButton('Io')).toBeVisible({ timeout: 10_000 });

    const readGiant = () =>
      page.evaluate(() => {
        const ngApi = (window as Window & { ng?: { getComponent?: (node: Element) => unknown } }).ng;
        for (const canvas of Array.from(document.querySelectorAll('ngt-canvas'))) {
          const component = ngApi?.getComponent?.(canvas) as
            | { store?: { snapshot?: { scene?: import('three').Scene } } }
            | undefined;
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
});
