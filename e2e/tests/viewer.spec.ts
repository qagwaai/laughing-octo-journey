import { expect, test, type Page } from '@playwright/test';
import { SocketIOMock } from '../fixtures/socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { ViewerPage } from '../page-objects/viewer.page';

const characterWithJoin = {
  id: 'char-vw-1',
  characterName: 'Astrocartographer',
  level: 2,
  missions: [{ missionId: 'first-target', status: 'in-progress' }],
};

function characterListResponse(characters: object[]) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    characters,
  };
}

const solSummary = {
  id: 'sol',
  displayName: 'Sol',
  source: 'curated',
  isMultiStar: false,
  starCount: 1,
  distanceParsec: 0,
  primaryStar: { hygId: '0', spectralClass: 'G2V', colorHex: '#fff5b6', luminositySolar: 1, massSolar: 1 },
};

const alphaCenSummary = {
  id: 'alpha-centauri',
  displayName: 'Alpha Centauri',
  source: 'curated',
  isMultiStar: true,
  starCount: 3,
  distanceParsec: 1.34,
  primaryStar: { hygId: '71456', spectralClass: 'G2V', colorHex: '#ffe7a8', luminositySolar: 1.5, massSolar: 1.1 },
};

const ACTIVE_SHIP = {
  id: 'ship-vw-1',
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
};

const solGetResponse = {
  success: true,
  message: 'ok',
  playerName: TEST_PLAYER,
  solarSystemId: 'sol',
  solarSystem: solSummary,
  stars: [
    {
      id: 'sol-star',
      bodyType: 'star',
      displayName: 'Sol',
      spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 0, y: 0, z: 0 }, epochMs: 0 },
      visualization: { colorHex: '#fff5b6' },
      spectralClass: 'G2V',
      luminositySolar: 1,
    },
  ],
  bodies: [
    {
      id: 'earth',
      bodyType: 'planet',
      displayName: 'Earth',
      spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 1.5e8, y: 0, z: 0 }, epochMs: 0 },
      visualization: { colorHex: '#3399ff' },
      physicalCatalog: { estimatedDiameterM: 12_742_000 },
    },
    {
      id: 'mars',
      bodyType: 'planet',
      displayName: 'Mars',
      spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 2.28e8, y: 0, z: 0 }, epochMs: 0 },
      visualization: { colorHex: '#c1440e' },
      physicalCatalog: { estimatedDiameterM: 6_792_000 },
    },
  ],
};

async function setupViewerTest(page: Page) {
  const mock = new SocketIOMock(page);
  await mock.setup();

  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: characterListResponse([characterWithJoin]),
  }));
  mock.on('game-join-request', () => null);
  mock.on('ship-list-by-owner-request', () => ({
    event: 'ship-list-by-owner-response',
    data: {
      success: true,
      message: 'ok',
      playerName: TEST_PLAYER,
      characterId: characterWithJoin.id,
      ships: [ACTIVE_SHIP],
    },
  }));
  mock.on('solar-system-list-request', () => ({
    event: 'solar-system-list-response',
    data: {
      success: true,
      message: 'ok',
      playerName: TEST_PLAYER,
      solarSystems: [solSummary, alphaCenSummary],
    },
  }));
  mock.on('solar-system-get-request', () => ({
    event: 'solar-system-get-response',
    data: solGetResponse,
  }));

  await loginViaUI(page, mock);
  return { mock };
}

async function navigateToViewer(page: Page) {
  const gameShell = new GameShellPage(page);
  await gameShell.joinGame();
  await expect(page).toHaveURL(/left:game-main/, { timeout: 15_000 });
  await gameShell.openViewer();
}

test.describe('Viewer — solar system browser (en)', () => {
  test('lists solar systems and renders the scene host on selection', async ({ page }) => {
    await setupViewerTest(page);
    await navigateToViewer(page);
    const viewerPage = new ViewerPage(page);

    await expect(page.getByRole('heading', { name: 'Solar System Viewer' })).toBeVisible();
    const list = viewerPage.systemList;
    await expect(list).toBeVisible();
    await expect(viewerPage.systemItemById('sol')).toContainText('Sol');
    await expect(viewerPage.systemItemById('alpha-centauri')).toContainText('Alpha Centauri');

    await viewerPage.selectSystem('Sol');
    await expect(viewerPage.sceneHost).toBeVisible();
  });
});

test.describe('Viewer — locale strings (it)', () => {
  test('renders Italian labels when locale is set to it', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('stellar.preferredLocale', 'it');
    });

    await setupViewerTest(page);
    await navigateToViewer(page);

    await expect(page.getByRole('heading', { name: 'Visualizzatore di sistemi' })).toBeVisible();
    await expect(page.getByText('Sistemi conosciuti')).toBeVisible();
  });
});
