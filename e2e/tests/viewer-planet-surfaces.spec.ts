import { expect, test } from '@playwright/test';
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

async function navigateToSystemScene(page: import('@playwright/test').Page, mock: SocketIOMock) {
  const gameShell = new GameShellPage(page);
  const viewerPage = new ViewerPage(page);

  await gameShell.openViewer();
  mock.on('solar-system-get-request', () => ({
    event: 'solar-system-get-response',
    data: solarSystemGetResponse(SOL_SYSTEM_BODIES),
  }));
  await viewerPage.selectSystem('Sol');
  await viewerPage.expectSceneLoaded();
}

/**
 * Enters the planet detail view through the component's own request handler,
 * matching how planet-view-zoom.spec.ts reaches the same screen.
 */
async function enterPlanetViewViaSceneComponent(page: import('@playwright/test').Page) {
  await page.waitForFunction(() => {
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
    return component.bodies().some((body) => body.id === 'earth');
  });

  await page.evaluate(() => {
    const ngApi = (window as Window & { ng?: { getComponent?: (node: Element) => unknown } }).ng;
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
}

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

test.describe('viewer procedural planet surfaces', () => {
  test('bakes system-view surfaces through three.js without shader errors', async ({ page }) => {
    const problems = collectRenderProblems(page);
    const { mock } = await setupViewerSceneTest(page);

    await navigateToSystemScene(page, mock);

    // Sol's fixture has two planets and a moon; the star and station are not
    // texturable, so three surfaces is the full expected set.
    await waitForSurfacesBaked(page, 3);

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

    expect(problems.filter((text) => SHADER_FAILURE.test(text))).toEqual([]);
  });
});
