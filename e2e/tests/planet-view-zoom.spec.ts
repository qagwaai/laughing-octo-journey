import { expect, test, type Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { PlanetViewPage } from '../page-objects/planet-view.page';
import { ViewerPage } from '../page-objects/viewer.page';

const SOL_SUMMARY = {
  id: 'sol',
  displayName: 'Sol',
  source: 'curated',
  distanceParsec: 0,
  starCount: 1,
  primaryStar: {
    hygId: '0',
    spectralClass: 'G2V',
    colorHex: '#fff5b6',
    luminositySolar: 1.0,
  },
};

const SOL_SYSTEM_BODIES = [
  {
    id: 'sun',
    bodyType: 'star',
    displayName: 'The Sun',
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 0, y: 0, z: 0 },
      epochMs: 1715000000000,
    },
    visualization: {
      colorHex: '#fff5b6',
    },
    spectralClass: 'G2V',
    luminositySolar: 1.0,
  },
  {
    id: 'earth',
    bodyType: 'planet',
    displayName: 'Earth',
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 149597870.7, y: 0, z: 0 },
      epochMs: 1715000000000,
    },
    visualization: {
      colorHex: '#4a90e2',
    },
    physicalCatalog: {
      estimatedDiameterM: 12742000,
      radiusKm: 6371,
    },
    orbitalElements: {
      anchorBodyId: 'sun',
      semiMajorAxisKm: 149597870.7,
      eccentricity: 0.0167,
      inclinationDeg: 0,
      longitudeOfAscendingNodeDeg: 0,
      argumentOfPeriapsisDeg: 102.9,
      meanAnomalyAtEpochDeg: 100.5,
      orbitalPeriodSec: 31536000,
      epoch: '2026-05-08T00:00:00.000Z',
    },
  },
  {
    id: 'luna',
    bodyType: 'moon',
    displayName: 'Luna',
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 149597870.7 + 384400, y: 0, z: 0 },
      epochMs: 1715000000000,
    },
    visualization: {
      colorHex: '#9bb1c9',
    },
    physicalCatalog: {
      estimatedDiameterM: 3474200,
      radiusKm: 1737,
    },
    orbitalElements: {
      anchorBodyId: 'earth',
      semiMajorAxisKm: 384400,
      eccentricity: 0.0549,
      inclinationDeg: 5.1,
      longitudeOfAscendingNodeDeg: 125.0,
      argumentOfPeriapsisDeg: 318.0,
      meanAnomalyAtEpochDeg: 280.0,
      orbitalPeriodSec: 2360592,
      epoch: '2026-05-08T00:00:00.000Z',
    },
  },
  {
    id: 'moon-alpha',
    bodyType: 'moon',
    displayName: 'Moon Alpha',
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 149597870.7 + 220000, y: 0, z: 0 },
      epochMs: 1715000000000,
    },
    visualization: {
      colorHex: '#b8c5d8',
    },
    orbitalElements: {
      anchorBodyId: 'earth',
      semiMajorAxisKm: 220000,
      eccentricity: 0.04,
      inclinationDeg: 2.1,
      longitudeOfAscendingNodeDeg: 66.0,
      argumentOfPeriapsisDeg: 48.0,
      meanAnomalyAtEpochDeg: 110.0,
      orbitalPeriodSec: 1_800_000,
      epoch: '2026-05-08T00:00:00.000Z',
    },
  },
  {
    id: 'moon-beta',
    bodyType: 'moon',
    displayName: 'Moon Beta',
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 149597870.7 + 1600000, y: 0, z: 0 },
      epochMs: 1715000000000,
    },
    visualization: {
      colorHex: '#d0d8e2',
    },
    orbitalElements: {
      anchorBodyId: 'earth',
      semiMajorAxisKm: 1600000,
      eccentricity: 0.08,
      inclinationDeg: 7.2,
      longitudeOfAscendingNodeDeg: 12.0,
      argumentOfPeriapsisDeg: 220.0,
      meanAnomalyAtEpochDeg: 25.0,
      orbitalPeriodSec: 6_200_000,
      epoch: '2026-05-08T00:00:00.000Z',
    },
  },
];

async function setupViewer(page: Page): Promise<void> {
  const mock = new SocketIOMock(page);
  const gameShell = new GameShellPage(page);
  const viewerPage = new ViewerPage(page);
  await mock.setup();

  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characters: [
        {
          id: 'char-viewer-zoom-1',
          characterName: 'Scout',
          level: 1,
          missions: [{ missionId: 'first-target', status: 'in-progress' }],
        },
      ],
    },
  }));

  mock.on('game-join-request', () => null);
  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characterId: 'char-viewer-zoom-1',
      ships: [
        {
          id: 'ship-viewer-zoom-1',
          name: 'Scout Pod',
          model: 'Scavenger Pod',
          tier: 1,
          status: 'ACTIVE',
          spatial: {
            solarSystemId: 'sol',
            frame: 'barycentric',
            positionKm: { x: 350000000, y: 0, z: 0 },
            epochMs: 1715000000000,
          },
        },
      ],
    },
  }));
  mock.on('solar-system-list-request', () => ({
    event: 'solar-system-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      solarSystems: [SOL_SUMMARY],
    },
  }));

  mock.on('solar-system-get-request', () => ({
    event: 'solar-system-get-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      solarSystemId: 'sol',
      solarSystem: SOL_SUMMARY,
      bodies: SOL_SYSTEM_BODIES,
    },
  }));

  await loginViaUI(page, mock);
  await gameShell.joinGame();
  await expect(page).toHaveURL(/left:game-main/, { timeout: 15000 });

  await gameShell.openViewer();

  await viewerPage.selectSystem('Sol');
}

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
    await setupViewer(page);
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
    await setupViewer(page);
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

    await expect(page).toHaveURL(/right:viewer-scene/);
  });
});
