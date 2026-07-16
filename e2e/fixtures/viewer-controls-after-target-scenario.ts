import { expect, type Locator, type Page } from '@playwright/test';
import { TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { ViewerPage } from '../page-objects/viewer.page';
import { SocketIOMock } from './socket-mock';
import { loginAndJoinViewerSession } from './viewer-session-bootstrap';

const CHARACTER = {
  id: 'char-vw-controls-1',
  characterName: 'Control Probe',
  level: 2,
  missions: [{ missionId: 'first-target', status: 'completed' }],
};

const SOL_SUMMARY = {
  id: 'sol',
  displayName: 'Sol',
  source: 'curated',
  isMultiStar: false,
  starCount: 1,
  distanceParsec: 0,
  primaryStar: { hygId: '0', spectralClass: 'G2V', colorHex: '#fff5b6', luminositySolar: 1, massSolar: 1 },
};

const SOL_SYSTEM_RESPONSE = {
  success: true,
  message: 'ok',
  playerName: TEST_PLAYER,
  solarSystemId: 'sol',
  solarSystem: SOL_SUMMARY,
  stars: [
    {
      id: 'sun',
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
      spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 149_597_870, y: 0, z: 0 }, epochMs: 0 },
      visualization: { colorHex: '#3399ff' },
      physicalCatalog: { estimatedDiameterM: 12_742_000 },
      orbitalElements: {
        anchorBodyId: 'sun',
        semiMajorAxisKm: 149_597_870,
        eccentricity: 0.0167,
        inclinationDeg: 0,
        longitudeOfAscendingNodeDeg: 0,
        argumentOfPeriapsisDeg: 102.9,
        meanAnomalyAtEpochDeg: 100.5,
      },
    },
    {
      id: 'mars',
      bodyType: 'planet',
      displayName: 'Mars',
      spatial: { solarSystemId: 'sol', frame: 'icrs', positionKm: { x: 227_923_661, y: 0, z: 0 }, epochMs: 0 },
      visualization: { colorHex: '#c1440e' },
      physicalCatalog: { estimatedDiameterM: 6_792_000 },
    },
  ],
};

export async function setupViewer(page: Page): Promise<void> {
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
      characters: [CHARACTER],
    },
  }));

  mock.on('game-join-request', () => null);
  mock.on('solar-system-list-request', () => ({
    event: 'solar-system-list-response',
    data: {
      success: true,
      message: 'ok',
      playerName: TEST_PLAYER,
      solarSystems: [SOL_SUMMARY],
    },
  }));

  mock.on('solar-system-get-request', () => ({
    event: 'solar-system-get-response',
    data: SOL_SYSTEM_RESPONSE,
  }));

  await loginAndJoinViewerSession({ page, mock, gameShell });

  const viewerButton = gameShell.navButton('Viewer');
  await expect(viewerButton).toBeVisible({ timeout: 10_000 });
  await gameShell.openViewer();

  await viewerPage.selectSystem('Sol');
  await expect(page).toHaveURL(/left:solar-system-details/);
  await expect(page).toHaveURL(/right:viewer-scene/);
  await expect(viewerPage.sceneCanvas).toBeVisible({ timeout: 10_000 });
  await viewerPage.switchToDistanceView();
}

export async function getCanvasFrameSignature(canvas: Locator): Promise<string> {
  const image = await canvas.screenshot();
  return image.toString('base64');
}