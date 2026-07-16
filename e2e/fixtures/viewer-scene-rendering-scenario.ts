import { expect, type Page } from '@playwright/test';
import { SocketIOMock } from './socket-mock';
import { loginViaUI, TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';

export const SOL_SUMMARY = {
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

export const SOL_SYSTEM_BODIES: any[] = [
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
    massSolar: 1.0,
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
    planetType: 'terrestrial',
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
    id: 'mars',
    bodyType: 'planet',
    displayName: 'Mars',
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 227923661, y: 0, z: 0 },
      epochMs: 1715000000000,
    },
    visualization: {
      colorHex: '#c1440e',
      radiusScaleFactor: 0.53,
    },
    physicalCatalog: {
      estimatedDiameterM: 6779000,
      radiusKm: 3389.5,
    },
    orbitalElements: {
      anchorBodyId: 'sun',
      semiMajorAxisKm: 227923661,
      eccentricity: 0.0934,
      inclinationDeg: 1.85,
      longitudeOfAscendingNodeDeg: 49.6,
      argumentOfPeriapsisDeg: 286.5,
      meanAnomalyAtEpochDeg: 19.4,
      orbitalPeriodSec: 59354294,
      epoch: '2026-05-08T00:00:00.000Z',
    },
    planetType: 'terrestrial',
  },
  {
    id: 'market-sol-alpha',
    bodyType: 'station',
    stationKind: 'market',
    displayName: 'Sol Market Alpha',
    spatial: {
      solarSystemId: 'sol',
      frame: 'barycentric',
      positionKm: { x: 160000000, y: 0, z: 0 },
      epochMs: 1715000000000,
    },
    orbitalElements: {
      anchorBodyId: 'sun',
      semiMajorAxisKm: 160000000,
      eccentricity: 0.012,
      inclinationDeg: 0.8,
      longitudeOfAscendingNodeDeg: 20,
      argumentOfPeriapsisDeg: 45,
      meanAnomalyAtEpochDeg: 70,
      orbitalPeriodSec: 33000000,
      epoch: '2026-05-08T00:00:00.000Z',
    },
  },
];

export const ACTIVE_SHIP = {
  id: 'ship-viewer-scene-1',
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

export function solarSystemGetResponse(bodies: any[]) {
  return {
    success: true,
    message: '',
    playerName: TEST_PLAYER,
    solarSystemId: 'sol',
    solarSystem: SOL_SUMMARY,
    bodies,
  };
}

function registerViewerSceneSessionHandlers(mock: SocketIOMock, ownerShips: any[]) {
  mock.on('character-list-request', () => ({
    event: 'character-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      characters: [
        {
          id: 'char-viewer-1',
          characterName: 'Scout',
          level: 1,
          missions: [
            {
              missionId: 'first-target',
              status: 'active',
            },
          ],
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
      characterId: 'char-viewer-1',
      ships: ownerShips,
    },
  }));
}

export async function setupViewerSceneTest(page: Page, ownerShips: any[] = [ACTIVE_SHIP]) {
  const mock = new SocketIOMock(page);
  const gameShell = new GameShellPage(page);
  await mock.setup();

  registerViewerSceneSessionHandlers(mock, ownerShips);
  await loginViaUI(page, mock);

  await gameShell.joinGame();
  await expect(page).toHaveURL(/left:game-main/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Game Main' })).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: 'TARGET IRON' })).toBeVisible({ timeout: 10_000 });

  mock.on('solar-system-list-request', () => ({
    event: 'solar-system-list-response',
    data: {
      success: true,
      message: '',
      playerName: TEST_PLAYER,
      solarSystems: [SOL_SUMMARY],
    },
  }));

  return { mock };
}