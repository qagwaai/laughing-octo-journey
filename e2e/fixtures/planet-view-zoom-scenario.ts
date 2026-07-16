import type { Page } from '@playwright/test';
import { SocketIOMock } from './socket-mock';
import { TEST_PLAYER } from '../helpers/auth-helper';
import { GameShellPage } from '../page-objects/game-shell.page';
import { ViewerPage } from '../page-objects/viewer.page';
import { loginAndJoinViewerSession } from './viewer-session-bootstrap';

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

export async function setupPlanetViewZoomViewer(page: Page): Promise<void> {
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
          missions: [{ missionId: 'first-target', status: 'active' }],
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

  await loginAndJoinViewerSession({ page, mock, gameShell });

  await gameShell.openViewer();
  await viewerPage.selectSystem('Sol');
}